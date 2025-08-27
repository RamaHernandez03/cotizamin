// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cliente_id = req.nextUrl.searchParams.get("cliente_id");
  if (!cliente_id) {
    return NextResponse.json({ ok: false, error: "cliente_id required" }, { status: 400 });
  }

  const batch = await prisma.recommendationBatch.findFirst({
    where: { cliente_id },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (!batch) {
    return NextResponse.json({
      ok: true,
      cliente_id,
      fecha_analisis: null,
      total_recomendaciones: 0,
      recomendaciones: [],
      resumen: { nota_general: null },
      cached: true,
    });
  }

  return NextResponse.json({
    ok: true,
    cliente_id,
    fecha_analisis: batch.fecha_analisis?.toISOString() ?? null,
    total_recomendaciones: batch.total,
    recomendaciones: batch.items.map(i => ({
      tipo: i.tipo as "precio" | "stock" | "perfil",
      mensaje: i.mensaje,
      producto: i.producto,
      prioridad: i.prioridad as "alta" | "media" | "baja",
    })),
    resumen: { nota_general: batch.nota_general ?? undefined },
    cached: true,
    cachedAt: batch.createdAt.toISOString(),
  });
}
