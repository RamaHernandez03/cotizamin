// app/api/test-lab/list/route.ts
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
    const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allow.includes(email)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const whereSql = q
      ? `
        WHERE 
          c.email ILIKE '%' || $1 || '%'
          OR c.nombre ILIKE '%' || $1 || '%'
          OR c.ruc ILIKE '%' || $1 || '%'
      `
      : "";

    const args = q ? [q, limit, offset] : [limit, offset];

    // Total de filas
    const totalRows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `
      SELECT COUNT(*)::text AS count
      FROM "Cliente" c
      ${q ? "WHERE c.email ILIKE '%' || $1 || '%' OR c.nombre ILIKE '%' || $1 || '%' OR c.ruc ILIKE '%' || $1 || '%'" : ""}
      `,
      ...(q ? [q] : [])
    );
    const total = Number(totalRows?.[0]?.count || 0);

    // Datos principales + última sesión
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        c.id_cliente,
        c.email,
        c.nombre,
        c.ruc,
        c.fecha_registro,
        COALESCE(p.cnt, 0) AS productos_count,
        p.last_stock AS ultima_actualizacion_stock,
        s.last_session AS ultima_sesion
      FROM "Cliente" c
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt, MAX(pr."fecha_actualizacion") AS last_stock
        FROM "Producto" pr
        WHERE pr."proveedor_id" = c.id_cliente
      ) p ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(se."expires") AS last_session
        FROM "User" u
        JOIN "Session" se ON se."userId" = u.id
        WHERE u.email = c.email
      ) s ON TRUE
      ${whereSql}
      ORDER BY c."fecha_registro" DESC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
      `,
      ...args
    );

    return NextResponse.json({ ok: true, total, rows });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}
