// app/api/recommendations/refresh-if-stale/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 horas

// Tracking de refreshes en progreso (en memoria)
const refreshInProgress = new Map<string, Promise<any>>();

export async function POST(req: NextRequest) {
  const { cliente_id, thresholdHours = 12 } = await req.json();
  
  if (!cliente_id) {
    return NextResponse.json(
      { ok: false, error: "cliente_id required" },
      { status: 400 }
    );
  }

  try {
    // 1. Check si ya hay un refresh en curso para este cliente
    const existingRefresh = refreshInProgress.get(cliente_id);
    if (existingRefresh) {
      // Retornar inmediatamente, el refresh ya está corriendo
      return NextResponse.json(
        { ok: true, status: "refresh_in_progress" },
        { status: 202 }
      );
    }

    // 2. Verificar si está stale (usando índice optimizado)
    const latest = await prisma.recommendationBatch.findFirst({
      where: { cliente_id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    const isStale = !latest || 
      (Date.now() - latest.createdAt.getTime()) > (thresholdHours * 3600000);

    if (!isStale) {
      return NextResponse.json({
        ok: true,
        status: "fresh",
        batchId: latest?.id ?? null,
      });
    }

    // 3. Iniciar refresh asíncrono con lock distribuido
    const origin = new URL(req.url).origin;
    const refreshPromise = performRefresh(cliente_id, origin);
    
    // Guardar promesa para prevenir refreshes duplicados
    refreshInProgress.set(cliente_id, refreshPromise);

    // Limpiar después de completar (o 5 minutos máximo)
    refreshPromise.finally(() => {
      setTimeout(() => {
        refreshInProgress.delete(cliente_id);
      }, 5000);
    });

    // 4. Retornar inmediatamente sin esperar
    return NextResponse.json(
      { ok: true, status: "refresh_started" },
      { status: 202 }
    );

  } catch (error) {
    console.error("[refresh-if-stale] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

async function performRefresh(cliente_id: string, origin: string) {
  let lockAcquired = false;

  try {
    // 1. Intentar adquirir lock (con timeout de 1 segundo)
    const lockResult = await Promise.race([
      prisma.$executeRawUnsafe(
        `SELECT pg_try_advisory_lock(hashtext($1))`,
        cliente_id
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Lock timeout")), 1000)
      ),
    ]) as any;

    // Si no se pudo adquirir el lock, otro proceso ya está refrescando
    if (!lockResult || !lockResult[0]?.pg_try_advisory_lock) {
      console.log(`[refresh] Lock already held for ${cliente_id}`);
      return;
    }

    lockAcquired = true;

    // 2. Double-check si sigue siendo necesario el refresh
    const latest = await prisma.recommendationBatch.findFirst({
      where: { cliente_id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latest && Date.now() - latest.createdAt.getTime() < STALE_THRESHOLD_MS) {
      console.log(`[refresh] No longer stale for ${cliente_id}`);
      return;
    }

    // 3. Ejecutar refresh real
    console.log(`[refresh] Starting refresh for ${cliente_id}`);
    
    const response = await fetch(`${origin}/api/recommendations/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id }),
      signal: AbortSignal.timeout(60000), // 60 segundos timeout
    });

    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.status}`);
    }

    console.log(`[refresh] Completed for ${cliente_id}`);

  } catch (error) {
    console.error(`[refresh] Error for ${cliente_id}:`, error);
  } finally {
    // 4. Liberar lock siempre
    if (lockAcquired) {
      try {
        await prisma.$executeRawUnsafe(
          `SELECT pg_advisory_unlock(hashtext($1))`,
          cliente_id
        );
      } catch (unlockError) {
        console.error(`[refresh] Failed to unlock for ${cliente_id}`, unlockError);
      }
    }
  }
}