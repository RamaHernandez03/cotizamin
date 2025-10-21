"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// mails
import { sendMail, wrap, btn, getBaseUrl } from "@/lib/mail";

/** =========================
 * Helpers compartidos
 * ========================= */

async function ensureAdminCliente(email: string, nombre?: string | null) {
  const found = await prisma.cliente.findFirst({ where: { email }, select: { id_cliente: true } });
  if (found) return found.id_cliente;

  const created = await prisma.cliente.create({
    data: { nombre: nombre || email.split("@")[0], email },
    select: { id_cliente: true },
  });
  return created.id_cliente;
}

/** Inserta en RecentSuggestion y recorta FIFO cap 10 por proveedor */
async function pushRecentSuggestion(params: {
  proveedor_id: string;
  proyecto?: string | null;
  comentario?: string | null;
  sugerencia: string;
}) {
  const { proveedor_id, proyecto, comentario, sugerencia } = params;

  await prisma.$transaction(async (tx) => {
    await tx.recentSuggestion.create({
      data: {
        proveedor_id,
        proyecto: proyecto ?? null,
        comentario: comentario ?? null,
        sugerencia,
      },
    });

    // Recortar manteniendo 10 más recientes
    const ids = await tx.recentSuggestion.findMany({
      where: { proveedor_id },
      select: { id: true },
      orderBy: { created_at: "desc" },
    });

    if (ids.length > 10) {
      const toDelete = ids.slice(10).map((r) => r.id);
      await tx.recentSuggestion.deleteMany({ where: { id: { in: toDelete } } });
    }
  });
}

/** Normaliza payload del n8n a blocks [{query,resultados[]}] */
function normalizeN8nDataToBlocks(raw: any, q: string) {
  if (!raw) return [];
  if (Array.isArray(raw) && raw.every((b) => typeof b === "object" && ("resultados" in b || "results" in b))) {
    return raw.map((b) => ({
      query: b.query ?? b.q ?? q,
      resultados: Array.isArray(b.resultados) ? b.resultados : (Array.isArray(b.results) ? b.results : []),
    }));
  }
  if (typeof raw === "object" && (Array.isArray(raw.resultados) || Array.isArray(raw.results))) {
    return [{
      query: raw.query ?? raw.q ?? q,
      resultados: Array.isArray(raw.resultados) ? raw.resultados : (raw.results ?? []),
    }];
  }
  if (Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === "object")) {
    return [{ query: q, resultados: raw }];
  }
  return [];
}

function sanitize(v: unknown) {
  return String(v ?? "").trim();
}

/** Dispara tu flujo n8n (opcional) + envía participation_id para mergear en ingest */
async function triggerWebhookForProvider(params: {
  proveedor_id: string;
  q: string;
  precio_ofertado?: number | null;
  rank?: number;
  total?: number;
  participation_id?: string; // 👈 clave para evitar duplicados
}) {
  const base = getBaseUrl();

  // 1) Disparo a n8n
  const r1 = await fetch(`${base}/api/quotes/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params), // viaja participation_id
    cache: "no-store",
  });
  if (!r1.ok) throw new Error(`refresh failed ${r1.status}`);
  const j1 = (await r1.json()) as { ok: boolean; data?: any };
  if (!j1.ok) throw new Error("refresh not ok");

  // 2) Normalización
  const blocks = normalizeN8nDataToBlocks(j1.data, params.q);
  if (!blocks.length) return { ok: true, ingested: 0 };

  // 3) Ingesta mergeando sobre la participación creada/actualizada
  const r2 = await fetch(`${base}/api/quotes/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, participation_id: params.participation_id }),
    cache: "no-store",
  });
  if (!r2.ok) {
    const txt = await r2.text().catch(() => "");
    throw new Error(`ingest failed ${r2.status}: ${txt}`);
  }
  const j2 = await r2.json();
  return j2;
}

/** =========================
 * Actions
 * ========================= */

/**
 * Acción MASIVA: notificar a los proveedores listados (crear/actualizar feedback)
 * - Crea/actualiza registros en `cotizacionParticipacion`
 * - Dispara n8n y el ingest MERGEA usando participation_id
 * - Empuja a RecentSuggestion con FIFO cap 10
 * - Envía emails de participación a cada proveedor listado
 */
