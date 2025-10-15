import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/* ========================== HELPERS ========================== */

/** Upsert de cliente por email (evita carreras si no existe). */
async function ensureAdminClienteByEmail(email: string, name?: string | null) {
  const baseName = name || email.split("@")[0];
  const up = await prisma.cliente.upsert({
    where: { email },
    update: {},
    create: { nombre: baseName, email, email_verificado: new Date() },
    select: { id_cliente: true },
  });
  return up.id_cliente;
}

/** Resuelve el peer admin desde env o por email (con upsert seguro). */
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
  throw new Error("ADMIN_NOT_CONFIGURED: Configure ADMIN_USER_ID o ADMIN_EMAIL.");
}

/** Asegura que exista un cliente con el id de sesión; si no, upsert por email o crea explícito. */
async function ensureSessionClienteId(me: { id: string; email?: string | null; name?: string | null }) {
  // 1) ¿Existe por id_cliente?
  const byId = await prisma.cliente.findUnique({
    where: { id_cliente: me.id },
    select: { id_cliente: true },
  });
  if (byId) return byId.id_cliente;

  // 2) Si hay email, upsert por email (evita duplicados por condiciones de carrera)
  if (me.email) {
    const up = await prisma.cliente.upsert({
      where: { email: me.email },
      update: {
        // Si quisieras sincronizar nombre, podría ir aquí condicional
      },
      create: {
        id_cliente: me.id,
        nombre: me.name || me.email.split("@")[0],
        email: me.email,
        email_verificado: new Date(),
      },
      select: { id_cliente: true },
    });
    return up.id_cliente;
  }

  // 3) Sin email: crea con id explícito
  const created = await prisma.cliente.create({
    data: {
      id_cliente: me.id,
      nombre: me.name || "Usuario",
      email: `${me.id}@local.local`,
      email_verificado: new Date(),
    },
    select: { id_cliente: true },
  });
  return created.id_cliente;
}

