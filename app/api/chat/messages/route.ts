// app/api/chat/messages/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u?.id) return NextResponse.json({ ok:false, error:"No auth" }, { status: 401 });

  const { conversationId, body } = await req.json();
  if (!conversationId || !body?.trim()) {
    return NextResponse.json({ ok:false, error:"Bad request" }, { status: 400 });
  }

  const isParticipant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: u.id }, select: { id: true }
  });
  if (!isParticipant) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

  const msg = await prisma.message.create({
    data: { conversationId, senderId: u.id, body: body.trim() }
  });

  return NextResponse.json({ ok:true, msg });
}
