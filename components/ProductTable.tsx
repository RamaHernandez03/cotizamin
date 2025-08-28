// components/ProductTable.tsx
"use client";
import { useProducts } from "@/hooks/useProducts";

export default function ProductTable() {
  const { data, size, setSize, isValidating } = useProducts(100);
  const items = (data ?? []).flatMap((d: any) => d.items ?? []);
  const last = data?.[data.length - 1];
  const hasMore = !!last?.nextCursor;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2 hidden md:table-cell">Marca</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Precio</th>
              <th className="p-2 hidden sm:table-cell">Moneda</th>
              <th className="p-2 hidden lg:table-cell">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id_producto} className="border-t">
                <td className="p-2">{p.codigo_interno}</td>
                <td className="p-2">{p.descripcion}</td>
                <td className="p-2 hidden md:table-cell">{p.marca ?? "—"}</td>
                <td className="p-2">{p.stock_actual}</td>
                <td className="p-2">{p.precio_actual}</td>
                <td className="p-2 hidden sm:table-cell">{p.moneda}</td>
                <td className="p-2 hidden lg:table-cell">{p.estado}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Sin productos aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {isValidating ? "Actualizando…" : "Listo"}
        </span>
        {hasMore && (
          <button
            onClick={() => setSize(size + 1)}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
          >
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
