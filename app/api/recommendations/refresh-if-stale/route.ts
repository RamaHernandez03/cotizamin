// app/api/recommendations/refresh-if-stale/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const HRS = 1000 * 60 * 60;

export async function POST(req: NextRequest) {
  const { cliente_id, thresholdHours = 12 } = await req.json();
  if (!cliente_id) {
    return NextResponse.json({ ok: false, error: "cliente_id required" }, { status: 400 });
  }

  // ✅ Derivá el origin del request (funciona en local y prod, detrás de proxy también)
  const origin = new URL(req.url).origin;

  const latest = await prisma.recommendationBatch.findFirst({
    where: { cliente_id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  const now = Date.now();
  const isStale = !latest || now - new Date(latest.createdAt).getTime() > thresholdHours * HRS;

  if (!isStale) {
    return NextResponse.json({ ok: true, refreshed: false, batchId: latest?.id ?? null });
  }

  // (opcional) ping a n8n vía tu notify-recos, también con origin derivado
  try {
    await fetch(`${origin}/api/notify-recos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ userId: cliente_id, event: "stale-refresh" }),
    });
  } catch {
    // seguimos aunque falle el ping
  }

  // 🔁 Refresh “fuerte” (persistencia)
  const res = await fetch(`${origin}/api/recommendations/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ cliente_id }),
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `refresh failed (${res.status})` }, { status: 502 });
  }

  const json = await res.json();
  return NextResponse.json({ ok: true, refreshed: true, ...json });
}
