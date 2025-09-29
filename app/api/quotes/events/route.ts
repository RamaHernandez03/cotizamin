import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const proveedor_id = req.nextUrl.searchParams.get("proveedor_id");
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  if (!proveedor_id) return NextResponse.json({ ok:false, error:"proveedor_id required" }, { status:400 });

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id },
      orderBy: { fecha: "desc" },
      skip, take: limit,
      select: { id:true, fecha:true, proyecto:true, accion:true, resultado:true, comentario:true, sugerencia:true },
    }),
    prisma.cotizacionParticipacion.count({ where: { proveedor_id } })
  ]);

  return NextResponse.json({ ok:true, proveedor_id, page, limit, total, rows });
}
