// app/api/recommendations/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidateTag, revalidatePath } from "next/cache";

// 👇 helper: deducir prioridad por emoji/palabra
function inferPrioridad(m: string | undefined) {
  const s = (m || "").toLowerCase();
  if (s.includes("🔴") || s.includes("critico") || s.includes("crítico")) return "alta";
  if (s.includes("🟡") || s.includes("atención") || s.includes("ajustar")) return "media";
  return "baja"; // 🟢 u OK
}

// 👇 helper: deducir tipo rápido (puedes sofisticarlo luego)
function inferTipo(m: string | undefined) {
  const s = (m || "").toLowerCase();
  if (s.includes("precio")) return "Precio";
  if (s.includes("stock")) return "Stock";
  if (s.includes("competencia") || s.includes("comparable")) return "Mercado";
  return "General";
}

// 👇 tu normalizador, extendido para el payload de ejemplo
function normalizeN8N(raw: any) {
  let payload: any = raw?.response?.response ?? raw?.response ?? raw;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  const recos = Array.isArray(payload.recomendaciones) ? payload.recomendaciones : [];

  // mapeo al esquema que guardamos
  const recomendaciones = recos.map((r: any) => {
    const mensaje = r.comentario_ia ?? r.mensaje ?? "";
    const producto = r.producto
      ? `${r.producto}${r.marca ? ` · ${r.marca}` : ""}`
      : (r.producto ?? null);
    return {
      tipo: r.tipo ?? inferTipo(mensaje),
      mensaje,
      producto,
      prioridad: r.prioridad ?? inferPrioridad(mensaje),
    };
  });

  return {
    ok: true,
    cliente_id: payload.cliente_id ?? null,
    fecha_analisis: payload.fecha_analisis ? new Date(payload.fecha_analisis) : null,
    total: recomendaciones.length,
    resumen: payload.resumen ?? {},
    recomendaciones,
  };
}

export async function POST(req: NextRequest) {
  const { cliente_id } = await req.json();
  if (!cliente_id) {
    return NextResponse.json({ ok: false, error: "cliente_id required" }, { status: 400 });
  }

  const base = process.env.N8N_BASE_URL!;
  const path = process.env.N8N_RECO_PATH || "/webhook/recomendacion";

  const n8nRes = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id }),
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });

  if (!n8nRes.ok) {
    return NextResponse.json({ ok: false, error: `n8n ${n8nRes.status}` }, { status: 502 });
  }

  const normalized = normalizeN8N(await n8nRes.json());

  // 💾 Persistir en transacción
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
          producto: r.producto,
          prioridad: r.prioridad,
        })),
      });
    }

    return batch;
  });

  // 🔄 Invalidaciones
  revalidateTag(`proveedor:${cliente_id}:home`);
  revalidatePath("/dashboard/home");

  return NextResponse.json({ ok: true, refreshedBatchId: created.id });
}
