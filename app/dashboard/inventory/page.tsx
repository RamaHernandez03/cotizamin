// app/dashboard/inventory/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const proveedorId =
    (session.user as any)?.id ??
    (session.user as any)?.id_cliente ??
    (session.user as any)?.userId ??
    (session.user as any)?.user_id ??
    (session.user as any)?.cliente_id ??
    session.user.id;

  const take = 100;

  const rows = await prisma.producto.findMany({
    where: { proveedor_id: String(proveedorId) },
    orderBy: { fecha_actualizacion: "desc" },
    select: {
      id_producto: true,
      codigo_interno: true,
      descripcion: true,
      marca: true,
      modelo: true,
      material: true,
      unidad: true,
      stock_actual: true,
      precio_actual: true,
      moneda: true,
      tiempo_entrega: true,
      ubicacion_stock: true,
      estado: true,
      fecha_actualizacion: true,
    },
    take: take + 1,
  });

  // 🔧 Normalizamos para que todo sea serializable hacia el Client Component
  const normalized = rows.map((r) => ({
    ...r,
    fecha_actualizacion: r.fecha_actualizacion.toISOString(),
    marca: r.marca ?? null,
    modelo: r.modelo ?? null,
    material: r.material ?? null,
    unidad: r.unidad ?? null,
    tiempo_entrega: r.tiempo_entrega ?? null,
    ubicacion_stock: r.ubicacion_stock ?? null,
  }));

  const hasMore = normalized.length > take;
  const initialItems = hasMore ? normalized.slice(0, take) : normalized;
  const nextCursor = hasMore ? initialItems[initialItems.length - 1].id_producto : null;

  return (
    <InventoryClient
      initialItems={initialItems}
      initialNextCursor={nextCursor}
      take={take}
    />
  );
}
