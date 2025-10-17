import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/* ========================== HELPERS ========================== */

/** Cache en memoria para el adminId (evita queries repetidas) */
let ADMIN_ID_CACHE: { id: string; timestamp: number } | null = null;
const ADMIN_CACHE_TTL = 300000; // 5 minutos

async function resolveAdminPeerId(): Promise<string> {
  // 1) Usar cache si está vigente
  if (ADMIN_ID_CACHE && Date.now() - ADMIN_ID_CACHE.timestamp < ADMIN_CACHE_TTL) {
    return ADMIN_ID_CACHE.id;
  }

  // 2) Resolver desde env
  const adminId = process.env.ADMIN_USER_ID || "";
  if (adminId) {
    const exists = await prisma.cliente.findUnique({
      where: { id_cliente: adminId },
      select: { id_cliente: true },
    });
    if (exists?.id_cliente) {
      ADMIN_ID_CACHE = { id: exists.id_cliente, timestamp: Date.now() };
      return exists.id_cliente;
    }
  }

  // 3) Crear admin por email si no existe
  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXTAUTH_EMAIL || "";
  if (adminEmail) {
    const baseName = "Administrador";
    const admin = await prisma.cliente.upsert({
      where: { email: adminEmail },
      update: {},
      create: { nombre: baseName, email: adminEmail, email_verificado: new Date() },
      select: { id_cliente: true },
    });
    ADMIN_ID_CACHE = { id: admin.id_cliente, timestamp: Date.now() };
    return admin.id_cliente;
  }

  throw new Error("ADMIN_NOT_CONFIGURED: Configure ADMIN_USER_ID o ADMIN_EMAIL.");
}

