import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type N8nItem = {
  query: string;
  proveedor_id_filtro?: string | null;
  meta?: { total_items?: number | string | null } | null;
  resultados: Array<{
    proveedor_id: string;
    producto_id: string;
    codigo_interno?: string | null;
    descripcion: string;
    marca?: string | null;
    modelo?: string | null;
    rank?: string | number | null;
    total_proveedores?: string | number | null;
    pctl?: number | null;
    demand_30d?: number | null;
    stock_ratio_pct?: number | null;
    resultado?: string | null;
    tags?: string[] | null;
    sugerencia_regla?: string | null;
    comentario_ia?: string | null;
    precio_ofertado?: number | null;
  }>;
};

function s(v: unknown) { return (v ?? "").toString().trim(); }
function i(v: unknown, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function buildComentario(r: N8nItem["resultados"][number]) {
  const partes = [
    `Producto: ${s(r.descripcion)}`,
    r.marca ? `Marca: ${s(r.marca)}` : null,
    r.modelo ? `Modelo: ${s(r.modelo)}` : null,
    r.codigo_interno ? `Código: ${s(r.codigo_interno)}` : null,
    r.precio_ofertado != null ? `Precio ofertado: $${r.precio_ofertado}` : null,
    (r.rank != null && r.total_proveedores != null)
      ? `Ranking #${i(r.rank)}/${i(r.total_proveedores)}`
      : null,
    r.demand_30d != null ? `demanda30d=${i(r.demand_30d)}` : null,
    r.stock_ratio_pct != null ? `stock=${i(r.stock_ratio_pct)}%` : null,
    r.tags?.length ? `tags=[${r.tags.join(", ")}]` : null,
    r.comentario_ia ? `IA: ${s(r.comentario_ia)}` : null,
  ].filter(Boolean);

  let txt = partes.join(" • ");
  if (txt.length > 1800) txt = txt.slice(0, 1797) + "...";
  return txt;
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return NextResponse.json({ ok: false, error: "empty-payload" }, { status: 400 });
  }

  const blocks = payload as N8nItem[];
  const now = new Date();

  // Trabajamos por upsert fila a fila para mergear comentario/sugerencia en la participación creada por el lab
  await prisma.$transaction(async (tx) => {
    for (const block of blocks) {
      const q = s(block.query);
      if (!q) continue;

      // Usamos EXACTAMENTE el mismo "proyecto" que crea notifyFromQuery
      const proyectoName = `Cotización: ${q}`;

      for (const r of (block.resultados ?? [])) {
        const proveedor_id = s(r.proveedor_id);
        if (!proveedor_id) continue;

        // Ranking numérico
        const rank_pos = r.rank != null ? i(r.rank) : null;
        const rank_total = r.total_proveedores != null ? i(r.total_proveedores) : null;

        // Texto de resultado "humano" con rank (si existe)
        const resultadoBase = s(r.resultado) || "Participación";
        const rankTxt =
          rank_pos != null && rank_total != null
            ? ` (Ranking: ${rank_pos}/${rank_total})`
            : "";
        const resultado = `${resultadoBase}${rankTxt}`.trim();

        // Comentario preferente desde IA; si no viene, uno rico con fields
        const comentarioDesdeIa = s(r.comentario_ia);
        const comentarioNuevo = comentarioDesdeIa || buildComentario(r);
        const sugerenciaNueva = s(r.sugerencia_regla) || null;

        // Intentamos encontrar la participación "reciente" creada por el lab/quote
        const recienteDesde = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3); // 72h
        const prev = await tx.cotizacionParticipacion.findFirst({
          where: {
            proveedor_id,
            proyecto: proyectoName,
            fecha: { gte: recienteDesde },
          },
          orderBy: { fecha: "desc" },
          select: { id: true, comentario: true, sugerencia: true },
        });

        if (prev?.id) {
          // Merge simple: si ya había comentario, lo enriquecemos; si no, lo seteamos
          // Priorizamos escribir el de n8n (IA) arriba para que sea visible
          const comentarioMerged = comentarioDesdeIa
            ? (prev.comentario
                ? `IA: ${comentarioDesdeIa}\n\n${prev.comentario}`
                : `IA: ${comentarioDesdeIa}`)
            : (prev.comentario ? prev.comentario : comentarioNuevo);

          await tx.cotizacionParticipacion.update({
            where: { id: prev.id },
            data: {
              fecha: now,
              accion: "Participación", // mantenemos la misma acción
              resultado,
              comentario: comentarioMerged,
              sugerencia: sugerenciaNueva ?? prev.sugerencia ?? null,
              rank_pos,
              rank_total,
            },
          });
        } else {
          // Si por algún motivo todavía no existía, la creamos CONSISTENTE con el lab
          await tx.cotizacionParticipacion.create({
            data: {
              proveedor_id,
              fecha: now,
              proyecto: proyectoName,
              accion: "Participación",
              resultado,
              comentario: comentarioNuevo,
              sugerencia: sugerenciaNueva,
              rank_pos,
              rank_total,
            },
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
