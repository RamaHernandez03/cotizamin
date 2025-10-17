// components/NotificationWatcher.tsx
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-[61] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              ¡Nuevas notificaciones!
            </h3>
            <p className="mt-1 text-sm text-gray-700">
              Se detectaron <strong>{count}</strong> nuevas recomendaciones.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
          <a
            href="/notifications"
            onClick={onClose}
            className="rounded-lg bg-[#00152F] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ver notificaciones
          </a>
        </div>
      </div>
    </div>
  );
}

type Props = {
  clienteId: string;
  checkIntervalMs?: number;
  showOnNotificationsPage?: boolean;
};

export default function NotificationWatcher({
  clienteId,
  checkIntervalMs = 5 * 60 * 1000, // 5 minutos por defecto
  showOnNotificationsPage = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [newCount, setNewCount] = useState(0);
  
  // Referencias para evitar checks duplicados
  const lastCheckRef = useRef<number>(0);
  const lastBatchIdRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  const isOnNotificationsPage = pathname?.startsWith("/notifications");

  useEffect(() => {
    // No mostrar modal en /notifications a menos que se indique explícitamente
    if (isOnNotificationsPage && !showOnNotificationsPage) {
      return;
    }

    let mounted = true;

    async function checkForUpdates() {
      // Evitar checks simultáneos
      if (isCheckingRef.current) return;
      
      // Throttle: no checkear más de una vez cada 30 segundos
      const now = Date.now();
      if (now - lastCheckRef.current < 30000) return;
      
      isCheckingRef.current = true;
      lastCheckRef.current = now;

      try {
        // Single request con caché HTTP (ETag)
        const res = await fetch(
          `/api/recommendations/latest?cliente_id=${clienteId}`,
          { 
            cache: "no-store",
            headers: {
              // Si tenemos un ETag previo, usarlo para validación condicional
              ...(lastBatchIdRef.current && {
                'If-None-Match': `"${lastBatchIdRef.current}"`
              })
            }
          }
        );

        if (!mounted) return;

        // 304 Not Modified = no hay cambios
        if (res.status === 304) {
          isCheckingRef.current = false;
          return;
        }

        const data = await res.json();
        const currentBatchId = data?.batchId;
        const currentTotal = data?.total ?? 0;

        if (!currentBatchId) {
          isCheckingRef.current = false;
          return;
        }

        // Detectar cambios
        const hasChanged = 
          lastBatchIdRef.current && 
          lastBatchIdRef.current !== currentBatchId;

        if (hasChanged) {
          const prevTotal = parseInt(
            sessionStorage.getItem(`notif_total_${clienteId}`) || "0"
          );
          const diff = Math.max(0, currentTotal - prevTotal);

          // Mostrar modal solo si hay incremento real
          if (diff > 0 && !isOnNotificationsPage) {
            setNewCount(diff);
            setShowModal(true);
          }

          // Actualizar datos del servidor
          router.refresh();
        }

        // Actualizar referencias
        lastBatchIdRef.current = currentBatchId;
        sessionStorage.setItem(`notif_total_${clienteId}`, String(currentTotal));

      } catch (error) {
        console.error("[NotificationWatcher] Error:", error);
      } finally {
        isCheckingRef.current = false;
      }
    }

    // Check inicial después de 5 segundos (para no competir con SSR)
    const initialTimeout = setTimeout(() => {
      if (mounted) checkForUpdates();
    }, 5000);

    // Polling solo cuando la pestaña está visible
    const intervalId = setInterval(() => {
      if (mounted && document.visibilityState === "visible") {
        checkForUpdates();
      }
    }, checkIntervalMs);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [clienteId, checkIntervalMs, router, pathname, isOnNotificationsPage, showOnNotificationsPage]);

  return (
    <NotificationModal
      open={showModal}
      onClose={() => setShowModal(false)}
      count={newCount}
    />
  );
}