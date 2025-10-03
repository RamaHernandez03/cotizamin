// app/api/sales/accepted/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // 👈 default import (tu lib exporta default)
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function extractDescAndCode(comentario?: string) {
  const c = comentario || "";
  const mDesc = c.match(/Producto:\s*([^•\n]+?)(?:•|$)/i);
  const mCode = c.match(/Código:\s*([^\s•\n]+)/i);
  return {
    descripcion: mDesc?.[1]?.trim() || null,
    codigo_interno: mCode?.[1]?.trim() || null,
  };
}

async function tableExists(name: string) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`SELECT to_regclass(${`public."${name}"`}) IS NOT NULL AS exists`;
    return !!rows?.[0]?.exists;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const u = await getSessionUser();
    if (!u?.id) {
      return NextResponse.json({ ok: false, error: "No auth" }, { status: 401 });
    }

    // 1) Participaciones aceptadas del proveedor
    const rows = await prisma.cotizacionParticipacion.findMany({
      where: {
        proveedor_id: String(u.id),
        resultado: { in: ["Aceptado", "Cotización seleccionada"] },
      },
      orderBy: { fecha: "desc" },
      select: {
        id: true,
        proveedor_id: true,
        fecha: true,
        proyecto: true,
        accion: true,
        resultado: true,
        comentario: true,
      },
      take: 200,
    });

    if (!rows.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    // 2) Conversaciones: sólo si existen tablas de chat
    const hasConversation = await tableExists("Conversation");
    const hasMessage = await tableExists("Message");
    let convByPart = new Map<string, string>();
    let unreadByConv = new Map<string, number>();

    if (hasConversation) {
      const ids = rows.map((r) => r.id);
      const convs = await prisma.conversation.findMany({
        where: { participationId: { in: ids } },
        select: { id: true, participationId: true },
      });
      convByPart = new Map(
        convs
          .filter((c) => !!c.participationId)
          .map((c) => [c.participationId as string, c.id])
      );

      if (hasMessage && convs.length) {
        const convIds = convs.map((c) => c.id);
        const unread = await prisma.message.groupBy({
          by: ["conversationId"],
          where: {
            conversationId: { in: convIds },
            readAt: null,
            NOT: { senderId: String(u.id) }, // mensajes no leídos por el proveedor
          },
          _count: { _all: true },
        });
        unreadByConv = new Map(
          unread.map((x) => [x.conversationId as string, x._count._all])
        );
      }
    }

    // 3) Armar payload
    const items = rows.map((r) => {
      const { descripcion, codigo_interno } = extractDescAndCode(r.comentario || undefined);
      const conversationId = convByPart.get(r.id) || null;
      const unreadCount = conversationId ? unreadByConv.get(conversationId) || 0 : 0;
      return {
        id: r.id,
        fecha: r.fecha,
        proyecto: r.proyecto,
        resultado: r.resultado,
        comentario: r.comentario || null,
        producto_desc: descripcion,
        codigo_interno,
        conversationId,
        unreadCount,
        cliente_user_id: null as string | null, // completar si luego linkeás al cliente-usuario
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error("[/api/sales/accepted] ERROR", e);
    // devolvemos TEXTO en 500 para que el cliente lo muestre con res.text()
    return new NextResponse(
      `Error interno /api/sales/accepted: ${e?.message ?? "unknown"}`,
      { status: 500 }
    );
  }
}
