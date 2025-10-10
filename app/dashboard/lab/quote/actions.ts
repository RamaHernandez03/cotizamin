"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** =========================
 * Helpers compartidos
 * ========================= */

/** Resuelve una base URL confiable para fetch interno */
function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

function sanitize(v: unknown) {
  return String(v ?? "").trim();
}

/** Dispara tu flujo n8n (opcional). Mantengo firma para reuse. */
async function triggerWebhookForProvider(params: {
  proveedor_id: string;
  q: string;
  precio_ofertado?: number | null;
  rank?: number;
  total?: number;
}) {
  const base = getBaseUrl();

  // 1) Dispara n8n vía proxy interno
  const r1 = await fetch(`${base}/api/quotes/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!r1.ok) throw new Error(`refresh failed ${r1.status}`);
  const j1 = (await r1.json()) as { ok: boolean; data?: unknown };
  if (!j1.ok) throw new Error("refresh not ok");

  // 2) Ingesta de respuesta
  const r2 = await fetch(`${base}/api/quotes/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(j1.data ?? []),
    cache: "no-store",
  });
  if (!r2.ok) throw new Error(`ingest failed ${r2.status}`);
  const j2 = await r2.json();
  return j2;
}

/** Garantiza que el "admin" exista como Cliente (para poder participar en chat). */
async function ensureAdminCliente(email: string, nombre?: string | null) {
  const found = await prisma.cliente.findFirst({ where: { email } });
  if (found) return found.id_cliente;

  const created = await prisma.cliente.create({
    data: {
      nombre: nombre || email.split("@")[0],
      email,
    },
    select: { id_cliente: true },
  });
  return created.id_cliente;
}

/** =========================
 * Actions
 * ========================= */

/**
 * Acción MASIVA: notificar a los proveedores listados (crear/actualizar feedback)
 * - Crea/actualiza registros en `cotizacionParticipacion` con:
 *   proyecto = "Cotización: {q}"
 *   accion   = "Participación"
 *   resultado= "Posición {rank} de {total}"
 *   rank_pos / rank_total
 *   comentario = "Producto: … • Código: … • Precio: …"
 * - (Opcional) dispara n8n en background (best-effort)
 */
export async function notifyFromQuery(formData: FormData) {
  const q = sanitize(formData.get("q"));
  const marca = sanitize(formData.get("marca"));
  const modelo = sanitize(formData.get("modelo"));
  const material = sanitize(formData.get("material"));
  const limitRaw = Number(sanitize(formData.get("limit")) || 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

  if (!q) {
    redirect(`/dashboard/lab/quote?sent=0`);
  }

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

  // 4) Crea/actualiza participaciones para los que se notifican (limit)
  await prisma.$transaction(async (tx) => {
    const list = ranked.slice(0, limit);

    for (const t of list) {
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

      if (prev?.id) {
        await tx.cotizacionParticipacion.update({
          where: { id: prev.id },
          data: {
            fecha: now,
            accion: "Participación",
            resultado: `Posición ${t.rank} de ${t.total}`,
            comentario,
            rank_pos: t.rank,
            rank_total: t.total,
          },
        });
      } else {
        await tx.cotizacionParticipacion.create({
          data: {
            proveedor_id: t.proveedor_id,
            fecha: now,
            proyecto: proyectoName,
            accion: "Participación",
            resultado: `Posición ${t.rank} de ${t.total}`,
            comentario,
            rank_pos: t.rank,
            rank_total: t.total,
            sugerencia: null,
          },
        });
      }
    }
  });

  // 5) (Opcional) mantener tus flujos n8n como best-effort (no bloquea)
  await Promise.allSettled(
    ranked.slice(0, limit).map((t) =>
      triggerWebhookForProvider({
        proveedor_id: t.proveedor_id,
        q,
        precio_ofertado: t.precio_actual,
        rank: t.rank,
        total: t.total,
      })
    )
  );

  // 6) refrescamos feedback y volvemos a la misma pantalla con flag "sent"
  revalidatePath("/dashboard/feedback");
  redirect(
    `/dashboard/lab/quote?sent=1&q=${encodeURIComponent(q)}&marca=${encodeURIComponent(
      marca
    )}&modelo=${encodeURIComponent(modelo)}&material=${encodeURIComponent(material)}&limit=${limit}`
  );
}

/**
 * Acción POR FILA: adjudicar al ganador e iniciar el chat 1–a–1
 * Versión tolerante: si faltan tablas de chat no rompe; deja la participación y redirige a Feedback.
 */
export async function awardAndOpenChat(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userEmail = String((session.user as any)?.email || "");
  const userName = String((session.user as any)?.name || "") || null;
  if (!userEmail) throw new Error("Admin sin email en sesión");

  // Campos que mandamos desde la tabla (por fila)
  const proveedor_id = String(formData.get("proveedor_id") || "");
  const q = String(formData.get("q") || "");
  const id_producto = String(formData.get("id_producto") || "");
  const codigo = String(formData.get("codigo_interno") || "");
  const descripcion = String(formData.get("descripcion") || "");
  const precio = Number(formData.get("precio_actual") || 0);

  if (!proveedor_id || !q) throw new Error("Bad request");

  // Creamos/aseguramos Cliente "admin"
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
    const [{ exists }] = await prisma.$queryRawUnsafe<
      Array<{ exists: boolean }>
    >(`SELECT to_regclass('public."Conversation"') IS NOT NULL AS exists`);
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
                { userId: proveedor_id }, // proveedor ganador
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
            `Hola! Esta cotización fue *seleccionada*.`,
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

  // refrescamos vistas relacionadas
  revalidatePath("/dashboard/feedback");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/messages");

  // redirigimos
  if (conversationId) {
    redirect(`/dashboard/messages/${conversationId}`);
  } else {
    redirect(`/dashboard/feedback?adjudicacion=ok`);
  }
}
