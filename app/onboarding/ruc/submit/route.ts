// app/onboarding/ruc/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function isValidRuc11(v: string) {
  return /^\d{11}$/.test(v);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const ruc = String(formData.get("ruc") || "").trim();

    if (!isValidRuc11(ruc)) {
      return NextResponse.json({ ok: false, error: "RUC inválido: deben ser 11 dígitos" }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({ where: { email } });
    if (!cliente) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    if (cliente.ruc_locked) {
      return NextResponse.json({ ok: false, error: "El RUC ya está bloqueado y no puede modificarse" }, { status: 400 });
    }

    // Chequear que no exista otro cliente con el mismo RUC
    const dupe = await prisma.cliente.findFirst({
      where: { ruc, NOT: { id_cliente: cliente.id_cliente } },
      select: { id_cliente: true },
    });
    if (dupe) {
      return NextResponse.json({ ok: false, error: "Ese RUC ya está registrado" }, { status: 409 });
    }

    await prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente },
      data: { ruc, ruc_locked: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("onboarding ruc error:", e);
    return NextResponse.json({ ok: false, error: "Error guardando RUC" }, { status: 500 });
  }
}
