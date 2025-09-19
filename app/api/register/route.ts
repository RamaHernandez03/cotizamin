// app/api/Register/route.ts
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { isValidEmail, isValidRucSimple /* , isValidCuit */ } from "@/lib/validators";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const { nombre, ruc, email, password } = await req.json();

    // Campos requeridos
    if (!email || !password || !nombre || !ruc) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    // Validaciones
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // RUC: simple 11 dígitos (cambiá si querés CUIT)
    if (!isValidRucSimple(ruc, 11)) {
      // if (!isValidCuit(ruc)) { ... } // ← alternativo Argentina
      return NextResponse.json({ error: "RUC inválido (11 dígitos)" }, { status: 400 });
    }

    // Unicidad
    const [clientePorEmail, clientePorRuc] = await Promise.all([
      prisma.cliente.findUnique({ where: { email } }),
      prisma.cliente.findFirst({ where: { ruc } }),
    ]);
    if (clientePorEmail) return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
    if (clientePorRuc)   return NextResponse.json({ error: "Ese RUC ya está registrado" }, { status: 400 });

    // Crear cliente
    const hashedPassword = await hash(password, 10);
    const nuevoCliente = await prisma.cliente.create({
      data: {
        id_cliente: crypto.randomUUID(),
        nombre,
        ruc,
        email,
        password: hashedPassword,
        fecha_registro: new Date(),
        ruc_locked: true,        // tu lógica
        email_verificado: null,  // aún no verificado
    }});

    // Crear token de verificación usando el modelo de NextAuth
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const verifyUrl = `${baseUrl}/api/register/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // Enviar correo
    await sendVerificationEmail(email, verifyUrl);

    return NextResponse.json({
      success: true,
      message: "¡Listo! Te enviamos un email para confirmar tu cuenta.",
      cliente: { id_cliente: nuevoCliente.id_cliente, email: nuevoCliente.email },
    });
  } catch (err) {
    console.error("Error en registro:", err);
    return NextResponse.json({ error: "Error registrando usuario" }, { status: 500 });
  }
}
