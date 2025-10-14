import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import ProductsTableClient from "@/components/ProductsTableClient";

/* ===== Tipos ===== */
type ProductRow = {
  descripcion: string;
  miPrecio: number;
  fecha_actualizacion: Date | null;
};

type ProductStats = {
  descripcion: string;
  precioMin: number;
  precioMax: number;
  precioPromedio: number;
  miPrecio: number;
  totalProveedores: number;
  fecha_actualizacion: Date | null;
};

type SearchedProduct = {
  descripcion: string;
  searchCount: number;
  lastSearched: Date;
};

/*
  OPTIMIZACIÓN:
  - Trae TODOS los productos activos del proveedor.
  - Calcula stats de mercado SOLO para esas descripciones (1 precio por proveedor).
  - Cache 60s con tag por proveedor.
  - Guardarraíl MAX_DESCS para volumen extremo.
*/
const MAX_DESCS = 5000;

const getAllProductStats = unstable_cache(
  async (proveedorId: string): Promise<ProductStats[]> => {
    // 1) Mis productos activos (sin límite)
    const misProductosFromDb = await prisma.producto.findMany({
      where: { proveedor_id: proveedorId, estado: "Activo" },
      select: {
        descripcion: true,
        precio_actual: true,
        fecha_actualizacion: true,
      },
      orderBy: { fecha_actualizacion: "desc" },
    });

    const misProductosRaw: ProductRow[] = misProductosFromDb.map((p) => ({
      descripcion: p.descripcion,
      miPrecio: Number(p.precio_actual ?? 0),
      fecha_actualizacion: p.fecha_actualizacion ?? null,
    }));

    if (misProductosRaw.length === 0) return [];

    // 2) Deduplicar por descripción (quedarse con el más reciente)
    const misPorDescripcion = new Map<string, ProductRow>();
    for (const p of misProductosRaw) {
      const prev = misPorDescripcion.get(p.descripcion);
      const prevTs = prev?.fecha_actualizacion ? new Date(prev.fecha_actualizacion).getTime() : -1;
      const curTs = p.fecha_actualizacion ? new Date(p.fecha_actualizacion).getTime() : -1;
      if (!prev || curTs > prevTs) misPorDescripcion.set(p.descripcion, p);
    }

    // 2.1) Lista (acotada por guardarraíl)
    const allDescs = Array.from(misPorDescripcion.keys());
    const targetDescs = allDescs.slice(0, MAX_DESCS);

    // 3) Stats de mercado SOLO sobre esas descripciones (1 precio x proveedor)
    const mercadoPorProv = await prisma.producto.groupBy({
      by: ["descripcion", "proveedor_id"],
      where: {
        estado: "Activo",
        precio_actual: { gt: 0 },
        descripcion: { in: targetDescs },
      },
      _min: { precio_actual: true },
    });

    // 4) Reducir a nivel descripción
    const reduceMap = new Map<string, { precios: number[]; proveedores: number }>();
    for (const g of mercadoPorProv) {
      const desc = g.descripcion;
      const precioProv = g._min.precio_actual ?? 0;
      if (precioProv <= 0) continue;
      const r = reduceMap.get(desc) ?? { precios: [], proveedores: 0 };
      r.precios.push(Number(precioProv));
      r.proveedores += 1;
      reduceMap.set(desc, r);
    }

    // 5) Cruzar MIS productos con stats
    const out: ProductStats[] = [];
    for (const desc of targetDescs) {
      const mine = misPorDescripcion.get(desc)!;
      const r = reduceMap.get(desc);

      if (!r || r.precios.length === 0) {
        const my = mine.miPrecio || 0;
        out.push({
          descripcion: desc,
          precioMin: my,
          precioMax: my,
          precioPromedio: my,
          miPrecio: my,
          totalProveedores: 1,
          fecha_actualizacion: mine.fecha_actualizacion ?? null,
        });
      } else {
        const precios = r.precios;
        const min = Math.min(...precios);
        const max = Math.max(...precios);
        const avg = precios.reduce((a, b) => a + b, 0) / precios.length;
        out.push({
          descripcion: desc,
          precioMin: min,
          precioMax: max,
          precioPromedio: avg,
          miPrecio: mine.miPrecio || 0,
          totalProveedores: r.proveedores,
          fecha_actualizacion: mine.fecha_actualizacion ?? null,
        });
      }
    }

    // 6) Orden por última actualización
    out.sort((a, b) => {
      const da = a.fecha_actualizacion ? new Date(a.fecha_actualizacion).getTime() : 0;
      const db = b.fecha_actualizacion ? new Date(b.fecha_actualizacion).getTime() : 0;
      return db - da;
    });

    return out;
  },
  {
    revalidate: 60,
    tags: (proveedorId: string) => [`proveedor:${proveedorId}:product-stats:all:v2`],
  } as any
);

