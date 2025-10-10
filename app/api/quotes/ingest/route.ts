import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** ===== Tipos tolerantes ===== */
type AnyObj = Record<string, any>;

type N8nItemCompat = {
  query?: string | null;        // alias: q, filtro, search
  q?: string | null;
  filtro?: string | null;
  search?: string | null;
  proveedor_id_filtro?: string | null;

  meta?: { total_items?: number | string | null } | null;

  resultados: Array<AnyObj>;
};

/** ===== Helpers ===== */
const s = (v: unknown) => (v ?? "").toString().trim();
const i = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

function pickFirst<T = string>(obj: AnyObj, keys: string[], transform?: (x: any) => T): T | null {
  for (const k of keys) {
    if (k in obj && obj[k] != null) {
      const val = obj[k];
      return transform ? transform(val) : (val as T);
    }
  }
  return null;
}

function buildComentario(r: AnyObj) {
  const partes = [
    `Producto: ${s(pickFirst(r, ["descripcion", "description", "producto_desc", "producto"]))}`,
    pickFirst(r, ["marca", "brand"]) ? `Marca: ${s(pickFirst(r, ["marca", "brand"]))}` : null,
    pickFirst(r, ["modelo", "model"]) ? `Modelo: ${s(pickFirst(r, ["modelo", "model"]))}` : null,
    pickFirst(r, ["codigo_interno", "codigo", "code"]) ? `Código: ${s(pickFirst(r, ["codigo_interno", "codigo", "code"]))}` : null,
    pickFirst(r, ["precio_ofertado", "precio", "price"]) != null
      ? `Precio ofertado: $${s(pickFirst(r, ["precio_ofertado", "precio", "price"]))}`
      : null,
    (() => {
      const rank = pickFirst(r, ["rank", "posicion", "puesto"]);
      const total = pickFirst(r, ["total_proveedores", "total", "resultado_total", "providers_total", "cant_proveedores"]);
      return rank != null && total != null ? `Ranking #${i(rank)}/${i(total)}` : null;
    })(),
    pickFirst(r, ["demand_30d", "demanda30d", "demanda_30d"]) != null
      ? `demanda30d=${i(pickFirst(r, ["demand_30d", "demanda30d", "demanda_30d"]))}`
      : null,
    pickFirst(r, ["stock_ratio_pct", "stock_pct", "stock_ratio"]) != null
      ? `stock=${i(pickFirst(r, ["stock_ratio_pct", "stock_pct", "stock_ratio"]))}%`
      : null,
    Array.isArray(r?.tags) && r.tags.length ? `tags=[${r.tags.join(", ")}]` : null,
    pickFirst(r, ["comentario_ia", "ia_comment", "ia_comentario"]) ? `IA: ${s(pickFirst(r, ["comentario_ia", "ia_comment", "ia_comentario"]))}` : null,
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

  let blocks: N8nItemCompat[];

if (Array.isArray(payload)) {
  // Caso feliz: puede ser array de blocks o array plano de resultados
  if (payload.length && !("resultados" in (payload[0] as any))) {
    // array plano de resultados -> un solo block con query desconocida
    blocks = [{ q: "", resultados: payload as any[] } as N8nItemCompat];
  } else {
    blocks = payload as N8nItemCompat[];
  }
} else if (payload && typeof payload === "object") {
  const obj = payload as any;
  if (Array.isArray(obj.resultados) || Array.isArray(obj.results)) {
    blocks = [{
      q: obj.query ?? obj.q ?? "",
      resultados: Array.isArray(obj.resultados) ? obj.resultados : (obj.results ?? []),
    }];
  } else {
    // objeto desconocido -> nada
    blocks = [];
  }
} else {
  blocks = [];
}

if (blocks.length === 0) {
  return NextResponse.json({ ok: false, error: "empty-payload" }, { status: 400 });
}
  
  
  const now = new Date();

  let touched = 0;
  await prisma.$transaction(async (tx) => {
    for (const block of blocks) {
      // Aceptar distintos nombres de “query”
      const q =
        s(block.query) ||
        s(block.q) ||
        s(block.filtro) ||
        s(block.search);
      if (!q) continue;

      const proyectoName = `Cotización: ${q}`;

      for (const r of (block.resultados ?? [])) {
        // Aceptar alias de proveedor_id
        const proveedor_id =
          s(pickFirst(r, ["proveedor_id", "proveedorId", "id_proveedor", "cliente_id", "user_id", "owner_id"]));
        if (!proveedor_id) continue;

        // Rank numérico tolerante
        const rank_pos = pickFirst(r, ["rank", "posicion", "puesto"], (x) => i(x, null as any)) as number | null;
        const rank_total = pickFirst(r, ["total_proveedores", "total", "resultado_total", "providers_total", "cant_proveedores"], (x) => i(x, null as any)) as number | null;

        // Resultado “humano”
        const resultadoBase = s(
          pickFirst(r, ["resultado", "status", "state"]) || "Participación"
        );
        const rankTxt = rank_pos != null && rank_total != null ? ` (Ranking: ${rank_pos}/${rank_total})` : "";
        const resultado = `${resultadoBase}${rankTxt}`.trim();

        // Comentario (prefiere IA)
        const comentarioIa = s(pickFirst(r, ["comentario_ia", "ia_comment", "ia_comentario"]) || "");
        const comentarioGenerado = buildComentario(r);
        const comentarioNuevo = comentarioIa || comentarioGenerado;

        const sugerenciaNueva = s(pickFirst(r, ["sugerencia_regla", "suggestion", "sugerencia"]) || "") || null;

        // Vincular a participación “reciente” (72h) creada por el lab
        const recienteDesde = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
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
          // Merge: si viene IA, la ponemos arriba
          const comentarioMerged = comentarioIa
            ? (prev.comentario ? `IA: ${comentarioIa}\n\n${prev.comentario}` : `IA: ${comentarioIa}`)
            : (prev.comentario ? prev.comentario : comentarioNuevo);

          await tx.cotizacionParticipacion.update({
            where: { id: prev.id },
            data: {
              fecha: now,
              accion: "Participación",
              resultado,
              comentario: comentarioMerged,
              sugerencia: sugerenciaNueva ?? prev.sugerencia ?? null,
              rank_pos,
              rank_total,
            },
          });
          touched++;
        } else {
          // Si no existe, la creamos CONSISTENTE y con comentario
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
          touched++;
        }
      }
    }
  });

  return NextResponse.json({ ok: true, touched });
}
