// app/api/test-lab/summary/route.ts
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

    const [row] = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        (SELECT COUNT(*)::int FROM "Cliente") AS total_clientes,
        (SELECT COUNT(*)::int FROM "Producto") AS total_productos,
        (SELECT COUNT(*)::int FROM "CotizacionParticipacion") AS total_cotizaciones,
        (SELECT COUNT(*)::int FROM "ProductSearchLog") AS total_busquedas,
        (SELECT MAX("fecha_actualizacion") FROM "Producto") AS last_stock_update,
        (
          SELECT COUNT(*)::int 
          FROM "CotizacionParticipacion" 
          WHERE "fecha" >= NOW() - INTERVAL '30 days'
          AND "resultado" IN ('aceptado', 'ganado')
        ) AS ventas_30d
      `
    );

    return NextResponse.json({ ok: true, ...row });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}