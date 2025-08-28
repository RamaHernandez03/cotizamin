"use client";

import { useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { useProducts } from "@/hooks/useProducts";

type Producto = {
  id_producto: string;
  codigo_interno: string;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  material: string | null;
  norma_tecnica?: string | null;
  unidad: string | null;
  stock_actual: number;
  precio_actual: number;
  moneda: string;
  tiempo_entrega: string | null;
  ubicacion_stock: string | null;
  estado: string;
  fecha_actualizacion: string;
};

type UploadResponse = {
  message: string;
  procesados?: number;
  errores?: string[];
};

export default function InventoryClient({
  initialItems,
  initialNextCursor,
  take,
}: {
  initialItems: Producto[];
  initialNextCursor: string | null;
  take: number;
}) {
  // SWR fallback: el cliente arranca con estos datos (sin flicker)
  const fallback = {
    [`/api/products?take=${take}`]: { items: initialItems, nextCursor: initialNextCursor },
  };

  return (
    <SWRConfig value={{ fallback }}>
      <InventoryView take={take} />
    </SWRConfig>
  );
}

function InventoryView({ take }: { take: number }) {
  // Datos del inventario (SWR Infinite)
  const { data, size, setSize, isValidating, mutate } = useProducts(take);
  const items: Producto[] = useMemo(
    () => (data ?? []).flatMap((d: any) => d?.items ?? []),
    [data]
  );
  const last = data?.[data.length - 1];
  const hasMore = !!last?.nextCursor;

  // Subida de Excel / mensajes
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  // Paginación local (sobre lo ya descargado)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Seteo amigable para móviles en el primer render del cliente
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setItemsPerPage(25);
    }
  }, []);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Producto>>({});
  const [saving, setSaving] = useState(false);

  // Filtrar
  const filteredProductos = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return items.filter((p) => {
      const matchesSearch =
        !term ||
        p.codigo_interno.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term) ||
        (p.marca ?? "").toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || p.estado === statusFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in_stock" && p.stock_actual > 0) ||
        (stockFilter === "low_stock" && p.stock_actual > 0 && p.stock_actual < 10) ||
        (stockFilter === "out_of_stock" && p.stock_actual === 0);

      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [items, searchTerm, statusFilter, stockFilter]);

  // Paginación local
  const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProductos.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, stockFilter, itemsPerPage]);

  // Subir Excel + revalidación
  const uploadFile = async () => {
    if (!file) return;
    setLoading(true);
    setUploadMessage("");
    setUploadErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/products", { method: "POST", body: formData });
      const data: UploadResponse = await res.json();

      if (!res.ok) throw new Error(data.message || "Error al subir archivo");

      setUploadMessage(data.message);
      if (data.errores?.length) setUploadErrors(data.errores);

      await mutate(); // revalida desde el server (ETag)
      setFile(null);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setUploadMessage(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPlantilla = () => {
    window.location.href = "/api/products/template";
  };

  const startEditing = (producto: Producto) => {
    setEditingId(producto.id_producto);
    setEditingData(producto);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  // PATCH optimista
  const saveProduct = async () => {
    if (!editingId) return;

    setSaving(true);
    const body = { ...editingData };
    const prevPages = data; // snapshot para rollback

    await mutate(
      (pages: any) => {
        if (!pages) return pages;
        return pages.map((page: any) => {
          const arr = (page?.items ?? []) as Producto[];
          const next = arr.map((p) =>
            p.id_producto === editingId
              ? { ...p, ...body, fecha_actualizacion: new Date().toISOString() }
              : p
          );
          return { ...page, items: next };
        });
      },
      { revalidate: false }
    );

    try {
      const res = await fetch(`/api/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar producto");

      await mutate(); // confirma con datos del server
      setEditingId(null);
      setEditingData({});
      setUploadMessage("Producto actualizado correctamente");
    } catch (e) {
      await mutate(prevPages, { revalidate: false }); // rollback
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setUploadMessage(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // DELETE optimista
  const deleteProduct = async (id: string, codigo: string) => {
    if (!confirm(`¿Estás seguro de eliminar el producto ${codigo}?`)) return;
    const prevPages = data;

    await mutate(
      (pages: any) => {
        if (!pages) return pages;
        return pages.map((page: any) => {
          const arr = (page?.items ?? []) as Producto[];
          return { ...page, items: arr.filter((p) => p.id_producto !== id) };
        });
      },
      { revalidate: false }
    );

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar producto");
      await mutate(); // confirma
      setUploadMessage("Producto eliminado correctamente");
    } catch (e) {
      await mutate(prevPages, { revalidate: false }); // rollback
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setUploadMessage(`Error: ${msg}`);
    }
  };

  return (
    <div className="p-4 sm:p-6" style={{ minHeight: "100vh" }}>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6" style={{ color: "#00152F" }}>
        Inventario
      </h1>

      {/* Controles de carga */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <button
            onClick={downloadPlantilla}
            className="w-full sm:w-auto text-white px-5 py-3 rounded-lg transition-all duration-200 font-semibold hover:opacity-90 shadow-md"
            style={{ backgroundColor: "#00152F" }}
          >
            📥 Descargar plantilla Excel
          </button>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full sm:w-auto border-2 rounded-lg px-4 py-3 bg-white shadow-sm"
            style={{ borderColor: "#00152F", color: "#00152F" }}
          />

          <button
            onClick={uploadFile}
            disabled={!file || loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md ${
              !file || loading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
            } text-black`}
            style={{ backgroundColor: !file || loading ? "#ccc" : "#FFBD00" }}
          >
            {loading ? "⏳ Subiendo..." : "📤 Subir Excel"}
          </button>
        </div>

        {/* Mensajes */}
        {uploadMessage && (
          <div
            className={`p-4 rounded-lg shadow-sm ${
              uploadMessage.includes("Error")
                ? "bg-red-50 border-2 border-red-200"
                : "bg-green-50 border-2 border-green-200"
            }`}
            style={{ color: uploadMessage.includes("Error") ? "#dc2626" : "#059669" }}
          >
            {uploadMessage}
            <button
              onClick={() => setUploadMessage("")}
              className="ml-3 text-sm underline hover:no-underline"
            >
              ✕
            </button>
          </div>
        )}

        {uploadErrors.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg shadow-sm">
            <h4 className="font-bold mb-2" style={{ color: "#ea580c" }}>
              Advertencias:
            </h4>
            <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto" style={{ color: "#c2410c" }}>
              {uploadErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por código, descripción o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#00152F", color: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#00152F", color: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
          >
            <option value="all">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#00152F", color: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
          >
            <option value="all">Todo el stock</option>
            <option value="in_stock">Con stock</option>
            <option value="low_stock">Stock bajo (&lt;10)</option>
            <option value="out_of_stock">Sin stock</option>
          </select>

          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="border-2 rounded-lg px-4 py-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#00152F", color: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
            <option value={200}>200 por página</option>
          </select>
        </div>
      </div>

      {/* Estadísticas (sobre items cargados) */}
      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="p-4 rounded-lg shadow-md text-white" style={{ backgroundColor: "#00152F" }}>
          <span className="font-semibold text-base sm:text-lg">Total (cargados): {items.length}</span>
        </div>
        <div className="p-4 rounded-lg shadow-md" style={{ backgroundColor: "#FFBD00", color: "#00152F" }}>
          <span className="font-semibold text-base sm:text-lg">Filtrados: {filteredProductos.length}</span>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-md border-2 border-green-200">
          <span className="font-semibold text-base sm:text-lg text-green-800">
            Con stock: {items.filter((p) => p.stock_actual > 0).length}
          </span>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg shadow-md border-2 border-orange-200">
          <span className="font-semibold text-base sm:text-lg text-orange-800">
            Stock bajo: {items.filter((p) => p.stock_actual > 0 && p.stock_actual < 10).length}
          </span>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow-md border-2 border-red-200">
          <span className="font-semibold text-base sm:text-lg text-red-800">
            Sin stock: {items.filter((p) => p.stock_actual === 0).length}
          </span>
        </div>
      </div>

      {/* Traer más del servidor */}
      {hasMore && (
        <div className="mb-4">
          <button
            onClick={() => setSize(size + 1)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
          >
            Cargar más del servidor {isValidating ? "…" : ""}
          </button>
        </div>
      )}

      {/* Paginación superior local */}
      {totalPages > 1 && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white rounded-lg shadow-md">
          <div className="text-xs sm:text-sm font-medium" style={{ color: "#00152F" }}>
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredProductos.length)} de{" "}
            {filteredProductos.length} productos
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === 1 ? "#ccc" : "#00152F" }}
            >
              ← Anterior
            </button>
            <span className="text-xs sm:text-sm font-medium" style={{ color: "#00152F" }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === totalPages ? "#ccc" : "#00152F" }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
        <table className="min-w-full table-auto text-xs sm:text-sm">
          <thead className="text-white sticky top-0" style={{ backgroundColor: "#00152F" }}>
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left font-semibold">Código</th>
              <th className="px-3 sm:px-4 py-3 text-left font-semibold">Descripción</th>
              <th className="px-3 sm:px-4 py-3 text-left font-semibold hidden md:table-cell">Marca</th>
              <th className="px-3 sm:px-4 py-3 text-left font-semibold hidden lg:table-cell">Modelo</th>
              <th className="px-3 sm:px-4 py-3 text-right font-semibold">Stock</th>
              <th className="px-3 sm:px-4 py-3 text-right font-semibold">Precio (USD)</th>
              <th className="px-3 sm:px-4 py-3 text-left font-semibold hidden xl:table-cell">Ubicación</th>
              <th className="px-3 sm:px-4 py-3 text-center font-semibold hidden md:table-cell">Estado</th>
              <th className="px-3 sm:px-4 py-3 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center" style={{ color: "#00152F" }}>
                  <div className="text-base sm:text-lg font-medium">
                    {items.length === 0
                      ? "No hay productos cargados. Descarga la plantilla y sube tu primer archivo Excel."
                      : "No se encontraron productos con los filtros aplicados."}
                  </div>
                </td>
              </tr>
            ) : (
              currentProducts.map((prod, index) => (
                <tr
                  key={prod.id_producto}
                  className={`transition-colors duration-150 border-b border-gray-100 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="px-3 sm:px-4 py-3 font-mono font-medium" style={{ color: "#00152F" }}>
                    {prod.codigo_interno}
                  </td>

                  <td className="px-3 sm:px-4 py-3">
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.descripcion ?? prod.descripcion ?? ""}
                        onChange={(e) => setEditingData({ ...editingData, descripcion: e.target.value })}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      <span
                        title={prod.descripcion}
                        className="block max-w-[14rem] sm:max-w-none truncate"
                        style={{ color: "#00152F" }}
                      >
                        {prod.descripcion}
                      </span>
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 hidden md:table-cell" style={{ color: "#00152F" }}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.marca ?? prod.marca ?? ""}
                        onChange={(e) => setEditingData({ ...editingData, marca: e.target.value })}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      prod.marca
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 hidden lg:table-cell" style={{ color: "#00152F" }}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.modelo ?? prod.modelo ?? ""}
                        onChange={(e) => setEditingData({ ...editingData, modelo: e.target.value })}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      prod.modelo
                    )}
                  </td>

                  <td
                    className={`px-3 sm:px-4 py-3 text-right font-bold ${
                      prod.stock_actual === 0
                        ? "text-red-600"
                        : prod.stock_actual < 10
                        ? "text-orange-600"
                        : "text-green-600"
                    }`}
                  >
                    {editingId === prod.id_producto ? (
                      <input
                        type="number"
                        value={editingData.stock_actual ?? prod.stock_actual}
                        onChange={(e) =>
                          setEditingData({ ...editingData, stock_actual: parseInt(e.target.value) || 0 })
                        }
                        className="w-20 px-2 py-1 text-xs border-2 rounded text-right focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      prod.stock_actual
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 text-right font-mono font-medium" style={{ color: "#00152F" }}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.precio_actual ?? prod.precio_actual}
                        onChange={(e) =>
                          setEditingData({ ...editingData, precio_actual: parseFloat(e.target.value) || 0 })
                        }
                        className="w-24 px-2 py-1 text-xs border-2 rounded text-right focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      `$${prod.precio_actual.toFixed(2)}`
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 hidden xl:table-cell" style={{ color: "#00152F" }}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.ubicacion_stock ?? prod.ubicacion_stock ?? ""}
                        onChange={(e) => setEditingData({ ...editingData, ubicacion_stock: e.target.value })}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      />
                    ) : (
                      prod.ubicacion_stock
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                    {editingId === prod.id_producto ? (
                      <select
                        value={editingData.estado ?? prod.estado}
                        onChange={(e) => setEditingData({ ...editingData, estado: e.target.value })}
                        className="px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{ borderColor: "#00152F", ["--tw-ring-color" as any]: "#FFBD00" }}
                      >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                          prod.estado === "Activo"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {prod.estado}
                      </span>
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3 text-center">
                    {editingId === prod.id_producto ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={saveProduct}
                          disabled={saving}
                          className="text-white px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 disabled:opacity-50 shadow-sm"
                          style={{ backgroundColor: "#00152F" }}
                        >
                          {saving ? "⏳" : "✓ Guardar"}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 shadow-sm text-black"
                          style={{ backgroundColor: "#FFBD00" }}
                        >
                          ✕ Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => startEditing(prod)}
                          className="text-white px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 hover:opacity-90 shadow-sm"
                          style={{ backgroundColor: "#00152F" }}
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => deleteProduct(prod.id_producto, prod.codigo_interno)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 hover:bg-red-700 shadow-sm"
                          title="Eliminar"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación inferior local */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white rounded-lg shadow-md">
          <div className="text-xs sm:text-sm font-medium" style={{ color: "#00152F" }}>
            Total: {filteredProductos.length} productos
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="w-full sm:w-auto px-3 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === 1 ? "#ccc" : "#00152F" }}
            >
              « Primera
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="w-full sm:w-auto px-3 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === 1 ? "#ccc" : "#00152F" }}
            >
              ‹ Anterior
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-4 py-2 rounded-lg font-medium shadow-sm ${
                    currentPage === pageNum ? "text-black" : "text-white hover:opacity-90"
                  }`}
                  style={{
                    backgroundColor: currentPage === pageNum ? "#FFBD00" : "#00152F",
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="w-full sm:w-auto px-3 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === totalPages ? "#ccc" : "#00152F" }}
            >
              Siguiente ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="w-full sm:w-auto px-3 py-2 rounded-lg font-medium disabled:opacity-50 text-white shadow-sm"
              style={{ backgroundColor: currentPage === totalPages ? "#ccc" : "#00152F" }}
            >
              Última »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
