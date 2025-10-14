// app/admin/test-lab/AdminLabClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id_cliente: string;
  email: string;
  nombre: string;
  ruc: string | null;
  fecha_registro: string; // ISO
  productos_count: number;
  ultima_actualizacion_stock: string | null; // ISO
  ultima_sesion: string | null; // ISO
};

type ListResponse = {
  ok: boolean;
  total: number;
  rows: Row[];
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

  async function load() {
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`¿Eliminar cliente ${email}? Esta acción borra sus productos y el cliente.`)) return;
    try {
      setLoading(true);
      const res = await fetch("/api/test-lab/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Error");
      // recarga lista
      await load();
      alert("Cliente eliminado.");
    } catch (e: any) {
      alert(e.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(() => {
    if (!data?.total) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  return (
    <section className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por email, nombre o RUC…"
          className="w-full md:w-96 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-[960px] w-full text-sm text-gray-800">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">RUC</th>
              <th className="text-left px-3 py-2">Registrado</th>
              <th className="text-left px-3 py-2"># Prod.</th>
              <th className="text-left px-3 py-2">Últ. stock</th>
              <th className="text-left px-3 py-2">Últ. sesión</th>
              <th className="text-left px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-3" colSpan={8}>
                  Cargando…
                </td>
              </tr>
            )}
            {err && !loading && (
              <tr>
                <td className="px-3 py-3 text-red-600" colSpan={8}>
                  {err}
                </td>
              </tr>
            )}
            {!loading && !err && data?.rows?.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-gray-500" colSpan={8}>
                  Sin resultados.
                </td>
              </tr>
            )}
            {data?.rows?.map((r) => (
              <tr key={r.id_cliente} className="border-t">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.nombre}</td>
                <td className="px-3 py-2">{r.ruc || "—"}</td>
                <td className="px-3 py-2">{fmtDate(r.fecha_registro)}</td>
                <td className="px-3 py-2">{r.productos_count}</td>
                <td className="px-3 py-2">{r.ultima_actualizacion_stock ? fmtDate(r.ultima_actualizacion_stock) : "—"}</td>
                <td className="px-3 py-2">{r.ultima_sesion ? fmtDate(r.ultima_sesion) : "—"}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDelete(r.id_cliente, r.email)}
                    className="px-2 py-1 rounded border text-red-700 border-red-200 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-black-800">
          {data ? `Mostrando ${data.rows.length} de ${data.total}` : "—"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-sm">
            Página {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </section>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