export async function notifyFromQuery(formData: FormData) {
  const q = sanitize(formData.get("q"));
  const marca = sanitize(formData.get("marca"));
  const modelo = sanitize(formData.get("modelo"));
  const material = sanitize(formData.get("material"));
  const limitRaw = Number(sanitize(formData.get("limit")) || 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

  if (!q) redirect(`/dashboard/lab/quote?sent=0`);

  // 1) Repetimos la búsqueda server-side para garantizar consistencia
  const productos = await prisma.producto.findMany({
    where: {
      AND: [
        { precio_actual: { gt: 0 } },
        { descripcion: { contains: q, mode: "insensitive" } },
        marca ? { marca: { equals: marca, mode: "insensitive" } } : {},
        modelo ? { modelo: { equals: modelo, mode: "insensitive" } } : {},
        material ? { material: { equals: material, mode: "insensitive" } } : {},
      ],
    },
    orderBy: { precio_actual: "asc" },
    select: {
      id_producto: true,
      proveedor_id: true,
      codigo_interno: true,
      descripcion: true,
      marca: true,
      modelo: true,
      material: true,
      precio_actual: true,
    },
    take: 200,
  });

  // 2) Un producto (el más barato) por proveedor
  const byProveedor = new Map<string, (typeof productos)[number]>();
  for (const p of productos) {
    if (!byProveedor.has(p.proveedor_id)) byProveedor.set(p.proveedor_id, p);
  }
  const uniques = Array.from(byProveedor.values()).sort((a, b) => a.precio_actual - b.precio_actual);
  if (uniques.length === 0) {
    redirect(`/dashboard/lab/quote?sent=0&q=${encodeURIComponent(q)}&marca=${encodeURIComponent(marca)}&modelo=${encodeURIComponent(modelo)}&material=${encodeURIComponent(material)}&limit=${limit}`);
  }

  // 3) Ranking real por precio (1 = más barato)
  const totalProveedores = uniques.length;
  const ranked = uniques.map((p, i) => ({
    ...p,
    rank: i + 1,
    total: totalProveedores,
  }));

  const proyectoName = `Cotización: ${q}`;
  const now = new Date();

  // 4) Crear/actualizar participaciones para los que se notifican (limit)
  const topList = ranked.slice(0, limit);

  // Guardamos referencias para pasar participation_id al webhook
  const participationRefs: Array<{
    proveedor_id: string;
    participation_id: string;
    precio: number;
    rank: number;
    total: number;
    comentario: string;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const t of topList) {
      const comentario = [
        `Producto: ${t.descripcion || q}`,
        `Código: ${t.codigo_interno ?? "N/D"}`,
        Number.isFinite(t.precio_actual) ? `Precio: $${t.precio_actual.toLocaleString("es-AR")}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      // Si existe algo muy reciente para este proveedor y proyecto, lo actualizo
      const prev = await tx.cotizacionParticipacion.findFirst({
        where: {
          proveedor_id: t.proveedor_id,
          proyecto: proyectoName,
          fecha: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 24) }, // 24h
        },
        orderBy: { fecha: "desc" },
        select: { id: true },
      });

      let participation_id: string;

      if (prev?.id) {
        await tx.cotizacionParticipacion.update({
          where: { id: prev.id },
          data: {
            fecha: now,
            accion: "Participación",
            resultado: `Posición ${t.rank} de ${t.total}`,
            comentario, // base
            rank_pos: t.rank,
            rank_total: t.total,
          },
        });
        participation_id = prev.id;
      } else {
        const created = await tx.cotizacionParticipacion.create({
          data: {
            proveedor_id: t.proveedor_id,
            fecha: now,
            proyecto: proyectoName,
            accion: "Participación",
            resultado: `Posición ${t.rank} de ${t.total}`,
            comentario, // base
            rank_pos: t.rank,
            rank_total: t.total,
            sugerencia: null,
          },
          select: { id: true },
        });
        participation_id = created.id;
      }

      participationRefs.push({
        proveedor_id: t.proveedor_id,
        participation_id,
        precio: t.precio_actual,
        rank: t.rank,
        total: t.total,
        comentario,
      });
    }
  });

  // 5) Enviar emails de participación (no bloqueantes)
  try {
    const providerIds = topList.map((t) => t.proveedor_id);
    const contactos = await prisma.cliente.findMany({
      where: { id_cliente: { in: providerIds } },
      select: { id_cliente: true, email: true, nombre: true },
    });
    const emailMap = new Map(contactos.map((c) => [c.id_cliente, c]));

    const baseUrl = getBaseUrl();
    const detalle = [
      q,
      (marca && `Marca ${marca}`) || null,
      (modelo && `Modelo ${modelo}`) || null,
      (material && `Material ${material}`) || null,
    ].filter(Boolean).join(" · ");

    await Promise.allSettled(topList.map(async (t) => {
      const c = emailMap.get(t.proveedor_id);
      if (!c?.email) return;

      const html = wrap(
        "Estás participando en una licitación",
        `
          <p>Hola${c.nombre ? ` ${c.nombre}` : ""},</p>
          <p>Estás participando en la licitación <strong>${proyectoName}</strong>.</p>
          <ul>
            <li><strong>Producto:</strong> ${t.descripcion || q}</li>
            ${t.marca ? `<li><strong>Marca:</strong> ${t.marca}</li>` : ""}
            ${t.modelo ? `<li><strong>Modelo:</strong> ${t.modelo}</li>` : ""}
            ${t.material ? `<li><strong>Material:</strong> ${t.material}</li>` : ""}
            <li><strong>Ranking actual:</strong> ${t.rank} / ${t.total}</li>
            ${Number.isFinite(t.precio_actual) ? `<li><strong>Precio de referencia:</strong> $${t.precio_actual.toLocaleString("es-AR")}</li>` : ""}
          </ul>
          <p>Te avisaremos cuando se adjudique la licitación.</p>
          <p style="margin-top:16px">${btn(`${baseUrl}/dashboard/feedback`, "Ver feedback")}</p>
          <hr style="margin:16px 0;border:none;border-top:1px solid #eee" />
          <p style="font-size:12px;color:#667085">Búsqueda: ${detalle}</p>
        `
      );

      await sendMail({
        to: c.email,
        subject: `Participación creada — ${proyectoName}`,
        html,
        text: `Estás participando en ${proyectoName}. Producto: ${t.descripcion || q}. Ranking ${t.rank}/${t.total}.`,
      });
    }));
  } catch (e) {
    console.warn("[notifyFromQuery mail] error:", e);
  }

  // 6) Disparo n8n (con participation_id) y empujo a Sugerencias (FIFO) en paralelo
  await Promise.allSettled([
    ...participationRefs.map((ref) =>
      triggerWebhookForProvider({
        proveedor_id: ref.proveedor_id,
        q,
        precio_ofertado: ref.precio,
        rank: ref.rank,
        total: ref.total,
        participation_id: ref.participation_id, // 👈 evita duplicados
      })
    ),
    ...participationRefs.map((ref) => {
      const sugerenciaTexto =
        `Participaste en ${proyectoName} — quedaste ${ref.rank}/${ref.total}. ` +
        (Number.isFinite(ref.precio) ? `Precio: $${ref.precio.toLocaleString("es-AR")}. ` : "") +
        `Revisá precio/stock para mejorar tu posición.`;

      return pushRecentSuggestion({
        proveedor_id: ref.proveedor_id,
        proyecto: proyectoName,
        comentario: ref.comentario,
        sugerencia: sugerenciaTexto,
      });
    }),
  ]);

  // 7) refrescamos feedback y volvemos a la misma pantalla con flag "sent"
  revalidatePath("/dashboard/feedback");
  redirect(
    `/dashboard/lab/quote?sent=1&q=${encodeURIComponent(q)}&marca=${encodeURIComponent(
      marca
    )}&modelo=${encodeURIComponent(modelo)}&material=${encodeURIComponent(material)}&limit=${limit}`
  );
}

/**
 * Acción POR FILA: adjudicar al ganador e iniciar el chat 1–a–1
 * - Envía mail al ganador (con link al chat si existe)
 * - Envía mails a no ganadores con ranking y comentario IA (si está disponible)
 */
export async function awardAndOpenChat(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userEmail = String((session.user as any)?.email || "");
  const userName = String((session.user as any)?.name || "") || null;
  if (!userEmail) throw new Error("Admin sin email en sesión");

  const proveedor_id = String(formData.get("proveedor_id") || "");
  const q = String(formData.get("q") || "");
  const codigo = String(formData.get("codigo_interno") || "");
  const descripcion = String(formData.get("descripcion") || "");
  const precio = Number(formData.get("precio_actual") || 0);
  const marca = String(formData.get("marca") || ""); // 👈 NUEVO

  if (!proveedor_id || !q) throw new Error("Bad request");

  const adminClienteId = await ensureAdminCliente(userEmail, userName);

  const proyectoName = `Adjudicación: ${q}`;
  const now = new Date();

  // 1) asegurar participación ACEPTADA (sin depender del chat)
  const participation = await prisma.cotizacionParticipacion.upsert({
    where: {
      id: await (async () => {
        const prev = await prisma.cotizacionParticipacion.findFirst({
          where: {
            proveedor_id,
            proyecto: proyectoName,
            resultado: { in: ["Aceptado", "Cotización seleccionada"] },
          },
          select: { id: true },
        });
        if (prev) return prev.id;
        const created = await prisma.cotizacionParticipacion.create({
          data: {
            proveedor_id,
            fecha: now,
            proyecto: proyectoName,
            accion: "Adjudicación",
            resultado: "Aceptado",
            comentario: `Producto: ${descripcion || q} • Código: ${codigo}`,
            sugerencia: null,
          },
          select: { id: true },
        });
        return created.id;
      })(),
    },
    update: {
      fecha: now,
      accion: "Adjudicación",
      resultado: "Aceptado",
      comentario: `Producto: ${descripcion || q} • Código: ${codigo}`,
    },
    create: {
      proveedor_id,
      fecha: now,
      proyecto: proyectoName,
      accion: "Adjudicación",
      resultado: "Aceptado",
      comentario: `Producto: ${descripcion || q} • Código: ${codigo}`,
    },
    select: { id: true },
  });

  // 2) intentar chat sólo si existen las tablas
  let conversationId: string | null = null;
  try {
    const [{ exists }] = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public."Conversation"') IS NOT NULL AS exists`
    );
    if (!exists) throw new Error("Chat tables missing");

    const result = await prisma.$transaction(async (tx) => {
      let conversation = await tx.conversation.findFirst({
        where: { participationId: participation.id },
        select: { id: true },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            participationId: participation.id,
            participants: {
              create: [
                { userId: proveedor_id },   // proveedor ganador
                { userId: adminClienteId }, // admin/operador
              ],
            },
          },
          select: { id: true },
        });
      } else {
        await tx.conversationParticipant.createMany({
          data: [
            { conversationId: conversation.id, userId: proveedor_id },
            { conversationId: conversation.id, userId: adminClienteId },
          ],
          skipDuplicates: true,
        });
      }

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: adminClienteId,
          body: [
            `¡Hola! Esta cotización fue *seleccionada*.`,
            ``,
            `**Detalle**`,
            `• Producto: ${descripcion || q}`,
            `• Código: ${codigo || "N/D"}`,
            `• Precio de referencia: ${
              Number.isFinite(precio) ? `$${precio.toLocaleString("es-AR")}` : "—"
            }`,
            ``,
            `Coordinemos entrega/condiciones por este chat. 🙌`,
          ].join("\n"),
        },
      });

      return { conversationId: conversation.id };
    });

    conversationId = result.conversationId;
  } catch (e) {
    console.warn("[awardAndOpenChat] Chat deshabilitado (faltan tablas). Sigo sin chat.", e);
  }

  // === MAILS ===
  // 1) Mail al ganador
  try {
    const ganador = await prisma.cliente.findUnique({
      where: { id_cliente: proveedor_id },
      select: { email: true, nombre: true },
    });
    const baseUrl = getBaseUrl();
    const chatUrl = conversationId
      ? `${baseUrl}/dashboard/messages/${conversationId}`
      : `${baseUrl}/dashboard/messages`;

    if (ganador?.email) {
      const asunto = `¡Felicidades! Ganaste la licitación — ${descripcion || q}${marca ? ` (${marca})` : ""}`;
      const html = wrap(
        "¡Felicidades, ganaste la licitación! 🎉",
        `
          <p>Hola${ganador.nombre ? ` ${ganador.nombre}` : ""},</p>
          <p>Tu oferta fue seleccionada para <strong>${descripcion || q}</strong>${marca ? ` — <strong>${marca}</strong>` : ""}.</p>
          <ul>
            <li><strong>Código:</strong> ${codigo || "N/D"}</li>
            ${Number.isFinite(precio) ? `<li><strong>Precio de referencia:</strong> $${precio.toLocaleString("es-AR")}</li>` : ""}
          </ul>
          <p>Podés coordinar la entrega y condiciones desde el chat:</p>
          <p style="margin-top:16px">${btn(baseUrl, "Abrir chat")}</p>
        `
      );
      await sendMail({
        to: ganador.email,
        subject: asunto,
        html,
        text: `Ganaste la licitación ${descripcion || q} ${marca ? `(${marca})` : ""}. Abrí el chat: ${baseUrl}`,
      });
    }
  } catch (e) {
    console.warn("[mail ganador] error:", e);
  }

  // 2) Mails a participantes no ganadores (tomando último comentario IA si ya llegó)
  try {
    const proyectoCotizacion = `Cotización: ${q}`;
    const recienteDesde = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
    const participaciones = await prisma.cotizacionParticipacion.findMany({
      where: {
        proyecto: proyectoCotizacion,
        fecha: { gte: recienteDesde },
      },
      orderBy: { fecha: "desc" },
      select: {
        proveedor_id: true,
        comentario: true,     // aquí puede venir "IA: ..."
        rank_pos: true,
        rank_total: true,
      },
    });

    const seen = new Set<string>();
    const ultimas = participaciones.filter((p) => {
      if (seen.has(p.proveedor_id)) return false;
      seen.add(p.proveedor_id);
      return true;
    });

    const perdedores = ultimas.filter((p) => p.proveedor_id !== proveedor_id);
    const idsPerdedores = perdedores.map((p) => p.proveedor_id);

    if (idsPerdedores.length) {
      const contactos = await prisma.cliente.findMany({
        where: { id_cliente: { in: idsPerdedores } },
        select: { id_cliente: true, email: true, nombre: true },
      });
      const cmap = new Map(contactos.map((c) => [c.id_cliente, c]));
      const baseUrl = getBaseUrl();

      await Promise.allSettled(perdedores.map(async (p) => {
        const c = cmap.get(p.proveedor_id);
        if (!c?.email) return;

        const rankTxt = p.rank_pos != null && p.rank_total != null ? `${p.rank_pos}/${p.rank_total}` : "—";
        const iaLine = (p.comentario || "").split("\n").find((line) => line.trim().startsWith("IA:")) || "";
        const iaText = iaLine.replace(/^IA:\s*/i, "").trim();

        const html = wrap(
          "Resultado de la licitación",
          `
            <p>Hola${c.nombre ? ` ${c.nombre}` : ""},</p>
            <p>La licitación <strong>${proyectoCotizacion}</strong> fue adjudicada a otro proveedor.</p>
            <ul>
              <li><strong>Tu ranking:</strong> ${rankTxt}</li>
              ${iaText ? `<li><strong>Comentario IA:</strong> ${iaText}</li>` : ""}
            </ul>
            <p>Revisá tus participaciones para optimizar precio/stock y mejorar tu posición en futuras búsquedas.</p>
            <p style="margin-top:16px">${btn(`${baseUrl}/dashboard/feedback`, "Ver mis participaciones")}</p>
          `
        );

        await sendMail({
          to: c.email,
          subject: `Resultado — ${proyectoCotizacion}`,
          html,
          text: `Resultado ${proyectoCotizacion}. Tu ranking: ${rankTxt}. ${iaText ? `IA: ${iaText}` : ""}`,
        });
      }));
    }
  } catch (e) {
    console.warn("[mail perdedores] error:", e);
  }

  // 3) Empujar a Sugerencias (FIFO)
  const sugerenciaTexto = `¡Ganaste la cotización "${q}"! Abrimos un chat para coordinar entrega y condiciones.`;
  await pushRecentSuggestion({
    proveedor_id,
    proyecto: proyectoName,
    comentario: `Producto: ${descripcion || q} • Código: ${codigo || "N/D"}`,
    sugerencia: sugerenciaTexto,
  });

  // 4) refrescamos vistas relacionadas
  revalidatePath("/dashboard/feedback");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/messages");

  // 5) redirigimos
  if (conversationId) {
    redirect(`/dashboard/messages/${conversationId}`);
  } else {
    redirect(`/dashboard/feedback?adjudicacion=ok`);
  }
}
