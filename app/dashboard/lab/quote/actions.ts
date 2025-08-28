// app/dashboard/lab/quote/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function sanitize(v: unknown) {
  return String(v ?? "").trim();
}

export async function notifyFromQuery(formData: FormData) {
  const q = sanitize(formData.get("q"));
  const marca = sanitize(formData.get("marca"));
  const modelo = sanitize(formData.get("modelo"));
  const material = sanitize(formData.get("material"));
  const limitRaw = Number(sanitize(formData.get("limit")) || 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

  if (!q) {
    redirect(`/dashboard/lab/quote?sent=0`);
  }

  // Repetimos la búsqueda server-side para garantizar consistencia
  const productos = await prisma.producto.findMany({
    where: {
      AND: [
        { precio_actual: { gt: 0 } },
        { descripcion: { contains: q, mode: "insensitive" } },
        marca ? { marca: { equals: marca, mode: "insensitive" } } : {},
        modelo ? { modelo: { equals: modelo, mode: "insensitive" } } : {},
        material ? { material: { equals: material, mode: "insensitive" } } : {},
      ],
    },
    orderBy: { precio_actual: "asc" },
    select: {
      id_producto: true,
      proveedor_id: true,
      codigo_interno: true,
      descripcion: true,
      marca: true,
      modelo: true,
      material: true,
      precio_actual: true,
    },
    take: 200,
  });

  // Un producto (más barato) por proveedor
  const byProveedor = new Map<string, (typeof productos)[number]>();
  for (const p of productos) {
    if (!byProveedor.has(p.proveedor_id)) byProveedor.set(p.proveedor_id, p);
  }
  const uniques = Array.from(byProveedor.values()).sort(
    (a, b) => a.precio_actual - b.precio_actual
  );
  const top = uniques.slice(0, limit);

  if (top.length === 0) {
    redirect(`/dashboard/lab/quote?sent=0&q=${encodeURIComponent(q)}`);
  }

  const best = top[0].precio_actual;

  // Creamos feedback por proveedor
  // Nota: requiere modelo CotizacionParticipacion migrado en Prisma
  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    const rank = i + 1;
    const deltaPct = Math.round(((t.precio_actual - best) / best) * 100);

    const productoResumen = [
      t.descripcion,
      t.marca ? `Marca: ${t.marca}` : null,
      t.modelo ? `Modelo: ${t.modelo}` : null,
      t.material ? `Material: ${t.material}` : null,
      t.codigo_interno ? `Código: ${t.codigo_interno}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const resultado =
      rank <= 3 ? "Top 3 mejores precios" : "Participación (fuera del Top 3)";

    const comentario = `Consulta simulada • Producto: ${productoResumen} • Precio: $${t.precio_actual.toLocaleString(
      "es-AR"
    )} • Ranking #${rank}/${top.length}`;

    const sugerencia =
      rank <= 3
        ? "Precio competitivo. ¡Mantené tu estrategia!"
        : `Tu precio está ~${deltaPct}% por encima del mejor. Considerá ajustar para entrar al Top 3.`;

    await prisma.cotizacionParticipacion.create({
      data: {
        proveedor_id: t.proveedor_id,
        fecha: new Date(),
        proyecto: `Cotización simulada: ${q}`,
        accion: "Participó en cotización simulada",
        resultado,
        comentario,
        sugerencia,
      },
    });
  }

  // refrescamos feedback y volvemos a la misma pantalla con flag "sent"
  revalidatePath("/dashboard/feedback");
  redirect(
    `/dashboard/lab/quote?sent=1&q=${encodeURIComponent(q)}&marca=${encodeURIComponent(
      marca
    )}&modelo=${encodeURIComponent(modelo)}&material=${encodeURIComponent(
      material
    )}&limit=${limit}`
  );
}
