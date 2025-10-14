"use client";

import { useMemo, useState } from "react";

type ProductStats = {
  descripcion: string;
  precioMin: number;
  precioMax: number;
  precioPromedio: number;
  miPrecio: number;
  totalProveedores: number;
  // 🔧 En el cliente llega serializado como string
  fecha_actualizacion: string | null;
};

function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return "—";
  return `$${price.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPriceColor(myPrice: number, minPrice: number, maxPrice: number): string {
  if (myPrice === minPrice) return "text-green-600 font-bold";
  if (myPrice === maxPrice) return "text-red-600 font-bold";
  const avgPrice = (minPrice + maxPrice) / 2;
  if (myPrice <= avgPrice * 1.1) return "text-gray-900 font-semibold";
  return "text-orange-600 font-semibold";
}

export default function ProductsTableClient({ data }: { data: ProductStats[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10; // paginamos 10 en el front

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((d) => d.descripcion.toLowerCase().includes(term));
  }, [q, data]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(pageCount, p + 1));

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-lg font-bold text-[#00152F]">
          📦 Mis Productos (con comparativa)
          <span className="ml-2 text-xs text-gray-500 align-middle">{data.length} en total</span>
        </h2>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por descripción…"
            className="w-64 max-w-full px-3 py-2 rounded-lg border text-black border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-600">{filtered.length} resultados</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
              <th className="px-4 py-3 text-left font-bold">Producto</th>
              <th className="px-4 py-3 text-right font-bold">Precio Mín.</th>
              <th className="px-4 py-3 text-right font-bold">Precio Prom.</th>
              <th className="px-4 py-3 text-right font-bold">Precio Máx.</th>
              <th className="px-4 py-3 text-right font-bold">Mi Precio</th>
              <th className="px-4 py-3 text-center font-bold">Proveedores</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-600">
                  No se encontraron productos que coincidan con “{q}”.
                </td>
              </tr>
            ) : (
              rows.map((stat, idx) => (
                <tr
                  key={`${stat.descripcion}-${idx}`}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors duration-150 border-b border-gray-200 last:border-b-0`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{stat.descripcion}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    {formatPrice(stat.precioMin)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {formatPrice(stat.precioPromedio)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">
                    {formatPrice(stat.precioMax)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${getPriceColor(
                      stat.miPrecio,
                      stat.precioMin,
                      stat.precioMax
                    )}`}
                  >
                    {formatPrice(stat.miPrecio)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 font-medium">
                    {stat.totalProveedores}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-gray-600">
          Página {currentPage} de {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg text-black border border-gray-300 disabled:opacity-50"
          >
            Anterior
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 2)
            .map((n, i, arr) => {
              const isGap = i > 0 && n - arr[i - 1] > 1;
              return (
                <span key={`p-${n}`} className="inline-flex">
                  {isGap && <span className="px-1">…</span>}
                  <button
                    onClick={() => setPage(n)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      n === currentPage ? "border-blue-600 text-blue-700 font-semibold" : "border-gray-300"
                    }`}
                  >
                    {n}
                  </button>
                </span>
              );
            })}
          <button
            onClick={goNext}
            disabled={currentPage === pageCount}
            className="px-3 py-1.5 rounded-lg border text-black border-gray-300 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-600 rounded" />
          <span>Mejor precio</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-600 rounded" />
          <span>Precio más alto</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-600 rounded" />
          <span>Por encima del promedio</span>
        </div>
      </div>
    </div>
  );
}
