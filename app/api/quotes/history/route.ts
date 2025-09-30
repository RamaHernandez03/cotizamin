// app/api/quotes/history/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ ok:false, error:"unauth" }, { status: 401 });

  // Busca proveedor_id por email (ajustá si lo resolvés distinto)
  const prov = await prisma.cliente.findUnique({ where: { email: session.user.email }, select: { id_cliente: true } });
  if (!prov) return NextResponse.json({ ok:false, error:"no-provider" }, { status: 404 });

  const rows = await prisma.cotizacionParticipacion.findMany({
    where: { proveedor_id: prov.id_cliente },
    orderBy: { fecha: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok:true, items: rows });
}
