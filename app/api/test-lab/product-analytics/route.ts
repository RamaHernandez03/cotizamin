// app/api/test-lab/product-analytics/route.ts
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

    const [agg] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        COUNT(*)::int AS total_items,
        MIN(pr."precio_actual") AS min_price,
        MAX(pr."precio_actual") AS max_price,
        AVG(pr."precio_actual") AS avg_price
      FROM "Producto" pr
      WHERE pr."descripcion" ILIKE '%' || $1 || '%'
      `,
      q
    );

    const [searches] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*)::int AS searches
      FROM "ProductSearchLog"
      WHERE "q" ILIKE '%' || $1 || '%'
      `,
      q
    );

    return NextResponse.json({
      ok: true,
      total_items: agg?.total_items || 0,
      min_price: agg?.min_price ?? null,
      max_price: agg?.max_price ?? null,
      avg_price: agg?.avg_price ?? null,
      searches: searches?.searches || 0,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}
