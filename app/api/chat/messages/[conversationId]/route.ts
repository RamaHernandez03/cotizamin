// app/api/chat/messages/[conversationId]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { conversationId: string } }) {
  const u = await getSessionUser();
  if (!u?.id) return NextResponse.json({ ok:false, error:"No auth" }, { status: 401 });

  const { conversationId } = params;

  const isParticipant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: u.id }, select: { id: true }
  });
  if (!isParticipant) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  return NextResponse.json({ ok:true, items: messages });
}
