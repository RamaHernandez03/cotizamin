import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const updateData = {
    telefono: body.telefono,
    direccion: body.direccion,
    pais: body.pais,
    email_contacto: body.email_contacto,
    certificaciones: body.certificaciones,
  };

  try {
    const updated = await prisma.cliente.update({
      where: { id_cliente: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, cliente: updated });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
