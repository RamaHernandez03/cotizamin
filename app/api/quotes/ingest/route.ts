// app/api/quotes/ingest/route.ts
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
  const rows: any[] = [];
  const now = new Date();

  for (const block of blocks) {
    const q = s(block.query);

    for (const r of (block.resultados ?? [])) {
      const proveedor_id = s(r.proveedor_id);
      if (!proveedor_id) continue;

      const desc = s(r.descripcion);
      const code = s(r.codigo_interno);
      const proyecto =
        desc && code ? `${desc} - ${code}` :
        desc ? desc :
        q ? `Cotización: ${q}` : "Cotización";

      const resultadoBase = s(r.resultado) || "Participación";
      const rankTxt =
        r.rank != null && r.total_proveedores != null
          ? ` (Rank #${i(r.rank)}/${i(r.total_proveedores)})`
          : "";
      const resultado = `${resultadoBase}${rankTxt}`;

const comentarioPlano = s(r.comentario_ia);
rows.push({
  proveedor_id,
  fecha: now,
  proyecto,
  accion: "Solicitud de cotización (lab)",
  resultado,
  comentario: comentarioPlano || buildComentario(r), // <— tal cual llega, sin prefijos, fallback si faltara
  sugerencia: s(r.sugerencia_regla) || null,
});
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  await prisma.cotizacionParticipacion.createMany({ data: rows });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
