// app/api/chat/conversations/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/chat/conversations
 * Lista las conversaciones del usuario autenticado, siempre en JSON.
 */
export async function GET() {
  try {
    const me = await getSessionUser().catch(() => null);
    if (!me?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Buscar cliente vinculado al usuario
    const myCliente =
      (await prisma.cliente.findUnique({
        where: { id_cliente: me.id },
        select: { id_cliente: true },
      })) ||
      (me.email
        ? await prisma.cliente.findUnique({
            where: { email: me.email },
            select: { id_cliente: true },
          })
        : null);

    if (!myCliente?.id_cliente) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const myId = myCliente.id_cliente;

    // ✅ Traemos la relación con CotizacionParticipacion
    const convs = await prisma.conversation.findMany({
      where: { participants: { some: { userId: myId } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        participants: {
          select: {
            userId: true,
            user: { select: { nombre: true, email: true } },
          },
        },
        participation: {
          select: {
            id: true,
            proyecto: true,
            comentario: true,
            resultado: true,
          },
        },
      },
    });

    const items = convs.map((c) => {
      const last = c.messages[0];
      const peer =
        c.participants.find((p) => p.userId !== myId) || c.participants[0] || null;

      return {
        id: c.id,
        // 🔹 Si existe el proyecto en la participación, úsalo como título base
        proyecto: c.participation?.proyecto || "Venta",
        peerName: peer?.user?.nombre || peer?.user?.email || null,
        lastMessage: last?.body || null,
        unreadCount: 0,
        updatedAt: c.updatedAt?.toISOString?.() ?? null,
        saleId: c.participation?.id ?? null,

        // 🔹 (Opcional) si querés armar título tipo “Venta - Proyecto”
        producto_desc: c.participation?.proyecto ?? null,
        codigo_interno: null,
      };
    });

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/conversations
 * Crea/asegura una conversación (por participationId o por peerUserId/clienteUserId).
 */
async function ensureAdminClienteByEmail(email: string, name?: string | null) {
  const found = await prisma.cliente.findUnique({ where: { email } });
  if (found) return found.id_cliente;
  const created = await prisma.cliente.create({
    data: { nombre: name || email.split("@")[0], email, email_verificado: new Date() },
    select: { id_cliente: true },
  });
  return created.id_cliente;
}

async function resolveAdminPeerId() {
  const adminId = process.env.ADMIN_USER_ID || "";
  if (adminId) {
    const exists = await prisma.cliente.findUnique({
      where: { id_cliente: adminId },
      select: { id_cliente: true },
    });
    if (exists?.id_cliente) return exists.id_cliente;
  }
  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXTAUTH_EMAIL || "";
  if (adminEmail) return ensureAdminClienteByEmail(adminEmail, "Administrador");
  throw new Error("ADMIN_NOT_CONFIGURED: Configure ADMIN_USER_ID (id_cliente) o ADMIN_EMAIL.");
}

async function ensureSessionClienteId(me: { id: string; email?: string | null; name?: string | null }) {
  const byId = await prisma.cliente.findUnique({ where: { id_cliente: me.id }, select: { id_cliente: true } });
  if (byId) return byId.id_cliente;

  if (me.email) {
    const byEmail = await prisma.cliente.findUnique({ where: { email: me.email }, select: { id_cliente: true } });
    if (byEmail) return byEmail.id_cliente;
  }

  const created = await prisma.cliente.create({
    data: {
      id_cliente: me.id,
      nombre: me.name || (me.email ? me.email.split("@")[0] : "Usuario"),
      email: me.email || `${me.id}@local.local`,
      email_verificado: new Date(),
    },
    select: { id_cliente: true },
  });
  return created.id_cliente;
}

type PostBody =
  | { participationId: string }
  | { peerUserId: string }
  | { clienteUserId: string }
  | { participationId?: string; peerUserId?: string; clienteUserId?: string };

export async function POST(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    if (!me?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as PostBody;
    const { participationId, peerUserId, clienteUserId } = (body as any) as {
      participationId?: string;
      peerUserId?: string;
      clienteUserId?: string;
    };

    const myClienteId = await ensureSessionClienteId({
      id: me.id,
      email: (me as any).email,
      name: (me as any).name,
    });

    if (participationId) {
      const participation = await prisma.cotizacionParticipacion.findUnique({
        where: { id: participationId },
        select: { id: true, proveedor_id: true },
      });
      if (!participation) {
        return NextResponse.json({ ok: false, error: "PARTICIPATION_NOT_FOUND" }, { status: 404 });
      }

      const proveedorId = participation.proveedor_id;
      const otherId = myClienteId === proveedorId ? await resolveAdminPeerId() : proveedorId;
      if (otherId === myClienteId) {
        return NextResponse.json({ ok: false, error: "CANNOT_CHAT_WITH_SELF" }, { status: 400 });
      }

      const peerOk = await prisma.cliente.findUnique({
        where: { id_cliente: otherId },
        select: { id_cliente: true },
      });
      if (!peerOk) {
        return NextResponse.json(
          { ok: false, error: "PEER_CLIENTE_NOT_FOUND: el peer no existe en Cliente.id_cliente" },
          { status: 500 }
        );
      }

      const existing = await prisma.conversation.findFirst({
        where: { participationId: participation.id },
        include: { participants: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

      if (existing) {
        await prisma.conversationParticipant.createMany({
          data: [
            { conversationId: existing.id, userId: myClienteId },
            { conversationId: existing.id, userId: otherId },
          ],
          skipDuplicates: true,
        });
        return NextResponse.json({ ok: true, conversation: existing });
      }

      const created = await prisma.conversation.create({
        data: {
          participationId: participation.id,
          participants: { create: [{ userId: myClienteId }, { userId: otherId }] },
        },
        include: { participants: true, messages: true },
      });

      return NextResponse.json({ ok: true, conversation: created }, { status: 201 });
    }

    const peer = peerUserId ?? clienteUserId;
    if (!peer) {
      return NextResponse.json({ ok: false, error: "MISSING_PEER_USER_ID" }, { status: 400 });
    }
    if (peer === myClienteId) {
      return NextResponse.json({ ok: false, error: "CANNOT_CHAT_WITH_SELF" }, { status: 400 });
    }

    const peerCliente = await prisma.cliente.findUnique({ where: { id_cliente: peer } });
    if (!peerCliente) {
      return NextResponse.json({ ok: false, error: "PEER_NOT_FOUND" }, { status: 404 });
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        participants: { some: { userId: myClienteId } },
        AND: { participants: { some: { userId: peer } } },
      },
      include: { participants: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (existing) {
      return NextResponse.json({ ok: true, conversation: existing });
    }

    const created = await prisma.conversation.create({
      data: { participants: { create: [{ userId: myClienteId }, { userId: peer }] } },
      include: { participants: true, messages: true },
    });

    return NextResponse.json({ ok: true, conversation: created }, { status: 201 });
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === "P2003") {
      return NextResponse.json(
        { ok: false, error: `FK_VIOLATION (P2003): ${err?.meta?.field_name || ""}` },
        { status: 500 }
      );
    }
    if (code === "P2002") {
      return NextResponse.json(
        { ok: false, error: `UNIQUE_CONSTRAINT (P2002): ${JSON.stringify(err?.meta)}` },
        { status: 500 }
      );
    }
    if (typeof err?.message === "string" && err.message.startsWith("ADMIN_NOT_CONFIGURED")) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    console.error("POST /api/chat/conversations ERROR:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}