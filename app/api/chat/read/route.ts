// app/api/chat/read/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u?.id) return NextResponse.json({ ok:false, error:"No auth" }, { status: 401 });

  const { conversationId } = await req.json();
  if (!conversationId) return NextResponse.json({ ok:false, error:"Bad request" }, { status: 400 });

  // Seguridad: verificar participación
  const isParticipant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: u.id }, select: { id: true }
  });
  if (!isParticipant) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

  const now = new Date();
  await prisma.message.updateMany({
    where: { conversationId, readAt: null, NOT: { senderId: u.id } },
    data: { readAt: now },
  });

  return NextResponse.json({ ok:true });
}
