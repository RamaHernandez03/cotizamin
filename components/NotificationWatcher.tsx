"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NotificationModalProps = {
  open: boolean;
  onClose: () => void;
  count: number;
};

function NotificationModal({ open, onClose, count }: NotificationModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      <div className="relative z-[61] w-full max-w-md transform transition-all">
        <div className="rounded-3xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-2xl ring-1 ring-gray-200/50">
          {/* Header con icono animado */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00152F] to-[#003366] shadow-lg">
              <span className="text-3xl animate-bounce">🔔</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#00152F]">
                ¡Nuevas notificaciones!
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Se detectaron{" "}
                <span className="inline-flex items-center justify-center rounded-full bg-[#00152F] px-2.5 py-0.5 text-xs font-bold text-white">
                  {count}
                </span>{" "}
                nuevas recomendaciones para ti.
              </p>
            </div>
          </div>

          {/* Botones con mejor diseño */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              Cerrar
            </button>
            <a
              href="/dashboard/notifications"
              onClick={onClose}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#00152F] to-[#003366] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#00152F]/20 transition-all hover:shadow-xl hover:shadow-[#00152F]/30 hover:-translate-y-0.5"
            >
              Ver ahora
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  clienteId: string;
  checkIntervalMs?: number;
  pollMs?: number;
  showOnNotificationsPage?: boolean;

  // 👇 si podés, pasá estos valores iniciales desde el server (ver Fix B)
  initialETag?: string | null;
  initialBatchId?: string | null;
  initialTotal?: number | null;
};

export default function NotificationWatcher({
  clienteId,
  checkIntervalMs,
  pollMs,
  showOnNotificationsPage = false,
  initialETag = null,
  initialBatchId = null,
  initialTotal = null,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef(false);

  const lastETagRef = useRef<string | null>(initialETag);
  const lastBatchIdRef = useRef<string | null>(initialBatchId);

  const isOnNotificationsPage =
    pathname?.startsWith("/dashboard/notifications") ||
    pathname?.startsWith("/notifications");

  const interval =
    typeof checkIntervalMs === "number"
      ? checkIntervalMs
      : typeof pollMs === "number"
      ? pollMs
      : 5 * 60 * 1000;

  // Seed de sessionStorage si venís con datos iniciales del server
  useEffect(() => {
    const totalKey = `notif_total_${clienteId}`;
    const batchKey = `notif_batch_${clienteId}`;

    if (initialTotal != null && sessionStorage.getItem(totalKey) == null) {
      sessionStorage.setItem(totalKey, String(initialTotal));
    }
    if (initialBatchId && sessionStorage.getItem(batchKey) == null) {
      sessionStorage.setItem(batchKey, initialBatchId);
    }
  }, [clienteId, initialBatchId, initialTotal]);

  useEffect(() => {
    let mounted = true;

    async function checkForUpdates() {
      if (isCheckingRef.current) return;

      const now = Date.now();
      if (now - lastCheckRef.current < 30_000) return;

      isCheckingRef.current = true;
      lastCheckRef.current = now;

      try {
        const headers: Record<string, string> = {};
        if (lastETagRef.current) headers["If-None-Match"] = lastETagRef.current;

        const res = await fetch(
          `/api/recommendations/latest?cliente_id=${encodeURIComponent(
            clienteId
          )}`,
          { cache: "no-store", headers }
        );

        if (!mounted) return;

        if (res.status === 304) {
          isCheckingRef.current = false;
          return;
        }

        const etag = res.headers.get("ETag");
        if (etag) lastETagRef.current = etag;

        const data = await res.json();
        const currentBatchId: string | null = data?.batchId ?? null;
        const currentTotal: number = data?.total ?? 0;

        if (!currentBatchId) {
          isCheckingRef.current = false;
          return;
        }

        // Valores previamente vistos (persisten por pestaña)
        const totalKey = `notif_total_${clienteId}`;
        const batchKey = `notif_batch_${clienteId}`;
        const prevTotal = parseInt(sessionStorage.getItem(totalKey) || "0");
        const prevBatchId = sessionStorage.getItem(batchKey);

        // 1) Cambio explícito de batchId (caso normal)
        let changed =
          (lastBatchIdRef.current && lastBatchIdRef.current !== currentBatchId) ||
          (prevBatchId && prevBatchId !== currentBatchId);

        // 2) Primera corrida: si no teníamos batch previo,
        //    considerá "cambio" si el total aumentó vs lo guardado
        if (!changed && !lastBatchIdRef.current && !prevBatchId) {
          if (currentTotal > prevTotal) changed = true;
        }

        if (changed) {
          const diff = Math.max(0, currentTotal - prevTotal);

          const canShowHere =
            showOnNotificationsPage || !isOnNotificationsPage;

          if (diff > 0 && canShowHere) {
            setNewCount(diff);
            setShowModal(true);
          }

          router.refresh();
        }

        // persistimos como “lo visto”
        lastBatchIdRef.current = currentBatchId;
        sessionStorage.setItem(totalKey, String(currentTotal));
        sessionStorage.setItem(batchKey, currentBatchId);
      } catch (err) {
        console.error("[NotificationWatcher] Error:", err);
      } finally {
        isCheckingRef.current = false;
      }
    }

    const initialTimeout = setTimeout(() => {
      if (mounted) checkForUpdates();
    }, 5000);

    const intervalId = setInterval(() => {
      if (mounted && document.visibilityState === "visible") {
        checkForUpdates();
      }
    }, interval);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [clienteId, interval, router, pathname, showOnNotificationsPage, isOnNotificationsPage]);

  return (
    <NotificationModal
      open={showModal}
      onClose={() => setShowModal(false)}
      count={newCount}
    />
  );
}
