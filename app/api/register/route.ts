import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  const { nombre, ruc, email, password } = await req.json();

  if (!email || !password || !nombre || !ruc) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const clientePorEmail = await prisma.cliente.findUnique({ where: { email } });
  if (clientePorEmail) {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
  }

  const clientePorRuc = await prisma.cliente.findFirst({ where: { ruc } });
  if (clientePorRuc) {
    return NextResponse.json({ error: "Ese RUC ya está registrado" }, { status: 400 });
  }

  const hashedPassword = await hash(password, 10);

  const nuevoCliente = await prisma.cliente.create({
    data: {
      id_cliente: crypto.randomUUID(),
      nombre,
      ruc,
      email,
      password: hashedPassword,
      fecha_registro: new Date(),
      ruc_locked: true, // 🔒 ya queda bloqueado en registro por credenciales
    },
  });

  return NextResponse.json({ success: true, cliente: nuevoCliente });
}
