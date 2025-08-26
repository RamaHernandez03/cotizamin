// app/api/recommendations/context/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

function verifySig(req: NextRequest, secret: string, raw: string) {
  const sig = req.headers.get("x-signature") || "";
  const calc = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  // timingSafeEqual exige mismo largo
  if (sig.length !== calc.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(calc));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET || "";
  const raw = await req.text(); // leer raw para HMAC

  if (!secret || !verifySig(req, secret, raw)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { userId } = JSON.parse(raw);

  // Datos del usuario
  const user = await prisma.cliente.findUnique({
    where: { id_cliente: userId },
    select: { id_cliente: true, nombre: true, email: true, ruc: true },
  });

  // Catálogo resumido
  const props = await prisma.producto.findMany({
    take: 50,
    select: {
      id_producto: true,
      // nombre: true,   // ❌ no existe
      descripcion: true, // ✅ usa el campo real
      precio_actual: true,
      stock_actual: true,
      estado: true,
    },
  });

  return NextResponse.json({ user, props });
}
