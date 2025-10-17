"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { MessageSquare, ChevronLeft, Loader2, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

type ConversationRow = {
  id: string;
  proyecto: string;
  peerName?: string | null;
  lastMessage?: string | null;
  unreadCount?: number;
  updatedAt?: string | null;
  saleId?: string | null;
  producto_desc?: string | null;
  codigo_interno?: string | null;
};

const AZUL = "#00152F";
const AZUL_CLARO = "#1a2942";
const ETAG_KEY = "etag:/api/chat/conversations";
const DATA_KEY = "data:/api/chat/conversations";

/* ===================== Utils ===================== */
async function safeJson(res: Response) {
  const txt = await res.text();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`Respuesta no-JSON (status ${res.status})`);
  }
}

function normalizeDesc(raw?: string | null) {
  const s = (raw || "").trim();
  if (!s) return "";
  let out = s.replace(/^\s*(adjudicaci[oó]n|venta|proyecto)\s*:\s*/i, "");
  out = out.replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
  return out;
}

function dedupeParts(parts: string[]) {
  const seen = new Set<string>();
  const res: string[] = [];
  for (const p of parts) {
    const k = p.toLocaleLowerCase();
    if (!p || seen.has(k)) continue;
    seen.add(k);
    res.push(p);
  }
  return res;
}

function formatTitle(c?: Pick<ConversationRow, "producto_desc" | "codigo_interno"> | null) {
  const base = "Venta";
  if (!c) return base;
  const desc = normalizeDesc(c.producto_desc);
  const code = (c.codigo_interno || "").trim();
  const pieces = dedupeParts([desc]).filter(Boolean);
  const right = [pieces.join(" - "), code].filter(Boolean).join(" ").trim();
  return right ? `${base} - ${right}` : base;
}

