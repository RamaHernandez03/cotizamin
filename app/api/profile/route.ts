import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: (session.user as any).id },
    select: {
      nombre: true, ruc: true, email: true, telefono: true,
      avatar_url: true,
    },
  });

  return NextResponse.json(cliente ? {
    ...cliente,
    avatarUrl: cliente.avatar_url, // alias para el front
  } : null);
}
