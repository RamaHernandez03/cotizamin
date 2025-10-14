// app/api/test-lab/product-breakdown/route.ts
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
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

    // Agrupar por descripción única y calcular estadísticas
    const breakdown = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        pr."descripcion",
        COUNT(*)::int AS total_items,
        MIN(pr."precio_actual") AS min_price,
        MAX(pr."precio_actual") AS max_price,
        AVG(pr."precio_actual") AS avg_price,
        ARRAY_AGG(pr."precio_actual" ORDER BY pr."precio_actual") AS price_distribution,
        STRING_AGG(DISTINCT pr."marca", ', ') AS marcas,
        STRING_AGG(DISTINCT pr."material", ', ') AS materiales,
        COUNT(DISTINCT pr."proveedor_id")::int AS total_proveedores
      FROM "Producto" pr
      WHERE pr."descripcion" ILIKE '%' || $1 || '%'
      GROUP BY pr."descripcion"
      ORDER BY COUNT(*) DESC, pr."descripcion"
      LIMIT 100
      `,
      q
    );

    // Total de items encontrados
    const [totalCount] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*)::int AS total
      FROM "Producto"
      WHERE "descripcion" ILIKE '%' || $1 || '%'
      `,
      q
    );

    return NextResponse.json({
      ok: true,
      total_items: totalCount?.total || 0,
      breakdown: breakdown || [],
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}