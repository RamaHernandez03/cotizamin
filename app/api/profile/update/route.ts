import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// app/api/profile/update/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const updateData: any = {
    telefono: body.telefono,
    direccion: body.direccion,
    pais: body.pais,
    email_contacto: body.email_contacto,
    certificaciones: body.certificaciones,
  };

  if (body.avatarUrl !== undefined) {
  (updateData as any).avatar_url = body.avatarUrl || null;
}

  try {
    const updated = await prisma.cliente.update({
      where: { id_cliente: (session.user as any).id },
      data: updateData,
      select: {
        nombre: true, ruc: true, email: true, telefono: true, avatar_url: true,
      },
    });

    return NextResponse.json({ success: true, cliente: { ...updated, avatarUrl: updated.avatar_url } });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}

