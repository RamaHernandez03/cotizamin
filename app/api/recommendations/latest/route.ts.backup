import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cliente_id = searchParams.get("cliente_id");
  if (!cliente_id) return NextResponse.json({ ok:false, error:"cliente_id required" }, { status:400 });

  const batch = await prisma.recommendationBatch.findFirst({
    where: { cliente_id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, fecha_analisis: true, total: true },
  });

  const payload = batch ? {
    ok: true,
    batchId: batch.id,
    createdAt: batch.createdAt.toISOString(),
    total: batch.total,
    fecha_analisis: batch.fecha_analisis?.toISOString() ?? null,
  } : { ok:true, batchId:null, createdAt:null, total:0, fecha_analisis:null };

  const res = NextResponse.json(payload, { status: 200 });
  if (batch) {
    const etag = `"${batch.id}.${batch.total}.${+batch.createdAt}"`;
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'max-age=30, stale-while-revalidate=120');
  }
  return res;
}

