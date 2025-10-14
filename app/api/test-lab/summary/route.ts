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

    // Total de clientes
    const [totalClientes] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM "Cliente"`
    );

    // Total de productos
    const [totalProductos] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM "Producto"`
    );

    // Total de cotizaciones (todas)
    const [totalCotizaciones] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM "CotizacionParticipacion"`
    );

    // Total de búsquedas (desde ProductSearchLog)
    const [totalBusquedas] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM "ProductSearchLog"`
    );

    // Última actualización de stock
    const [lastStockUpdate] = await prisma.$queryRawUnsafe<{ fecha: Date | null }[]>(
      `SELECT MAX("fecha_actualizacion") AS fecha FROM "Producto"`
    );

    // Ventas en los últimos 30 días (cotizaciones aceptadas)
    const [ventas30d] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `
      SELECT COUNT(*)::int AS total
      FROM "CotizacionParticipacion"
      WHERE "resultado" = 'Aceptado'
      AND "fecha" >= NOW() - INTERVAL '30 days'
      `
    );

    return NextResponse.json({
      ok: true,
      total_clientes: totalClientes?.total || 0,
      total_productos: totalProductos?.total || 0,
      total_cotizaciones: totalCotizaciones?.total || 0,
      total_busquedas: totalBusquedas?.total || 0,
      last_stock_update: lastStockUpdate?.fecha || null,
      ventas_30d: ventas30d?.total || 0,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}