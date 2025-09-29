import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const proveedor_id = req.nextUrl.searchParams.get("proveedor_id");
  if (!proveedor_id) return NextResponse.json({ ok:false, error:"proveedor_id required" }, { status:400 });

  const m = await prisma.quoteMetricsDaily.findFirst({
    where: { proveedor_id },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ ok:true, proveedor_id, metrics: m ?? null });
}
