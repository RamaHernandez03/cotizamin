// app/api/test-lab/items/route.ts
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
    const clienteId = searchParams.get("clienteId");
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    if (!clienteId) {
      return NextResponse.json({ ok: false, error: "Missing clienteId" }, { status: 400 });
    }

    const filterSql = q
      ? `AND (pr."descripcion" ILIKE '%' || $2 || '%' OR pr."codigo_interno" ILIKE '%' || $2 || '%')`
      : "";

    const totalRows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `
      SELECT COUNT(*)::text AS count
      FROM "Producto" pr
      WHERE pr."proveedor_id" = $1
      ${q ? `AND (pr."descripcion" ILIKE '%' || $2 || '%' OR pr."codigo_interno" ILIKE '%' || $2 || '%')` : ""}
      `,
      ...(q ? [clienteId, q] as any[] : [clienteId] as any[])
    );
    const total = Number(totalRows?.[0]?.count || 0);

    const args = q ? [clienteId, q, limit, offset] : [clienteId, limit, offset];

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        pr.id_producto,
        pr.codigo_interno,
        pr.descripcion,
        pr.marca,
        pr.modelo,
        pr.material,
        pr.moneda,
        pr.precio_actual,
        pr.stock_actual,
        pr.estado,
        pr.fecha_actualizacion
      FROM "Producto" pr
      WHERE pr."proveedor_id" = $1
      ${filterSql}
      ORDER BY pr."fecha_actualizacion" DESC
      LIMIT $${q ? 3 : 2} OFFSET $${q ? 4 : 3}
      `,
      ...args
    );

    return NextResponse.json({ ok: true, total, rows });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}