/* ============================ GET ============================ */
/**
 * GET /api/chat/conversations?take=30&cursorId=<conversationId>
 * Paginación keyset estable por (updatedAt DESC, id DESC).
 * - Si viene cursorId, se busca su updatedAt y se filtra:
 *   (updatedAt < cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id < cursorId)
 */
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    if (!me?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const takeRaw = Number(url.searchParams.get("take") ?? 30);
    const take = Math.max(1, Math.min(takeRaw, 100)); // 1..100
    const cursorId = url.searchParams.get("cursorId") || null;

    const myClienteId = await ensureSessionClienteId({
      id: me.id,
      email: (me as any).email,
      name: (me as any).name,
    });

    // Si hay cursorId, buscamos su updatedAt para construir el filtro keyset
    let cursorUpdatedAt: Date | null = null;
    if (cursorId) {
      const cur = await prisma.conversation.findUnique({
        where: { id: cursorId },
        select: { updatedAt: true },
      });
      // Si el cursor no existe, devolvemos lista desde el principio
      cursorUpdatedAt = cur?.updatedAt ?? null;
    }

    // Filtro base: soy participante
    const baseWhere = {
      participants: { some: { userId: myClienteId } },
    };

    // Filtro de paginación keyset si hay cursor válido
    const whereWithCursor =
      cursorId && cursorUpdatedAt
        ? {
            AND: [
              baseWhere,
              {
                OR: [
                  { updatedAt: { lt: cursorUpdatedAt } },
                  { AND: [{ updatedAt: cursorUpdatedAt }, { id: { lt: cursorId } }] },
                ],
              },
            ],
          }
        : baseWhere;

    // Traemos (take + 1) para saber si hay siguiente página
    const convs = await prisma.conversation.findMany({
      where: whereWithCursor,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        updatedAt: true,
        participation: {
          select: { id: true, proyecto: true, comentario: true, resultado: true },
        },
        participants: {
          select: {
            userId: true,
            user: { select: { nombre: true, email: true } },
          },
        },
        messages: {
          select: { body: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const hasMore = convs.length > take;
    const sliced = hasMore ? convs.slice(0, take) : convs;

    const items = sliced.map((c) => {
      const last = c.messages[0];
      const peer =
        c.participants.find((p) => p.userId !== myClienteId) || c.participants[0] || null;

      return {
        id: c.id,
        proyecto: c.participation?.proyecto || "Venta",
        peerName: peer?.user?.nombre || peer?.user?.email || null,
        lastMessage: last?.body || null,
        updatedAt: c.updatedAt.toISOString(),
        saleId: c.participation?.id ?? null,
      };
    });

    const nextCursorId = hasMore ? sliced[sliced.length - 1].id : null;

    return NextResponse.json({ ok: true, items, nextCursorId });
  } catch (err: any) {
    console.error("GET /api/chat/conversations ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/* ============================ POST ============================ */
/**
 * POST /api/chat/conversations
 * Crea/asegura una conversación:
 * - Caso 1: por participationId (una conversación por participación).
 * - Caso 2: directa entre dos clientes (yo y peer).
 */
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
    const { participationId, peerUserId, clienteUserId } = body as any;

    const myClienteId = await ensureSessionClienteId({
      id: me.id,
      email: (me as any).email,
      name: (me as any).name,
    });

    // === CASO 1: desde una participación (preferido) ===
    if (participationId) {
      const participation = await prisma.cotizacionParticipacion.findUnique({
        where: { id: participationId },
        select: { id: true, proveedor_id: true },
      });
      if (!participation) {
        return NextResponse.json(
          { ok: false, error: "PARTICIPATION_NOT_FOUND" },
          { status: 404 }
        );
      }

      const proveedorId = participation.proveedor_id;
      const otherId =
        myClienteId === proveedorId ? await resolveAdminPeerId() : proveedorId;

      if (otherId === myClienteId) {
        return NextResponse.json(
          { ok: false, error: "CANNOT_CHAT_WITH_SELF" },
          { status: 400 }
        );
      }

      // Aseguramos que el peer exista
      const peerOk = await prisma.cliente.findUnique({
        where: { id_cliente: otherId },
        select: { id_cliente: true },
      });
      if (!peerOk) {
        return NextResponse.json(
          { ok: false, error: "PEER_CLIENTE_NOT_FOUND" },
          { status: 500 }
        );
      }

      // Garantizamos unicidad por participationId
      const existing = await prisma.conversation.findFirst({
        where: { participationId: participation.id },
        select: { id: true },
      });

      if (existing) {
        // Nos aseguramos de que ambos participantes estén linkeados (idempotente)
        await prisma.conversationParticipant.createMany({
          data: [
            { conversationId: existing.id, userId: myClienteId },
            { conversationId: existing.id, userId: otherId },
          ],
          skipDuplicates: true,
        });

        const conv = await prisma.conversation.findUnique({
          where: { id: existing.id },
          include: {
            participants: {
              select: {
                userId: true,
                user: { select: { nombre: true, email: true } },
              },
            },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            participation: {
              select: { id: true, proyecto: true, comentario: true, resultado: true },
            },
          },
        });

        return NextResponse.json({ ok: true, conversation: conv });
      }

      // Crear la conversación en una sola transacción
      const created = await prisma.conversation.create({
        data: {
          participationId: participation.id,
          participants: { create: [{ userId: myClienteId }, { userId: otherId }] },
        },
        include: {
          participants: {
            select: {
              userId: true,
              user: { select: { nombre: true, email: true } },
            },
          },
          messages: true,
          participation: {
            select: { id: true, proyecto: true, comentario: true, resultado: true },
          },
        },
      });

      return NextResponse.json({ ok: true, conversation: created }, { status: 201 });
    }

    // === CASO 2: conversación directa entre dos clientes ===
    const peer = peerUserId ?? clienteUserId;
    if (!peer) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PEER_USER_ID" },
        { status: 400 }
      );
    }
    if (peer === myClienteId) {
      return NextResponse.json(
        { ok: false, error: "CANNOT_CHAT_WITH_SELF" },
        { status: 400 }
      );
    }

    const peerCliente = await prisma.cliente.findUnique({
      where: { id_cliente: peer },
      select: { id_cliente: true },
    });
    if (!peerCliente) {
      return NextResponse.json({ ok: false, error: "PEER_NOT_FOUND" }, { status: 404 });
    }

    // ¿Ya existe una conversación directa conmigo?
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: { some: { userId: myClienteId } },
        AND: { participants: { some: { userId: peer } } },
        participationId: null, // directa (no vinculada a participación)
      },
      select: { id: true },
    });

    if (existing) {
      const conv = await prisma.conversation.findUnique({
        where: { id: existing.id },
        include: {
          participants: {
            select: {
              userId: true,
              user: { select: { nombre: true, email: true } },
            },
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          participation: {
            select: { id: true, proyecto: true, comentario: true, resultado: true },
          },
        },
      });
      return NextResponse.json({ ok: true, conversation: conv });
    }

    const created = await prisma.conversation.create({
      data: { participants: { create: [{ userId: myClienteId }, { userId: peer }] } },
      include: {
        participants: {
          select: {
            userId: true,
            user: { select: { nombre: true, email: true } },
          },
        },
        messages: true,
        participation: {
          select: { id: true, proyecto: true, comentario: true, resultado: true },
        },
      },
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
