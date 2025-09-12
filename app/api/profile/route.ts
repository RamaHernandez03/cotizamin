import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clienteId = (session.user as any).id as string;
  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: clienteId },
  });

  return NextResponse.json(cliente ?? null);
}
