// app/api/chat/cleanup/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const DAYS = 7;

export async function POST(req: Request) {
  const token = req.headers.get("x-cleanup-token") || "";
  if (!process.env.CHAT_CLEANUP_TOKEN || token !== process.env.CHAT_CLEANUP_TOKEN) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000);

  // Buscamos conversaciones vencidas
  const expired = await prisma.conversation.findMany({
    where: { createdAt: { lt: threshold } },
    select: { id: true },
    take: 10000, // protección
  });

  if (expired.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  // Borramos en cascada (Message ya está en cascade)
  const ids = expired.map((c) => c.id);

  await prisma.conversationParticipant.deleteMany({
    where: { conversationId: { in: ids } },
  });

  const del = await prisma.conversation.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ ok: true, deleted: del.count });
}
