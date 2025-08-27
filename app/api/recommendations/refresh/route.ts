// app/api/recommendations/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function normalizeN8N(raw: any) {
  let payload: any = raw?.response?.response ?? raw?.response ?? raw;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = { recomendaciones: [], resumen: {} }; }
  }
  const recos = Array.isArray(payload.recomendaciones) ? payload.recomendaciones : [];
  return {
    ok: payload.ok ?? true,
    cliente_id: payload.cliente_id ?? null,
    fecha_analisis: payload.fecha_analisis ? new Date(payload.fecha_analisis) : null,
    total: recos.length,
    resumen: payload.resumen ?? {},
    recomendaciones: recos,
  };
}

export async function POST(req: NextRequest) {
  const { cliente_id } = await req.json();
  if (!cliente_id) return NextResponse.json({ ok: false, error: "cliente_id required" }, { status: 400 });

  const base = process.env.N8N_BASE_URL!;
  const path = process.env.N8N_RECO_PATH || "/webhook/recomendacion";

  const n8nRes = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id }),
    cache: "no-store",
  });

  if (!n8nRes.ok) {
    return NextResponse.json({ ok: false, error: `n8n ${n8nRes.status}` }, { status: 502 });
  }

  const normalized = normalizeN8N(await n8nRes.json());

  // Persistir batch + items (transacción)
  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.recommendationBatch.create({
      data: {
        cliente_id,
        fecha_analisis: normalized.fecha_analisis,
        nota_general: normalized.resumen?.nota_general ?? null,
        total: normalized.total,
      },
    });

    if (normalized.recomendaciones.length) {
      await tx.recommendationItem.createMany({
        data: normalized.recomendaciones.map((r: any) => ({
          batchId: batch.id,
          tipo: r.tipo,
          mensaje: r.mensaje,
          producto: r.producto ?? null,
          prioridad: r.prioridad,
        })),
      });
    }

    return batch;
  });

  return NextResponse.json({ ok: true, refreshedBatchId: created.id });
}
