import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import ProductsTableClient from "@/components/ProductsTableClient";

/* ===== Tipos ===== */
type ProductRow = {
  descripcion: string;
  marca: string | null;
  material: string | null;
  modelo: string | null;
  norma_tecnica: string | null;
  unidad: string | null;
  miPrecio: number;
  fecha_actualizacion: Date | null;
  variant_hash_hex: string; // clave de variante (sha256 en hex)
};

type ProductStats = {
  descripcion: string;
  marca: string | null;
  material: string | null;
  modelo: string | null;
  norma_tecnica: string | null;
  unidad: string | null;

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
  OPTIMIZACIÓN VARIANTES (versión SQL):
  - “Mi última por variante” con DISTINCT ON (variant_hash) ORDER BY fecha_actualizacion DESC.
  - Mercado en una sola query con variant_hash IN (...).
  - Sin OR gigantes ni deduplicación en Node.
  - Cache 60s con tag por proveedor.
  - Guardarraíl MAX_VARIANTS por seguridad.
*/
const MAX_VARIANTS = 5000;

/* ===== Helpers ===== */
function bufToHex(b: Uint8Array | Buffer | null): string {
  if (!b) return "";
  // @ts-ignore
  const buf: Buffer = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return buf.toString("hex");
}

function makeStatsFallbackFromMine(mine: ProductRow): ProductStats {
  const my = mine.miPrecio || 0;
  return {
    descripcion: mine.descripcion,
    marca: mine.marca,
    material: mine.material,
    modelo: mine.modelo,
    norma_tecnica: mine.norma_tecnica,
    unidad: mine.unidad,

    precioMin: my,
    precioMax: my,
    precioPromedio: my,
    miPrecio: my,
    totalProveedores: my > 0 ? 1 : 0,
    fecha_actualizacion: mine.fecha_actualizacion ?? null,
  };
}

/* ===== Query crudas (Postgres) ===== */

/**
 * Devuelve UNA fila por variante del proveedor (la más reciente por fecha_actualizacion).
 * Calcula variant_hash = sha256(variant_key_norm) on the fly.
 * IMPORTANTE: Tabla citada como "Producto" (con comillas) para respetar el nombre real en Postgres.
 */
async function getMyLatestPerVariant(proveedorId: string): Promise<ProductRow[]> {
  type Row = {
    descripcion: string;
    marca: string | null;
    material: string | null;
    modelo: string | null;
    norma_tecnica: string | null;
    unidad: string | null;
    precio_actual: number | null;
    fecha_actualizacion: Date | null;
    variant_hash: Buffer; // bytea -> Buffer
  };

  const rows = await prisma.$queryRaw<Row[]>`
    WITH my AS (
      SELECT
        /* hash de la clave normalizada */
        digest(
          concat_ws('||',
            lower(trim("descripcion")),
            coalesce(lower(trim("marca")), ''),
            coalesce(lower(trim("material")), ''),
            coalesce(lower(trim("modelo")), ''),
            coalesce(lower(trim("norma_tecnica")), ''),
            coalesce(lower(trim("unidad")), '')
          ),
          'sha256'
        ) AS variant_hash,
        "descripcion", "marca", "material", "modelo", "norma_tecnica", "unidad",
        "precio_actual", "fecha_actualizacion"
      FROM "Producto"
      WHERE "proveedor_id" = ${proveedorId}
    )
    SELECT DISTINCT ON (variant_hash)
      descripcion, marca, material, modelo, norma_tecnica, unidad,
      precio_actual, fecha_actualizacion, variant_hash
    FROM my
    ORDER BY variant_hash, fecha_actualizacion DESC;
  `;

  return rows.map((r) => ({
    descripcion: r.descripcion,
    marca: r.marca,
    material: r.material,
    modelo: r.modelo,
    norma_tecnica: r.norma_tecnica,
    unidad: r.unidad,
    miPrecio: Number(r.precio_actual ?? 0),
    fecha_actualizacion: r.fecha_actualizacion ?? null,
    variant_hash_hex: bufToHex(r.variant_hash),
  }));
}

/**
 * Dado un set de variant_hash (bytea[]), calcula:
 * - Un precio por proveedor (mínimo)
 * - Reduce a nivel variante: min/max/avg y total de proveedores
 * IMPORTANTE: Tabla citada como "Producto".
 */
async function getMarketStatsForHashes(variantHashesHex: string[]): Promise<
  Record<
    string,
    {
      precioMin: number;
      precioMax: number;
      precioPromedio: number;
      totalProveedores: number;
    }
  >
> {
  if (variantHashesHex.length === 0) return {};

  // Convertimos los hex a bytea (Buffer) para pasarlos como array a PG
  const byteaArray = variantHashesHex.map((hex) => Buffer.from(hex, "hex"));

  type Row = {
    variant_hash: Buffer;
    precio_min: number | null;
    precio_max: number | null;
    precio_prom: number | null;
    total_proveedores: number;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    WITH base AS (
      SELECT
        digest(
          concat_ws('||',
            lower(trim("descripcion")),
            coalesce(lower(trim("marca")), ''),
            coalesce(lower(trim("material")), ''),
            coalesce(lower(trim("modelo")), ''),
            coalesce(lower(trim("norma_tecnica")), ''),
            coalesce(lower(trim("unidad")), '')
          ),
          'sha256'
        ) AS variant_hash,
        "proveedor_id",
        MIN("precio_actual") AS precio_min
      FROM "Producto"
      WHERE "precio_actual" > 0
        AND digest(
          concat_ws('||',
            lower(trim("descripcion")),
            coalesce(lower(trim("marca")), ''),
            coalesce(lower(trim("material")), ''),
            coalesce(lower(trim("modelo")), ''),
            coalesce(lower(trim("norma_tecnica")), ''),
            coalesce(lower(trim("unidad")), '')
          ),
          'sha256'
        ) = ANY(${byteaArray}::bytea[])
      GROUP BY variant_hash, "proveedor_id"
    )
    SELECT
      variant_hash,
      MIN(precio_min) AS precio_min,
      MAX(precio_min) AS precio_max,
      AVG(precio_min) AS precio_prom,
      COUNT(*)        AS total_proveedores
    FROM base
    GROUP BY variant_hash;
  `;

  const out: Record<
    string,
    { precioMin: number; precioMax: number; precioPromedio: number; totalProveedores: number }
  > = {};

  for (const r of rows) {
    const key = bufToHex(r.variant_hash);
    const min = Number(r.precio_min ?? 0);
    const max = Number(r.precio_max ?? 0);
    const avg = Number(r.precio_prom ?? 0);
    const cnt = Number(r.total_proveedores ?? 0);
    out[key] = {
      precioMin: min,
      precioMax: max,
      precioPromedio: avg,
      totalProveedores: cnt,
    };
  }

  return out;
}

/* ===== Cacheadas ===== */

const getAllProductStats = unstable_cache(
  async (proveedorId: string): Promise<ProductStats[]> => {
    // 1) Mis últimas por variante (DB dedup)
    const mineAll = await getMyLatestPerVariant(proveedorId);
    if (mineAll.length === 0) return [];

    // 1.1) Guardarraíl por volumen extremo
    const mine = mineAll.slice(0, MAX_VARIANTS);

    // 2) Mercado en UNA query por variant_hash
    const hashes = mine.map((m) => m.variant_hash_hex).filter(Boolean);
    const mercado = await getMarketStatsForHashes(hashes);

    // 3) Cruce
    const out: ProductStats[] = mine.map((m) => {
      const agg = mercado[m.variant_hash_hex];
      if (!agg || agg.totalProveedores === 0) {
        return makeStatsFallbackFromMine(m);
      }
      return {
        descripcion: m.descripcion,
        marca: m.marca,
        material: m.material,
        modelo: m.modelo,
        norma_tecnica: m.norma_tecnica,
        unidad: m.unidad,

        precioMin: agg.precioMin,
        precioMax: agg.precioMax,
        precioPromedio: agg.precioPromedio,
        miPrecio: m.miPrecio || 0,
        totalProveedores: agg.totalProveedores,
        fecha_actualizacion: m.fecha_actualizacion ?? null,
      };
    });

    // 4) Orden por última actualización
    out.sort((a, b) => {
      const da = a.fecha_actualizacion ? new Date(a.fecha_actualizacion).getTime() : 0;
      const db = b.fecha_actualizacion ? new Date(b.fecha_actualizacion).getTime() : 0;
      return db - da;
    });

    return out;
  },
  {
    revalidate: 60,
    tags: (proveedorId: string) => [`proveedor:${proveedorId}:product-stats:variants:v2`], // versión bump
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
          <p className="text-gray-700 font-semibold mb-1">No hay productos</p>
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
