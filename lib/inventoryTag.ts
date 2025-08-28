import prisma from "@/lib/prisma";

/**
 * Devuelve un ETag estable por proveedor, basado en MAX(fecha_actualizacion) y COUNT(*).
 * Ej.: "inv:<proveedorId>:2025-08-27T18:10:01.000Z:123"
 */
export async function getInventoryTag(proveedorId: string) {
  const [agg] = await prisma.$queryRaw<
    { max: Date | null; count: bigint }[]
  >`SELECT MAX("fecha_actualizacion") as max, COUNT(*) as count
     FROM "Producto" WHERE "proveedor_id" = ${proveedorId}`;
  const maxIso = agg?.max ? new Date(agg.max).toISOString() : "0";
  const cnt = agg?.count?.toString() ?? "0";
  return `"inv:${proveedorId}:${maxIso}:${cnt}"`;
}