// app/admin/test-lab/AdminLabClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

type Row = {
  id_cliente: string;
  email: string;
  nombre: string;
  ruc: string | null;
  fecha_registro: string;
  productos_count: number;
  ultima_actualizacion_stock: string | null;
  ultima_sesion: string | null;
  participaciones: number;
};

type ListResponse = {
  ok: boolean;
  total: number;
  rows: Row[];
  error?: string;
};

type ItemsRow = {
  id_producto: string;
  codigo_interno: string;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  material: string | null;
  moneda: string;
  precio_actual: number;
  stock_actual: number;
  estado: string;
  fecha_actualizacion: string;
};

type ItemsResponse = {
  ok: boolean;
  total: number;
  rows: ItemsRow[];
  error?: string;
};

type Summary = {
  ok: boolean;
  total_clientes: number;
  total_productos: number;
  total_cotizaciones: number;
  total_busquedas: number;
  last_stock_update: string | null;
  ventas_30d: number;
};

type ProductBreakdown = {
  descripcion: string;
  total_items: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  price_distribution: number[];
  marcas: string | null;
  materiales: string | null;
  total_proveedores: number;
};

type ProductBreakdownResponse = {
  ok: boolean;
  total_items: number;
  breakdown: ProductBreakdown[];
  error?: string;
};

const PAGE_SIZE = 20;

