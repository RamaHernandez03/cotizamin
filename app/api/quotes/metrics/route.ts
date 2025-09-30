// app/api/quotes/metrics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // si tu export es default, cambiá a: import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { startOfDay } from "date-fns";

type MetricsOut = {
  probabilidad_venta_pct: number;
  precios_a_mejorar: number;
  total_participaciones: number;
};

function extractPct(comment?: string): number | null {
  const m = (comment || "").match(/pctl=([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : null;
}

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }

  const prov = await prisma.cliente.findUnique({
    where: { email: session.user.email },
    select: { id_cliente: true },
  });
  if (!prov) {
    return NextResponse.json({ ok: false, error: "no-provider" }, { status: 404 });
  }

  const today = startOfDay(new Date());

  // Prisma devuelve T | null
  const m = await prisma.quoteMetricsDaily.findUnique({
    where: { quote_metrics_unique: { proveedor_id: prov.id_cliente, fecha: today } },
  });

  let out: MetricsOut;

  if (m) {
    out = {
      probabilidad_venta_pct: m.pct_aceptacion,
      precios_a_mejorar: m.pendientes_evaluacion,
      total_participaciones: m.total_participaciones,
    };
  } else {
    // Fallback on-the-fly desde historial (últimos 180 días)
    const since = new Date();
    since.setDate(since.getDate() - 180);

    const rows = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: prov.id_cliente, fecha: { gte: since } },
      select: { resultado: true, comentario: true },
    });

    const total = rows.length;
    const probables = rows.filter(
      (r) => (r.resultado || "").toLowerCase() === "probable"
    ).length;
    const probabilidad_venta_pct = total ? Math.round((100 * probables) / total) : 0;

    const precios_mejorar = rows.filter((r) => {
      const res = (r.resultado || "").toLowerCase();
      if (res === "improbable") return true;
      const p = extractPct(r.comentario || "");
      return p != null && p > 40;
    }).length;

    out = {
      probabilidad_venta_pct,
      precios_a_mejorar: precios_mejorar,
      total_participaciones: total,
    };
  }

  return NextResponse.json({ ok: true, ...out });
}
