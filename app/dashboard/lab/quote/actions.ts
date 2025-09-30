// app/dashboard/lab/quote/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Resuelve una base URL confiable para fetch interno */
function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

function sanitize(v: unknown) {
  return String(v ?? "").trim();
}

async function triggerWebhookForProvider(params: {
  proveedor_id: string;
  q: string;
  precio_ofertado?: number | null;
}) {
  const base = getBaseUrl();

  // 1) Dispara n8n vía nuestro proxy interno
  const r1 = await fetch(`${base}/api/quotes/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!r1.ok) throw new Error(`refresh failed ${r1.status}`);
  const j1 = (await r1.json()) as { ok: boolean; data?: unknown };
  if (!j1.ok) throw new Error("refresh not ok");

  // 2) Ingesta la respuesta (es el array con query/resultados)
  const r2 = await fetch(`${base}/api/quotes/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(j1.data ?? []),
    cache: "no-store",
  });
  if (!r2.ok) throw new Error(`ingest failed ${r2.status}`);
  const j2 = await r2.json();
  return j2;
}

export async function notifyFromQuery(formData: FormData) {
  const q = sanitize(formData.get("q"));
  const marca = sanitize(formData.get("marca"));
  const modelo = sanitize(formData.get("modelo"));
  const material = sanitize(formData.get("material"));
  const limitRaw = Number(sanitize(formData.get("limit")) || 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1),
    50
  );

  if (!q) {
    redirect(`/dashboard/lab/quote?sent=0`);
  }

  // 1) Repetimos la búsqueda server-side para garantizar consistencia
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

  // 2) Un producto (el más barato) por proveedor
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

  // 3) Por cada proveedor listado → webhook n8n → ingest a historial
  await Promise.allSettled(
    top.map((t) =>
      triggerWebhookForProvider({
        proveedor_id: t.proveedor_id,
        q,
        precio_ofertado: t.precio_actual, // opcional, útil para IA/contexto
      })
    )
  );

  // 4) refrescamos feedback y volvemos a la misma pantalla con flag "sent"
  revalidatePath("/dashboard/feedback");
  redirect(
    `/dashboard/lab/quote?sent=1&q=${encodeURIComponent(q)}&marca=${encodeURIComponent(
      marca
    )}&modelo=${encodeURIComponent(modelo)}&material=${encodeURIComponent(
      material
    )}&limit=${limit}`
  );
}