export default function AdminLabClient() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);

  const [summary, setSummary] = useState<Summary | null>(null);

  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<{ id: string; email: string } | null>(null);
  const [items, setItems] = useState<ItemsResponse | null>(null);
  const [itemsQ, setItemsQ] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const itemsOffset = useMemo(() => (itemsPage - 1) * PAGE_SIZE, [itemsPage]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [paQ, setPaQ] = useState("");
  const [paBreakdown, setPaBreakdown] = useState<ProductBreakdownResponse | null>(null);
  const [paLoading, setPaLoading] = useState(false);
  const [paErr, setPaErr] = useState<string | null>(null);
  const [selectedBreakdownIndex, setSelectedBreakdownIndex] = useState<number | null>(null);

  async function loadMain() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const res = await fetch(`/api/test-lab/list?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ListResponse;
      if (!json.ok) throw new Error(json.error || "Error");
      setData(json);
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const res = await fetch(`/api/test-lab/summary`, { cache: "no-store" });
      const json = (await res.json()) as Summary;
      if (json.ok) setSummary(json);
    } catch {}
  }

  useEffect(() => {
    loadMain();
  }, [q, page]);

  useEffect(() => {
    loadSummary();
  }, []);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadMain();
  }

  async function openItems(clienteId: string, email: string) {
    setSelectedCliente({ id: clienteId, email });
    setOpenDrawer(true);
    setItemsPage(1);
    await loadItems(clienteId, "", 1);
  }

  async function loadItems(clienteId: string, qLocal: string, pageLocal: number) {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("clienteId", clienteId);
      if (qLocal) params.set("q", qLocal);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((pageLocal - 1) * PAGE_SIZE));
      const res = await fetch(`/api/test-lab/items?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ItemsResponse;
      setItems(json);
    } finally {
      setItemsLoading(false);
    }
  }

  function onItemsSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCliente) return;
    setItemsPage(1);
    loadItems(selectedCliente.id, itemsQ, 1);
  }

  async function runProductAnalytics(e: React.FormEvent) {
    e.preventDefault();
    setPaErr(null);
    setPaBreakdown(null);
    setSelectedBreakdownIndex(null);
    if (!paQ.trim()) return;
    setPaLoading(true);
    try {
      const res = await fetch(`/api/test-lab/product-breakdown?q=${encodeURIComponent(paQ.trim())}`, { cache: "no-store" });
      const json = (await res.json()) as ProductBreakdownResponse;
      if (!json.ok) throw new Error(json.error || "Error");
      setPaBreakdown(json);
    } catch (e: any) {
      setPaErr(e.message || "Error");
    } finally {
      setPaLoading(false);
    }
  }

  const totalPages = useMemo(() => {
    if (!data?.total) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  const itemsTotalPages = useMemo(() => {
    if (!items?.total) return 1;
    return Math.max(1, Math.ceil(items.total / PAGE_SIZE));
  }, [items]);

  function exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const val = row[header];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function exportClientes() {
    if (!data?.rows) return;
    exportToCSV(data.rows, 'clientes');
  }

  function exportProductos() {
    if (!items?.rows) return;
    exportToCSV(items.rows, `productos_${selectedCliente?.email || 'cliente'}`);
  }

  function exportBreakdownRow(row: ProductBreakdown) {
    exportToCSV([row], `producto_${row.descripcion.replace(/\s+/g, '_')}`);
  }

  function createPriceDistributionData(prices: number[]) {
    if (!prices || prices.length === 0) return [];
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const binCount = Math.min(20, Math.ceil(Math.sqrt(prices.length)));
    const binSize = range / binCount;
    
    const bins: { range: string; count: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binSize;
      const binMax = binMin + binSize;
      const count = prices.filter(p => p >= binMin && p <= binMax).length;
      bins.push({
        range: `$${num(binMin)}-$${num(binMax)}`,
        count,
      });
    }
    return bins;
  }

  return (
    <section className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard 
          label="Total Clientes" 
          value={summary?.total_clientes ?? "—"} 
          icon="👥"
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard 
          label="Productos" 
          value={summary?.total_productos ?? "—"} 
          icon="📦"
          gradient="from-blue-600 to-blue-700"
        />
        <StatCard 
          label="Cotizaciones" 
          value={summary?.total_cotizaciones ?? "—"} 
          icon="📋"
          gradient="from-yellow-500 to-yellow-600"
        />
        <StatCard 
          label="Búsquedas" 
          value={summary?.total_busquedas ?? "—"} 
          icon="🔍"
          gradient="from-blue-400 to-blue-500"
        />
        <StatCard 
          label="Ventas 30d" 
          value={summary?.ventas_30d ?? "—"} 
          icon="💰"
          gradient="from-green-500 to-green-600"
        />
        <StatCard 
          label="Última Actualización" 
          value={summary?.last_stock_update ? fmtDateShort(summary.last_stock_update) : "—"} 
          icon="🕒"
          gradient="from-gray-500 to-gray-600"
          small
        />
      </div>

      {/* Search and Analytics Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Client Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Buscar Cliente
            </label>
            <form onSubmit={onSearchSubmit} className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Email, nombre o RUC..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Buscar
              </button>
            </form>
          </div>

          {/* Product Analytics */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 Analytics de Productos
            </label>
            <form onSubmit={runProductAnalytics} className="flex gap-2">
              <input
                value={paQ}
                onChange={(e) => setPaQ(e.target.value)}
                placeholder="Descripción del producto..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
              />
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors shadow-sm"
              >
                Analizar
              </button>
            </form>
          </div>
        </div>

        {/* Analytics Results */}
        {(paLoading || paBreakdown || paErr) && (
          <div className="mt-4 space-y-4">
            {paLoading && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                Calculando analytics...
              </div>
            )}
            {paErr && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-600 font-medium">
                ⚠️ {paErr}
              </div>
            )}
            {paBreakdown && paBreakdown.breakdown.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  📦 {paBreakdown.total_items} productos encontrados - {paBreakdown.breakdown.length} tipos únicos
                </p>
                
                {/* Breakdown Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-yellow-200">
                      <tr>
                        <th className="text-left px-3 py-2">Descripción</th>
                        <th className="text-right px-3 py-2">Items</th>
                        <th className="text-right px-3 py-2">Precio Min</th>
                        <th className="text-right px-3 py-2">Precio Prom</th>
                        <th className="text-right px-3 py-2">Precio Max</th>
                        <th className="text-center px-3 py-2">Proveedores</th>
                        <th className="text-center px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paBreakdown.breakdown.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-yellow-50"}>
                          <td className="text-left px-3 py-2 font-medium max-w-xs truncate">{row.descripcion}</td>
                          <td className="text-right px-3 py-2">{row.total_items}</td>
                          <td className="text-right px-3 py-2">${num(row.min_price)}</td>
                          <td className="text-right px-3 py-2 font-semibold">${num(row.avg_price)}</td>
                          <td className="text-right px-3 py-2">${num(row.max_price)}</td>
                          <td className="text-center px-3 py-2">
                            <span className="inline-block px-2 py-0.5 bg-blue-200 text-blue-900 rounded text-xs font-medium">
                              {row.total_proveedores}
                            </span>
                          </td>
                          <td className="text-center px-3 py-2 space-x-2">
                            <button
                              onClick={() => setSelectedBreakdownIndex(selectedBreakdownIndex === idx ? null : idx)}
                              className="text-blue-600 hover:text-blue-800 font-medium underline"
                            >
                              {selectedBreakdownIndex === idx ? "Ocultar" : "Ver"} Gráfico
                            </button>
                            <button
                              onClick={() => exportBreakdownRow(row)}
                              className="text-green-600 hover:text-green-800 font-medium underline"
                            >
                              Exportar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Expanded Chart View */}
                {selectedBreakdownIndex !== null && paBreakdown.breakdown[selectedBreakdownIndex] && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-yellow-300">
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-800">
                        Distribución de Precios: {paBreakdown.breakdown[selectedBreakdownIndex].descripcion}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Marcas: {paBreakdown.breakdown[selectedBreakdownIndex].marcas || "N/A"} | Materiales: {paBreakdown.breakdown[selectedBreakdownIndex].materiales || "N/A"}
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={createPriceDistributionData(paBreakdown.breakdown[selectedBreakdownIndex].price_distribution)}
                        margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="range" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
            {paBreakdown && paBreakdown.breakdown.length === 0 && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-center text-sm text-gray-600">
                📭 No se encontraron productos con esa descripción
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">📋 Listado de Clientes</h2>
            <p className="text-sm text-gray-600 mt-1">
              {data ? `${data.rows.length} de ${data.total} clientes` : "Cargando..."}
            </p>
          </div>
          <button
            onClick={exportClientes}
            disabled={!data?.rows || data.rows.length === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            📥 Exportar CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">RUC</th>
                <th className="text-left px-4 py-3 font-semibold">Registrado</th>
                <th className="text-left px-4 py-3 font-semibold">Última Sesión</th>
                <th className="text-left px-4 py-3 font-semibold">Productos</th>
                <th className="text-left px-4 py-3 font-semibold">Participaciones</th>
                <th className="text-left px-4 py-3 font-semibold">Últ. Stock</th>
                <th className="text-left px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {loading && (
                <tr>
                  <td className="px-4 py-8 text-center" colSpan={9}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-600">Cargando datos...</span>
                    </div>
                  </td>
                </tr>
              )}
              {err && !loading && (
                <tr>
                  <td className="px-4 py-8 text-center text-red-600" colSpan={9}>
                    ⚠️ {err}
                  </td>
                </tr>
              )}
              {!loading && !err && data?.rows?.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>
                    📭 No se encontraron resultados
                  </td>
                </tr>
              )}
              {data?.rows?.map((r, i) => (
                <tr 
                  key={r.id_cliente} 
                  className={`${i % 2 === 0 ? "bg-white" : "bg-blue-50/30"} hover:bg-blue-100/50 transition-colors border-b border-gray-100`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openItems(r.id_cliente, r.email)}
                      className="text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                    >
                      📧 {r.email}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-gray-700">{r.ruc || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{fmtDate(r.fecha_registro)}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {r.ultima_sesion ? fmtDate(r.ultima_sesion) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {r.productos_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {r.participaciones}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {r.ultima_actualizacion_stock ? fmtDate(r.ultima_actualizacion_stock) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => openItems(r.id_cliente, r.email)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Ver detalle →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {data ? `Mostrando ${data.rows.length} de ${data.total} registros` : "—"}
          </span>
          <Pager page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </div>

      {/* Drawer */}
      {openDrawer && selectedCliente && (
        <div className="fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setOpenDrawer(false)} 
          />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[900px] bg-white shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">📦 Productos del Cliente</h3>
                <p className="text-blue-100 text-sm mt-1">{selectedCliente.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportProductos}
                  disabled={!items?.rows || items.rows.length === 0}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  📥 Exportar
                </button>
                <button 
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium text-white" 
                  onClick={() => setOpenDrawer(false)}
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <form onSubmit={onItemsSearch} className="flex gap-2">
                <input
                  value={itemsQ}
                  onChange={(e) => setItemsQ(e.target.value)}
                  placeholder="Buscar por descripción o código..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button 
                  type="submit" 
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  🔍 Buscar
                </button>
              </form>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-6">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-[960px] w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800">
                    <tr>
                      <th className="text-left px-3 py-3 font-semibold">Código</th>
                      <th className="text-left px-3 py-3 font-semibold">Descripción</th>
                      <th className="text-left px-3 py-3 font-semibold">Marca</th>
                      <th className="text-left px-3 py-3 font-semibold">Modelo</th>
                      <th className="text-left px-3 py-3 font-semibold">Material</th>
                      <th className="text-left px-3 py-3 font-semibold">Moneda</th>
                      <th className="text-left px-3 py-3 font-semibold">Precio</th>
                      <th className="text-left px-3 py-3 font-semibold">Stock</th>
                      <th className="text-left px-3 py-3 font-semibold">Estado</th>
                      <th className="text-left px-3 py-3 font-semibold">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {itemsLoading && (
                      <tr>
                        <td className="px-3 py-8 text-center" colSpan={10}>
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Cargando productos...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!itemsLoading && items?.rows?.length === 0 && (
                      <tr>
                        <td className="px-3 py-8 text-center text-gray-500" colSpan={10}>
                          📭 No se encontraron productos
                        </td>
                      </tr>
                    )}
                    {items?.rows?.map((r, i) => (
                      <tr 
                        key={r.id_producto} 
                        className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                      >
                        <td className="px-3 py-3 font-mono text-xs text-gray-900">{r.codigo_interno}</td>
                        <td className="px-3 py-3 font-medium text-gray-900">{r.descripcion}</td>
                        <td className="px-3 py-3 text-gray-800">{r.marca || "—"}</td>
                        <td className="px-3 py-3 text-gray-800">{r.modelo || "—"}</td>
                        <td className="px-3 py-3 text-gray-800">{r.material || "—"}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-900">
                            {r.moneda}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-green-700">{num(r.precio_actual)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            r.stock_actual > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {r.stock_actual}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            r.estado === 'Activo' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'
                          }`}>
                            {r.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">{fmtDate(r.fecha_actualizacion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {items ? `${items.rows.length} de ${items.total} productos` : "—"}
                </span>
                <Pager
                  page={itemsPage}
                  setPage={(p) => {
                    setItemsPage(p);
                    if (selectedCliente) loadItems(selectedCliente.id, itemsQ, p);
                  }}
                  totalPages={itemsTotalPages}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* UI Components */
function StatCard({ label, value, icon, gradient, small = false }: { 
  label: string; 
  value: any; 
  icon: string; 
  gradient: string;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${gradient} text-white p-4 shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold mb-1`}>{value}</div>
      <div className="text-xs font-medium opacity-90">{label}</div>
    </div>
  );
}

function Pager({ page, setPage, totalPages }: { 
  page: number; 
  setPage: (p: number) => void; 
  totalPages: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm font-medium"
      >
        ← Anterior
      </button>
      <span className="text-sm font-medium text-gray-700 px-3">
        Página {page} de {totalPages}
      </span>
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm font-medium"
      >
        Siguiente →
      </button>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function num(n: any) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}