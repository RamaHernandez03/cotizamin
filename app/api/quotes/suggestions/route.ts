import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const proveedor_id = req.nextUrl.searchParams.get("proveedor_id");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 10), 50);
  if (!proveedor_id) return NextResponse.json({ ok:false, error:"proveedor_id required" }, { status:400 });

  const suggestions = await prisma.quoteSuggestion.findMany({
    where: { proveedor_id },
    orderBy: { fecha: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok:true, proveedor_id, suggestions });
}