const getTopSearchedProducts = unstable_cache(
  async (): Promise<SearchedProduct[]> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const searches = await prisma.productSearchLog.groupBy({
      by: ["q"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    return searches.map((s) => ({
      descripcion: s.q,
      searchCount: s._count.id,
      lastSearched: s._max.createdAt || new Date(),
    }));
  },
  {
    revalidate: 1800,
    tags: ["top-searched-products"],
  } as any
);

/* ===== Server wrappers (render) ===== */
export async function ProductStatsTable({ proveedorId }: { proveedorId: string }) {
  const stats = await getAllProductStats(proveedorId);

  if (stats.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#00152F] mb-4">📦 Mis Productos</h2>
        <div className="text-center py-12">
          <div className="text-5xl mb-3 opacity-70">📭</div>
          <p className="text-gray-700 font-semibold mb-1">No hay productos activos</p>
          <p className="text-sm text-gray-500">Carga productos para ver la comparativa de mercado</p>
        </div>
      </div>
    );
  }

  // 🔧 Importante: serializar fecha para el cliente (string)
  const clientData = stats.map((s) => ({
    ...s,
    fecha_actualizacion: s.fecha_actualizacion ? new Date(s.fecha_actualizacion).toISOString() : null,
  }));

  return <ProductsTableClient data={clientData} />;
}

export async function TopSearchedProductsTable() {
  const products = await getTopSearchedProducts();

  if (products.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#00152F] mb-4">🔍 Productos Más Buscados</h2>
        <div className="text-center py-12">
          <div className="text-5xl mb-3 opacity-70">🔍</div>
          <p className="text-gray-700 font-semibold mb-1">No hay búsquedas registradas</p>
          <p className="text-sm text-gray-500">Los productos más buscados aparecerán aquí</p>
        </div>
      </div>
    );
  }

  const maxCount = products[0]?.searchCount || 1;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[#00152F]">🔍 Productos Más Buscados</h2>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Últimos 30 días</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
              <th className="px-4 py-3 text-left font-bold">#</th>
              <th className="px-4 py-3 text-left font-bold">Producto</th>
              <th className="px-4 py-3 text-center font-bold">Búsquedas</th>
              <th className="px-4 py-3 text-center font-bold">Popularidad</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => {
              const popularityPct = Math.round((product.searchCount / maxCount) * 100);
              return (
                <tr
                  key={`${product.descripcion}-${idx}`}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors duration-150 border-b border-gray-200 last:border-b-0`}
                >
                  <td className="px-4 py-3 text-gray-600 font-bold">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-md truncate">{product.descripcion}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold">
                      {product.searchCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${popularityPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-10 text-right">{popularityPct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Contenedor ===== */
export default async function ProductsHomeSection({ proveedorId }: { proveedorId: string }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <ProductStatsTable proveedorId={proveedorId} />
      <TopSearchedProductsTable />
    </section>
  );
}
