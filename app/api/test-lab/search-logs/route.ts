// app/api/test-lab/search-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const raw = process.env.TEST_LAB_ALLOWED_EMAILS || "";
    const allow = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!allow.includes(email)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    // Obtener búsquedas de los últimos 30 días agrupadas por descripción
    const searchLogs = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        "q" AS descripcion,
        COUNT(*)::int AS total_busquedas,
        STRING_AGG(DISTINCT "marca", ', ') AS marcas,
        STRING_AGG(DISTINCT "material", ', ') AS materiales,
        MAX("createdAt") AS ultima_busqueda,
        COUNT(DISTINCT "user_id")::int AS usuarios_unicos
      FROM "ProductSearchLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY "q"
      ORDER BY COUNT(*) DESC, "q"
      LIMIT $1 OFFSET $2
      `,
      limit,
      offset
    );

    // Total de búsquedas únicas en últimos 30 días
    const [totalCount] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(DISTINCT "q")::int AS total
      FROM "ProductSearchLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      `
    );

    // Total de búsquedas (eventos)
    const [totalEvents] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*)::int AS total
      FROM "ProductSearchLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      `
    );

    return NextResponse.json({
      ok: true,
      total_unique: totalCount?.total || 0,
      total_events: totalEvents?.total || 0,
      rows: searchLogs || [],
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}