function getCachedConvs(): { ok: boolean; items: any[] } | null {
  try {
    const raw = sessionStorage.getItem(DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedConvs(json: any, etag: string | null) {
  try {
    sessionStorage.setItem(DATA_KEY, JSON.stringify(json));
    if (etag) sessionStorage.setItem(ETAG_KEY, etag);
  } catch {
    // ignore quota errors
  }
}

/* ===================== Component ===================== */

type OpenChatDetail = {
  conversationId: string;
  producto_desc?: string | null;
  codigo_interno?: string | null;
};

export default function GlobalChatFab() {
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");

  const [justNew, setJustNew] = useState(false);
  const lastUnreadRef = useRef<number>(0);
  const justNewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  function timeAgo(iso?: string | null) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }

  const fetchList = async (signal?: AbortSignal) => {
    try {
      const prevEtag = sessionStorage.getItem(ETAG_KEY) || undefined;

      const res = await fetch("/api/chat/conversations?take=30", {
        cache: "no-store",
        headers: { 
          Accept: "application/json", 
          ...(prevEtag ? { "If-None-Match": prevEtag } : {}) 
        },
        signal,
      });

      // ===== 304 Not Modified - sin cambios =====
      if (res.status === 304) {
        const cached = getCachedConvs();
        if (cached?.ok && Array.isArray(cached.items)) {
          const items: ConversationRow[] = cached.items
            .map((x: any): ConversationRow => ({
              id: x.id,
              proyecto: x.proyecto ?? "Venta",
              peerName: x.peerName ?? null,
              lastMessage: x.lastMessage ?? null,
              unreadCount: x.unreadCount ?? 0,
              updatedAt: x.updatedAt ?? null,
              saleId: x.saleId ?? null,
              producto_desc: x.producto_desc ?? null,
              codigo_interno: x.codigo_interno ?? null,
            }))
            .sort((a: ConversationRow, b: ConversationRow) => {
              const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return tb - ta;
            });
          setConvs(items);
          if (activeId) {
            const current = items.find((i) => i.id === activeId);
            setActiveTitle(formatTitle(current || undefined));
          }
          setErrorList(null);
          return;
        }
        // Si no hay cache válido, forzar refetch completo
        sessionStorage.removeItem(ETAG_KEY);
        return await fetchList(signal);
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || res.statusText || `HTTP ${res.status}`);
      }

      const json = await safeJson(res);
      const etag = res.headers.get("ETag");

      if (json?.ok === true && Array.isArray(json.items)) {
        setCachedConvs(json, etag);
        const items: ConversationRow[] = json.items
          .map((x: any): ConversationRow => ({
            id: x.id,
            proyecto: x.proyecto ?? "Venta",
            peerName: x.peerName ?? null,
            lastMessage: x.lastMessage ?? null,
            unreadCount: x.unreadCount ?? 0,
            updatedAt: x.updatedAt ?? null,
            saleId: x.saleId ?? null,
            producto_desc: x.producto_desc ?? null,
            codigo_interno: x.codigo_interno ?? null,
          }))
          .sort((a: ConversationRow, b: ConversationRow) => {
            const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return tb - ta;
          });
        setConvs(items);
        if (activeId) {
          const current = items.find((i) => i.id === activeId);
          setActiveTitle(formatTitle(current || undefined));
        }
        setErrorList(null);
      } else {
        throw new Error("Formato inesperado de la respuesta");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErrorList(e?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => setMounted(true), []);

  // ===== Polling optimizado con visibilidad =====
  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (!mounted) return;
      
      // Cancelar request anterior si sigue en vuelo
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      setLoading(true);
      await fetchList(abortControllerRef.current.signal);
    };

    // Primer fetch inmediato
    tick();

    // Intervalo adaptativo
    const computeInterval = () => {
      if (document.visibilityState === "hidden") return 60000; // 60s en background
      if (open) return 15000; // 15s si el panel está abierto
      return 30000; // 30s si está cerrado
    };

    const setupInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, computeInterval());
    };

    setupInterval();

    // Listener de visibilidad
    const onVisibility = () => {
      setupInterval();
      if (document.visibilityState === "visible") {
        tick(); // Refetch inmediato al volver visible
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (intervalId) clearInterval(intervalId);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [open, activeId]);

  const totalUnread = useMemo(
    () => convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [convs]
  );

  // ===== Efecto de "nuevo mensaje" =====
  useEffect(() => {
    if (!open && totalUnread > lastUnreadRef.current) {
      setJustNew(true);
      if (justNewTimerRef.current) clearTimeout(justNewTimerRef.current);
      justNewTimerRef.current = setTimeout(() => setJustNew(false), 5000);
    }
    lastUnreadRef.current = totalUnread;
  }, [totalUnread, open]);

  useEffect(() => {
    return () => {
      if (justNewTimerRef.current) clearTimeout(justNewTimerRef.current);
    };
  }, []);

  // ===== Listener de evento custom para abrir chat =====
  useEffect(() => {
    function handleOpenChat(e: Event) {
      const { conversationId, producto_desc, codigo_interno } =
        (e as CustomEvent<OpenChatDetail>).detail || {};
      const composed = formatTitle({ producto_desc, codigo_interno });
      setOpen(true);
      setActiveId(conversationId || null);
      setActiveTitle(composed);
    }
    window.addEventListener("openGlobalChat", handleOpenChat as EventListener);
    return () => {
      window.removeEventListener("openGlobalChat", handleOpenChat as EventListener);
    };
  }, []);

  const onOpenConversation = (c: ConversationRow) => {
    setActiveId(c.id);
    setActiveTitle(formatTitle(c));
    setConvs((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
  };

  if (status !== "authenticated" || !mounted) return null;

  const body = (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* FAB */}
      <div className="absolute bottom-6 right-6 pointer-events-auto">
        <button
          onClick={() => {
            setOpen((v) => !v);
            setJustNew(false);
          }}
          aria-label="Abrir mensajes"
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 relative group"
          style={{ backgroundColor: AZUL }}
        >
          <MessageSquare className="w-7 h-7 text-white transition-transform group-hover:scale-110" />
          {totalUnread > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center text-white shadow-lg animate-pulse"
              style={{ backgroundColor: "#ef4444" }}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
          {!open && justNew && (
            <>
              <span
                className="absolute top-2 right-2 inline-flex h-3 w-3 rounded-full animate-ping opacity-75"
                style={{ backgroundColor: "#ef4444" }}
              />
              <span
                className="absolute top-2 right-2 inline-flex h-3 w-3 rounded-full"
                style={{ backgroundColor: "#ef4444" }}
                aria-hidden
              />
            </>
          )}
          {!open && totalUnread > 0 && (
            <span
              className="absolute inset-0 rounded-full ring-2 animate-[pulse_1.6s_ease-in-out_infinite]"
              style={{ boxShadow: "0 0 0 6px rgba(239,68,68,0.15)" }}
              aria-hidden
            />
          )}
        </button>
      </div>

      {/* Panel del chat */}
      {open && (
        <div className="pointer-events-auto absolute bottom-24 right-6">
          <div className="w-[28rem] max-w-[min(28rem,calc(100vw-24px))] bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-100">
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 text-white relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${AZUL} 0%, ${AZUL_CLARO} 100%)` }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {activeId ? (
                  <>
                    <button
                      onClick={() => setActiveId(null)}
                      className="p-1.5 -ml-1 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                      aria-label="Volver a mis ventas"
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <div className="font-semibold truncate text-base">{activeTitle || "Chat"}</div>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5 text-white/90" />
                    <div className="font-semibold text-base">Mis Ventas</div>
                  </>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Contenido */}
            <div className="h-[560px] max-h-[70vh] flex flex-col bg-gray-50">
              {!activeId ? (
                <div className="flex-1 overflow-y-auto">
                  {loading && convs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 px-6">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: AZUL }} />
                      <p className="text-sm">Cargando conversaciones...</p>
                    </div>
                  )}
                  {errorList && !loading && convs.length === 0 && (
                    <div className="m-4 p-4 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-sm text-red-700 font-medium">Error</p>
                      <p className="text-sm text-red-600 mt-1">{errorList}</p>
                    </div>
                  )}
                  {!loading && !errorList && convs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
                      <MessageSquare className="w-16 h-16 mb-3 opacity-30" />
                      <p className="text-sm text-center">No hay conversaciones todavía</p>
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    {convs.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onOpenConversation(c)}
                        className="w-full text-left p-4 rounded-2xl hover:bg-white transition-all duration-150 flex gap-3 items-start shadow-sm hover:shadow-md bg-white border border-gray-100"
                      >
                        <div
                          className="min-w-12 h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0"
                          style={{ backgroundColor: AZUL }}
                        >
                          {(c.peerName || c.proyecto || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-semibold truncate text-gray-900">
                              {formatTitle(c)}
                            </div>
                            <div className="text-xs text-gray-400 font-medium shrink-0">
                              {timeAgo(c.updatedAt)}
                            </div>
                          </div>
                          {c.peerName && (
                            <div className="text-xs text-gray-500 mb-1 truncate">{c.peerName}</div>
                          )}
                          <div className="text-sm text-gray-600 truncate">
                            {c.lastMessage || "Sin mensajes"}
                          </div>
                        </div>
                        {!!c.unreadCount && (
                          <span
                            className="ml-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: "#ef4444" }}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 bg-white">
                  <ChatPanel conversationId={activeId} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
}