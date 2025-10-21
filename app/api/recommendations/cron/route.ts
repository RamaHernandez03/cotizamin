// app/api/recommendations/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const CONCURRENCY = Number(process.env.RECO_CRON_CONCURRENCY ?? 4);

/**
 * Itera todos los id_cliente en páginas usando cursor.
 * Tipado explícito para evitar TS7022.
 */
async function* iterClienteIds(batchSize = 500): AsyncGenerator<string, void, unknown> {
  let cursor: string | null = null;

  for (;;) {
    const page: Array<{ id_cliente: string }> = await prisma.cliente.findMany({
      select: { id_cliente: true },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id_cliente: cursor } } : {}),
      orderBy: { id_cliente: "asc" },
    });

    if (page.length === 0) break;

    for (const row of page) {
      yield row.id_cliente;
    }

    cursor = page[page.length - 1].id_cliente;
  }
}

/**
 * Llama a refresh-if-stale (24h) para un cliente.
 */
async function refreshIfStale(origin: string, cliente_id: string): Promise<void> {
  const res = await fetch(`${origin}/api/recommendations/refresh-if-stale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id, thresholdHours: 24 }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`refresh-if-stale failed for ${cliente_id}: ${res.status}`);
  }
}

/**
 * Cron GET: pagina clientes y procesa con concurrencia limitada.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const startedAt = Date.now();

  let total = 0;
  let processedOk = 0;
  let processedErr = 0;

  // Pool de concurrencia simple
  const executing = new Set<Promise<void>>();

  for await (const cliente_id of iterClienteIds(500)) {
    total++;

    const task = refreshIfStale(origin, cliente_id)
      .then(() => { processedOk++; })
      .catch(() => { processedErr++; });

    executing.add(task);

    // liberar cuando termine
    task.finally(() => {
      executing.delete(task);
    });

    // backpressure: si llegamos al límite, esperamos a que termine alguna
    if (executing.size >= CONCURRENCY) {
      await Promise.race(executing);
    }
  }

  // drenar las pendientes
  await Promise.allSettled(Array.from(executing));

  const ms = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    total,
    processed_ok: processedOk,
    processed_err: processedErr,
    ms,
    concurrency: CONCURRENCY,
  });
}
