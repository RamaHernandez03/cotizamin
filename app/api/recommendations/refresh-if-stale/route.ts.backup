// app/api/recommendations/refresh-if-stale/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const HRS = 1000 * 60 * 60;

// app/api/recommendations/refresh-if-stale/route.ts
export async function POST(req: NextRequest) {
  const { cliente_id, thresholdHours = 12 } = await req.json();
  if (!cliente_id) return NextResponse.json({ ok:false, error:"cliente_id required" }, { status:400 });

  const origin = new URL(req.url).origin;

  const latest = await prisma.recommendationBatch.findFirst({
    where: { cliente_id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });

  const isStale = !latest || (Date.now() - +latest.createdAt) > thresholdHours * 3600000;

  // responder rápido siempre; si no está stale, listo
  if (!isStale) return NextResponse.json({ ok:true, refreshed:false, batchId: latest?.id ?? null });

  // kick async (no await)
  queueMicrotask(async () => {
    try {
      await prisma.$executeRawUnsafe(`SELECT pg_advisory_lock(hashtext($1))`, cliente_id);
      await fetch(`${origin}/api/recommendations/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ cliente_id }),
      });
    } catch (e) {
      console.error('refresh-if-stale async error', e);
    } finally {
      await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(hashtext($1))`, cliente_id)
        .catch(() => {});
    }
  });

  return NextResponse.json({ ok:true, accepted:true }, { status:202 });
}

