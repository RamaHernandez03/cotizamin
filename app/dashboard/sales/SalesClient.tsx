// app/dashboard/sales/SalesClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Calendar,
  Package,
  FileText,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

type SaleRow = {
  id: string;
  fecha: string;
  proyecto: string;
  resultado: string;
  comentario?: string;
  producto_desc?: string | null;
  codigo_interno?: string | null;
  conversationId?: string | null;
  unreadCount?: number;
  cliente_user_id?: string | null;
  proveedor_id?: string | null;
};

const AZUL = "#00152F";
const AMARILLO = "#FFBD00";
const PAGE_SIZE = 10;

export default function SalesClient() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false); // <- sin loader interno

  // --- Paginación ---
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const pageNumbers = useMemo(() => {
    const MAX_BTNS = 5;
    let start = Math.max(1, page - Math.floor(MAX_BTNS / 2));
    let end = start + MAX_BTNS - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - MAX_BTNS + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const visibleRows = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return rows.slice(startIdx, startIdx + PAGE_SIZE);
  }, [rows, page]);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/sales/accepted", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
      }
      const data = await res.json().catch(() => {
        throw new Error("Respuesta inválida (JSON malformado)");
      });
      if (!data?.ok) throw new Error(data?.error || "Respuesta no OK del API");
      setRows(data.items as SaleRow[]);
      setPage(1);
    } catch (e: any) {
      setRows([]);
      setPage(1);
      setError(e?.message ?? "Error desconocido");
    } finally {
      setFetched(true); // <- primera carga completa (éxito o error)
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function ensureConversation(row: SaleRow) {
    if (row.conversationId) return row.conversationId;

    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerUserId: row.proveedor_id }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`No se pudo crear conversación: HTTP ${res.status} ${text}`);
    }
    const data = await res.json().catch(() => {
      throw new Error("No se pudo crear conversación (JSON inválido)");
    });
    if (!data?.ok || !data?.conversation?.id) {
      throw new Error(data?.error || "No se pudo crear conversación");
    }
    const convId = data.conversation.id as string;
    setRows((prev) =>
      prev.map((x) => (x.id === row.id ? { ...x, conversationId: convId } : x))
    );
    return convId;
  }

  async function openChat(row: SaleRow) {
    try {
      const convId = await ensureConversation(row);

      window.dispatchEvent(
        new CustomEvent("openGlobalChat", {
          detail: {
            conversationId: convId,
            title: `${row.producto_desc || "Producto"}${
              row.codigo_interno ? ` (${row.codigo_interno})` : ""
            }`,
            saleId: row.id,
          },
        })
      );

      await fetch("/api/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      }).catch(() => {});

      setRows((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, unreadCount: 0 } : x))
      );
    } catch (e: any) {
      setError(e?.message ?? "No se pudo abrir el chat");
    }
  }

  // No renderiza nada hasta que termine la primera carga (tu loading.tsx se encarga del suspense inicial).
  if (!fetched) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: AZUL }}
            >
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" style={{ color: AZUL }}>
                Mis Ventas
              </h1>
              <p className="text-gray-600 text-sm">Gestiona tus cotizaciones aceptadas</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 shadow-sm">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
              <span className="text-red-600 text-xs font-bold">!</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {rows.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${AZUL}15` }}
              >
                <Package className="w-10 h-10" style={{ color: AZUL }} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: AZUL }}>
                No hay ventas todavía
              </h3>
              <p className="text-gray-500">Tus cotizaciones aceptadas aparecerán aquí</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="text-white text-left text-sm"
                      style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #1a2942 100%)` }}
                    >
                      <th className="px-6 py-4 font-semibold">Producto</th>
                      <th className="px-6 py-4 font-semibold">Proyecto</th>
                      <th className="px-6 py-4 font-semibold">Fecha</th>
                      <th className="px-6 py-4 font-semibold">Estado</th>
                      <th className="px-6 py-4 font-semibold text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, idx) => {
                      const title = `${r.producto_desc || "Producto"}${
                        r.codigo_interno ? ` (${r.codigo_interno})` : ""
                      }`;
                      const unread = r.unreadCount ?? 0;

                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-start gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: `${AZUL}15` }}
                              >
                                <Package className="w-5 h-5" style={{ color: AZUL }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 truncate">{title}</div>
                                {r.comentario && (
                                  <div className="text-sm text-gray-600 line-clamp-2 mt-1">
                                    {r.comentario}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-700">{r.proyecto}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700">
                                {new Date(r.fecha).toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize"
                              style={{ backgroundColor: `${AZUL}15`, color: AZUL }}
                            >
                              {r.resultado}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-center">
                              <button
                                onClick={() => openChat(r)}
                                className="relative px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg group-hover:shadow-xl"
                                style={{ backgroundColor: AMARILLO, color: AZUL }}
                              >
                                <MessageSquare className="w-4 h-4" />
                                <span>Conversar</span>
                                {unread > 0 && (
                                  <span
                                    className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-lg"
                                    style={{ backgroundColor: "#ef4444" }}
                                  >
                                    {unread > 99 ? "99+" : unread}
                                  </span>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginador */}
              <div className="px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 items-center justify-between bg-gray-50 border-t">
                <span className="text-sm text-gray-600">
                  Página <strong>{page}</strong> de <strong>{totalPages}</strong> ·&nbsp;Mostrando{" "}
                  <strong>{visibleRows.length}</strong> de <strong>{rows.length}</strong>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-50 hover:bg-white transition"
                    style={{ color: AZUL }}
                    aria-label="Primera página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Primera</span>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-50 hover:bg-white transition"
                    style={{ color: AZUL }}
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>

                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                        n === page ? "shadow-sm" : "hover:bg-white"
                      }`}
                      style={
                        n === page
                          ? { backgroundColor: AMARILLO, color: AZUL, borderColor: "transparent" }
                          : { color: AZUL, borderColor: "#e5e7eb" }
                      }
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-50 hover:bg-white transition"
                    style={{ color: AZUL }}
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span className="hidden sm:inline">Siguiente</span>
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-50 hover:bg-white transition"
                    style={{ color: AZUL }}
                    aria-label="Última página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                    <span className="hidden sm:inline">Última</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
