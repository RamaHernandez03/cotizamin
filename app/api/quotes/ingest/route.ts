// app/api/quotes/ingest/route.ts
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
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  // Puede venir { blocks, participation_id } o directamente un array "legacy"
  const participation_id: string | undefined = payload?.participation_id;

  let blocks: N8nItemCompat[] = [];
  if (Array.isArray(payload)) {
    if (payload.length && !("resultados" in (payload[0] as any))) {
      blocks = [{ q: "", resultados: payload as any[] } as N8nItemCompat];
    } else {
      blocks = payload as N8nItemCompat[];
    }
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.blocks)) {
      blocks = payload.blocks as N8nItemCompat[];
    } else if (Array.isArray(payload.resultados) || Array.isArray(payload.results)) {
      blocks = [{
        q: payload.query ?? payload.q ?? "",
        resultados: Array.isArray(payload.resultados) ? payload.resultados : (payload.results ?? []),
      }];
    }
  }

  if (!blocks.length) {
    return NextResponse.json({ ok: false, error: "empty-payload" }, { status: 400 });
  }

  // === Derivar IA (tomamos el primer resultado con info IA, si existe) ===
  const flatResults: AnyObj[] = blocks.flatMap(b => b.resultados || []);
  const best = flatResults.find(r => pickFirst(r, ["comentario_ia", "ia_comment", "ia_comentario"]) || pickFirst(r, ["sugerencia_regla", "suggestion", "sugerencia"]));
  const first = flatResults[0];

  const iaComentarioText = s(
    (best && pickFirst(best, ["comentario_ia", "ia_comment", "ia_comentario"])) ||
    ""
  );
  const sugerenciaNueva = s(
    (best && pickFirst(best, ["sugerencia_regla", "suggestion", "sugerencia"])) ||
    ""
  ) || null;

  // Rank (si viene)
  const rank_pos = (best && pickFirst(best, ["rank", "posicion", "puesto"], x => i(x, null as any))) as number | null
    ?? (first && pickFirst(first, ["rank", "posicion", "puesto"], x => i(x, null as any))) as number | null
    ?? null;

  const rank_total = (best && pickFirst(best, ["total_proveedores", "total", "resultado_total", "providers_total", "cant_proveedores"], x => i(x, null as any))) as number | null
    ?? (first && pickFirst(first, ["total_proveedores", "total", "resultado_total", "providers_total", "cant_proveedores"], x => i(x, null as any))) as number | null
    ?? null;

  const now = new Date();

  // === Si viene participation_id, MERGE directo sobre esa fila ===
  if (participation_id) {
    const prev = await prisma.cotizacionParticipacion.findUnique({
      where: { id: participation_id },
      select: { comentario: true, sugerencia: true },
    });

    if (!prev) {
      // Si la id es inválida, seguimos por la ruta legacy más abajo
    } else {
      // Comentario: si hay IA, la ponemos arriba y preservamos lo anterior
      const comentarioGenerado = first ? buildComentario(first) : "";
      const comentarioMerged = iaComentarioText
        ? (prev.comentario ? `IA: ${iaComentarioText}\n\n${prev.comentario}` : `IA: ${iaComentarioText}`)
        : (prev.comentario || comentarioGenerado || null);

      await prisma.cotizacionParticipacion.update({
        where: { id: participation_id },
        data: {
          fecha: now,
          accion: "Participación",
          resultado: rank_pos != null && rank_total != null ? `Participación (Ranking: ${rank_pos}/${rank_total})` : "Participación",
          comentario: comentarioMerged ?? undefined,
          sugerencia: sugerenciaNueva ?? prev.sugerencia ?? null,
          rank_pos,
          rank_total,
        },
      });

      return NextResponse.json({ ok: true, merged: true, touched: 1 });
    }
  }

  // === Fallback legacy: vincular por proveedor/proyecto reciente (72h) ===
  let touched = 0;
  await prisma.$transaction(async (tx) => {
    for (const block of blocks) {
      const q = s(block.query) || s(block.q) || s(block.filtro) || s(block.search);
      if (!q) continue;
      const proyectoName = `Cotización: ${q}`;

      for (const r of (block.resultados ?? [])) {
        const proveedor_id =
          s(pickFirst(r, ["proveedor_id", "proveedorId", "id_proveedor", "cliente_id", "user_id", "owner_id"]));
        if (!proveedor_id) continue;

        const r_pos = pickFirst(r, ["rank", "posicion", "puesto"], (x) => i(x, null as any)) as number | null;
        const r_tot = pickFirst(r, ["total_proveedores", "total", "resultado_total", "providers_total", "cant_proveedores"], (x) => i(x, null as any)) as number | null;

        const resultadoBase = s(pickFirst(r, ["resultado", "status", "state"]) || "Participación");
        const rankTxt = r_pos != null && r_tot != null ? ` (Ranking: ${r_pos}/${r_tot})` : "";
        const resultado = `${resultadoBase}${rankTxt}`.trim();

        const comentarioIa = s(pickFirst(r, ["comentario_ia", "ia_comment", "ia_comentario"]) || "");
        const comentarioGenerado = buildComentario(r);
        const comentarioNuevo = comentarioIa || comentarioGenerado;
        const sugerenciaNuevaLocal = s(pickFirst(r, ["sugerencia_regla", "suggestion", "sugerencia"]) || "") || null;

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
              sugerencia: sugerenciaNuevaLocal ?? prev.sugerencia ?? null,
              rank_pos: r_pos,
              rank_total: r_tot,
            },
          });
          touched++;
        } else {
          await tx.cotizacionParticipacion.create({
            data: {
              proveedor_id,
              fecha: now,
              proyecto: proyectoName,
              accion: "Participación",
              resultado,
              comentario: comentarioNuevo,
              sugerencia: sugerenciaNuevaLocal,
              rank_pos: r_pos,
              rank_total: r_tot,
            },
          });
          touched++;
        }
      }
    }
  });

  return NextResponse.json({ ok: true, merged: false, touched });
}
