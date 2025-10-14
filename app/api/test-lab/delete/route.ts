// app/api/test-lab/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const raw = process.env.TEST_LAB_ALLOWED_EMAILS || "";
    const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allow.includes(email)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    // Nota:
    // - Producto -> FK a Cliente (sin cascade): se BORRA antes.
    // - ConversationParticipant.user -> onDelete: Cascade (se borran al borrar Cliente).
    // - Message.sender -> onDelete: SetNull (lo seteamos a null para no depender).
    // - Resto de tablas usan proveedor_id (string, sin FK), no bloquean.

    await prisma.$transaction(async (tx) => {
      // 1) Null sender en mensajes del cliente (por si acaso)
      await tx.$executeRawUnsafe(
        `UPDATE "Message" SET "senderId" = NULL WHERE "senderId" = $1`,
        id
      );

      // 2) Borrar productos del cliente
      await tx.$executeRawUnsafe(
        `DELETE FROM "Producto" WHERE "proveedor_id" = $1`,
        id
      );

      // 3) Borrar participantes chat del cliente (por si queremos limpiar antes)
      await tx.$executeRawUnsafe(
        `DELETE FROM "ConversationParticipant" WHERE "userId" = $1`,
        id
      );

      // 4) Borrar cliente
      await tx.$executeRawUnsafe(
        `DELETE FROM "Cliente" WHERE "id_cliente" = $1`,
        id
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}