async function ensureSessionClienteId(me: { 
  id: string; 
  email?: string | null; 
  name?: string | null 
}) {
  // 1) Intentar por id primero
  const byId = await prisma.cliente.findUnique({
    where: { id_cliente: me.id },
    select: { id_cliente: true },
  });
  if (byId) return byId.id_cliente;

  // 2) Upsert por email si existe
  if (me.email) {
    const up = await prisma.cliente.upsert({
      where: { email: me.email },
      update: {},
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

  // 3) Crear sin email
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
 * GET /api/chat/conversations?take=30&cursor=<timestamp>
 * 
 * OPTIMIZACIONES:
 * - ETag basado en el máximo updatedAt (más eficiente)
 * - Una sola query con todos los includes necesarios
 * - Paginación por cursor temporal (más rápida que keyset compuesto)
 * - Devuelve 304 si no hay cambios
 */
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    if (!me?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const takeRaw = Number(url.searchParams.get("take") ?? 30);
    const take = Math.max(1, Math.min(takeRaw, 100));
    const cursorRaw = url.searchParams.get("cursor");

    const myClienteId = await ensureSessionClienteId({
      id: me.id,
      email: (me as any).email,
      name: (me as any).name,
    });

    // ====================== ETag optimizado ======================
    // Obtener el updatedAt más reciente de MIS conversaciones
    const latestConv = await prisma.conversation.findFirst({
      where: { participants: { some: { userId: myClienteId } } },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const maxUpdatedAt = latestConv?.updatedAt?.getTime() || 0;
    const etag = `W/"${maxUpdatedAt}"`;
    const ifNoneMatch = req.headers.get("if-none-match");

    // Si el cliente tiene la última versión, devolver 304
    if (ifNoneMatch === etag) {
      const res304 = new NextResponse(null, { status: 304 });
      res304.headers.set("ETag", etag);
      res304.headers.set("Cache-Control", "private, max-age=0, must-revalidate");
      return res304;
    }
    // =============================================================

    // Construir filtro de paginación
    const cursorDate = cursorRaw ? new Date(cursorRaw) : null;
    const whereClause = cursorDate
      ? {
          participants: { some: { userId: myClienteId } },
          updatedAt: { lt: cursorDate },
        }
      : {
          participants: { some: { userId: myClienteId } },
        };

    // UNA SOLA QUERY con todos los datos necesarios
    const convs = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: take + 1, // +1 para detectar hasMore
      select: {
        id: true,
        updatedAt: true,
        participationId: true,
        participation: {
          select: {
            id: true,
            proyecto: true,
            comentario: true,
            resultado: true,
          },
        },
        participants: {
          select: {
            userId: true,
            user: { 
              select: { 
                id_cliente: true,
                nombre: true, 
                email: true 
              } 
            },
          },
        },
        messages: {
          select: { 
            id: true,
            body: true, 
            createdAt: true,
            senderId: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const hasMore = convs.length > take;
    const sliced = hasMore ? convs.slice(0, take) : convs;

    // Contar mensajes no leídos por conversación (en una sola query)
    // Como no hay tabla MessageRead, usamos readAt como indicador
    const convIds = sliced.map(c => c.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: convIds },
        senderId: { not: myClienteId },
        readAt: null, // No leídos = readAt es null
      },
      _count: { id: true },
    });

    const unreadMap = new Map(
      unreadCounts.map(u => [u.conversationId, u._count.id])
    );

    const items = sliced.map((c) => {
      const lastMsg = c.messages[0];
      const peer = c.participants.find((p: any) => p.userId !== myClienteId);
      const unreadCount = unreadMap.get(c.id) || 0;

      return {
        id: c.id,
        proyecto: c.participation?.proyecto || "Venta",
        peerName: peer?.user?.nombre || null,
        lastMessage: lastMsg?.body || null,
        updatedAt: c.updatedAt.toISOString(),
        unreadCount,
        saleId: c.participation?.id ?? null,
        producto_desc: null, // No disponible en el modelo actual
        codigo_interno: null, // No disponible en el modelo actual
      };
    });

    const nextCursor = hasMore ? sliced[sliced.length - 1].updatedAt.toISOString() : null;

    const res = NextResponse.json({ 
      ok: true, 
      items, 
      nextCursor,
      hasMore,
    });
    res.headers.set("ETag", etag);
    res.headers.set("Cache-Control", "private, max-age=0, must-revalidate");
    return res;

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
 * 
 * OPTIMIZACIONES:
 * - Usar transacciones para evitar race conditions
 * - Reducir queries redundantes
 * - Mejor manejo de errores de concurrencia
 */
type PostBody =
  | { participationId: string }
  | { peerUserId: string }
  | { clienteUserId: string };

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

    // === CASO 1: Conversación por participación ===
    if (participationId) {
      // Usar transacción para evitar race conditions
      const result = await prisma.$transaction(async (tx) => {
        // 1) Obtener participación con datos necesarios
        const participation = await tx.cotizacionParticipacion.findUnique({
          where: { id: participationId },
          select: { 
            id: true, 
            proveedor_id: true,
            proyecto: true,
            comentario: true,
            resultado: true,
          },
        });

        if (!participation) {
          throw new Error("PARTICIPATION_NOT_FOUND");
        }

        // 2) Determinar el peer
        const proveedorId = participation.proveedor_id;
        const otherId = myClienteId === proveedorId 
          ? await resolveAdminPeerId() 
          : proveedorId;

        if (otherId === myClienteId) {
          throw new Error("CANNOT_CHAT_WITH_SELF");
        }

        // 3) Verificar que el peer existe
        const peerExists = await tx.cliente.findUnique({
          where: { id_cliente: otherId },
          select: { id_cliente: true },
        });

        if (!peerExists) {
          throw new Error("PEER_CLIENTE_NOT_FOUND");
        }

        // 4) Buscar conversación existente
        const existing = await tx.conversation.findFirst({
          where: { participationId: participation.id },
          select: { id: true },
        });

        if (existing) {
          // Asegurar participantes (idempotente)
          await tx.conversationParticipant.createMany({
            data: [
              { conversationId: existing.id, userId: myClienteId },
              { conversationId: existing.id, userId: otherId },
            ],
            skipDuplicates: true,
          });

          // Retornar conversación completa
          return await tx.conversation.findUnique({
            where: { id: existing.id },
            include: {
              participants: {
                select: {
                  userId: true,
                  user: { select: { nombre: true, email: true } },
                },
              },
              messages: { 
                orderBy: { createdAt: "desc" }, 
                take: 1 
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
        }

        // 5) Crear nueva conversación
        return await tx.conversation.create({
          data: {
            participationId: participation.id,
            participants: {
              create: [
                { userId: myClienteId },
                { userId: otherId },
              ],
            },
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
              select: { 
                id: true, 
                proyecto: true, 
                comentario: true, 
                resultado: true,
              },
            },
          },
        });
      });

      return NextResponse.json({ ok: true, conversation: result });
    }

    // === CASO 2: Conversación directa ===
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

    const result = await prisma.$transaction(async (tx) => {
      // 1) Verificar peer
      const peerCliente = await tx.cliente.findUnique({
        where: { id_cliente: peer },
        select: { id_cliente: true },
      });

      if (!peerCliente) {
        throw new Error("PEER_NOT_FOUND");
      }

      // 2) Buscar conversación existente
      const existing = await tx.conversation.findFirst({
        where: {
          participants: { 
            every: { 
              userId: { in: [myClienteId, peer] } 
            } 
          },
          participationId: null,
        },
        select: { id: true },
      });

      if (existing) {
        return await tx.conversation.findUnique({
          where: { id: existing.id },
          include: {
            participants: {
              select: {
                userId: true,
                user: { select: { nombre: true, email: true } },
              },
            },
            messages: { 
              orderBy: { createdAt: "desc" }, 
              take: 1 
            },
            participation: {
              select: { 
                id: true, 
                proyecto: true, 
                comentario: true, 
                resultado: true 
              },
            },
          },
        });
      }

      // 3) Crear nueva
      return await tx.conversation.create({
        data: {
          participants: {
            create: [
              { userId: myClienteId },
              { userId: peer },
            ],
          },
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
            select: { 
              id: true, 
              proyecto: true, 
              comentario: true, 
              resultado: true 
            },
          },
        },
      });
    });

    return NextResponse.json({ ok: true, conversation: result });

  } catch (err: any) {
    // Manejo específico de errores de concurrencia
    const code = err?.code as string | undefined;
    
    if (code === "P2034") {
      // Write conflict - retry lógico del cliente
      return NextResponse.json(
        { ok: false, error: "WRITE_CONFLICT", retryable: true },
        { status: 409 }
      );
    }

    if (code === "P2002") {
      // Unique constraint - probablemente creación concurrente
      return NextResponse.json(
        { ok: false, error: "ALREADY_EXISTS", retryable: true },
        { status: 409 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        { ok: false, error: `FK_VIOLATION: ${err?.meta?.field_name || ""}` },
        { status: 400 }
      );
    }

    if (err?.message === "PARTICIPATION_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "PARTICIPATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (err?.message === "PEER_NOT_FOUND" || err?.message === "PEER_CLIENTE_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "PEER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (err?.message === "CANNOT_CHAT_WITH_SELF") {
      return NextResponse.json(
        { ok: false, error: "CANNOT_CHAT_WITH_SELF" },
        { status: 400 }
      );
    }

    console.error("POST /api/chat/conversations ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}