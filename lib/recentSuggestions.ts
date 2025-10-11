// lib/recentSuggestions.ts
import prisma from "@/lib/prisma";

/**
 * Inserta una sugerencia y garantiza FIFO con cap de 10 por proveedor.
 * - Inserta la nueva fila
 * - Si quedan >10, elimina las más viejas (ordenadas por created_at asc)
 */
export async function pushRecentSuggestion(params: {
  proveedor_id: string;
  proyecto?: string | null;
  comentario?: string | null;
  sugerencia: string;        // <= texto visible en "Sugerencias recientes"
}) {
  const { proveedor_id, proyecto, comentario, sugerencia } = params;

  await prisma.$transaction(async (tx) => {
    // 1) insert
    await tx.recentSuggestion.create({
      data: {
        proveedor_id,
        proyecto: proyecto ?? null,
        comentario: comentario ?? null,
        sugerencia,
      },
    });

    // 2) contar y recortar
    const list = await tx.recentSuggestion.findMany({
      where: { proveedor_id },
      orderBy: { created_at: "desc" },
      select: { id: true },
    });

    if (list.length > 10) {
      const toDelete = list.slice(10).map((r) => r.id); // >10 => borrar desde el 11°
      await tx.recentSuggestion.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
  });
}
