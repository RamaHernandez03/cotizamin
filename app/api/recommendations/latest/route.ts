// app/api/recommendations/latest/route.ts
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Caché en memoria (simple pero efectivo)
const cache = new Map<string, { data: any; timestamp: number; etag: string }>();
const CACHE_TTL = 30000; // 30 segundos

export async function GET(req: NextRequest) {
  // ⛔️ Requiere usuario autenticado
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  if (!sessionUserId) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
    });
  }

  const { searchParams } = new URL(req.url);
  const cliente_id = searchParams.get("cliente_id");

  if (!cliente_id) {
    const res = NextResponse.json(
      { ok: false, error: "cliente_id required" },
      { status: 400 }
    );
    res.headers.set("Vary", "Cookie");
    return res;
  }

  // 🔒 Anti-IDOR: el cliente_id del query debe ser el mismo de la sesión
  if (cliente_id !== sessionUserId) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
    });
  }

  const cacheKey = `latest:${cliente_id}`;
  const now = Date.now();

  // 1. Verificar caché en memoria
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    // Validación condicional con ETag
    const clientETag = req.headers.get("if-none-match");
    if (clientETag === cached.etag) {
      const res304 = new NextResponse(null, {
        status: 304,
        headers: {
          ETag: cached.etag,
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
          Vary: "Cookie",
        },
      });
      return res304;
    }

    const res = NextResponse.json(cached.data);
    res.headers.set("ETag", cached.etag);
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    res.headers.set("X-Cache", "HIT");
    res.headers.set("Vary", "Cookie");
    return res;
  }

  // 2. Query a la base de datos (solo si cache expiró)
  try {
    const batch = await prisma.recommendationBatch.findFirst({
      where: { cliente_id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        fecha_analisis: true,
        total: true,
      },
    });

    const payload = batch
      ? {
          ok: true,
          batchId: batch.id,
          createdAt: batch.createdAt.toISOString(),
          total: batch.total,
          fecha_analisis: batch.fecha_analisis?.toISOString() ?? null,
        }
      : {
          ok: true,
          batchId: null,
          createdAt: null,
          total: 0,
          fecha_analisis: null,
        };

    // Generar ETag único basado en contenido
    const etag = batch
      ? `"${batch.id}.${batch.total}.${+batch.createdAt}"`
      : `"empty.${now}"`;

    // 3. Actualizar caché en memoria
    cache.set(cacheKey, {
      data: payload,
      timestamp: now,
      etag,
    });

    // 4. Limpiar caché viejo (cada 100 requests)
    if (Math.random() < 0.01) {
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL * 2) {
          cache.delete(key);
        }
      }
    }

    const res = NextResponse.json(payload);
    res.headers.set("ETag", etag);
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    res.headers.set("X-Cache", "MISS");
    res.headers.set("Vary", "Cookie");
    return res;
  } catch (error) {
    console.error("[latest] Database error:", error);
    const res = NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
    res.headers.set("Vary", "Cookie");
    return res;
  }
}
