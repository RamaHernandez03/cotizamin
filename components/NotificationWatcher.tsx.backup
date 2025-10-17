"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* ===== Tipos mínimos ===== */
type Prioridad = "alta" | "media" | "baja";
type Tipo = "precio" | "stock" | "perfil";
type Recomendacion = { tipo: Tipo; mensaje: string; producto: string | null; prioridad: Prioridad };
type RecoResponse = {
  fecha_analisis: string | null;
  total_recomendaciones: number;
  recomendaciones: Recomendacion[];
  cachedAt?: string;
};

function isOlderThan(dateISO?: string | null, ms = 10 * 1000) {
  if (!dateISO) return true;
  const t = new Date(dateISO).getTime();
  return Number.isFinite(t) ? Date.now() - t > ms : true;
}

/** Modal compacto reutilizable */
function GlobalNotifModal({
  open,
  onClose,
  nuevos,
}: { open: boolean; onClose: () => void; nuevos: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-[61] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">¡Tienes nuevas notificaciones!</h3>
            <p className="mt-1 text-sm text-gray-700">
              Se detectaron <strong>{nuevos}</strong> nuevas recomendaciones.
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
            href="/notifications#historial"
            onClick={onClose}
            className="rounded-lg bg-[#00152F] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ver historial
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Watcher global:
 * - Si pasaron 24h desde el último refresh => pide refresh a n8n y vuelve a traer datos.
 * - Muestra modal si aumentó la cantidad de recomendaciones.
 * - Corre al montar y luego cada 10 min mientras la pestaña esté visible.
 * - Evita mostrar modal encima de /notifications (ahí ya lo maneja la propia página).
 */
export default function NotificationWatcher({
  baseUrl,
  clienteId,
  includeOnNotifications = false,
  checkIntervalMs = 10 * 60 * 1000, // 10 min
}: {
  baseUrl: string;
  clienteId: string;
  includeOnNotifications?: boolean;
  checkIntervalMs?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nuevosRef = useRef(0);

const storageKeys = {
  lastRefresh: `reco:lastRefresh:${clienteId}`,
  lastCount: `reco:lastCount:${clienteId}`,
  lastStamp: `reco:lastStamp:${clienteId}`, // 👈 nuevo
};

  async function fetchRecos(): Promise<RecoResponse | null> {
    try {
      const res = await fetch(`${baseUrl}/api/recommendations?cliente_id=${clienteId}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

async function refreshIfNeeded(showModal = true) {
  const localLast = localStorage.getItem(storageKeys.lastRefresh);
  const prevCount = Number(localStorage.getItem(storageKeys.lastCount) || 0);
  const prevStamp = localStorage.getItem(storageKeys.lastStamp) || undefined;

  const initial = await fetchRecos();
  if (!initial) return;

  const serverStamp = initial.cachedAt ?? initial.fecha_analisis ?? undefined;
  const dueByServer = isOlderThan(serverStamp, 24 * 60 * 60 * 1000);
  const dueByLocal = isOlderThan(localLast, 24 * 60 * 60 * 1000);
  const shouldRefresh = dueByServer || dueByLocal;

  const isOnNotifications = pathname?.startsWith("/notifications");
  if (isOnNotifications && !includeOnNotifications) {
    // actualizar baseline local y salir
    const currCount = initial.total_recomendaciones ?? initial.recomendaciones?.length ?? 0;
    localStorage.setItem(storageKeys.lastCount, String(currCount));
    if (serverStamp) localStorage.setItem(storageKeys.lastStamp, serverStamp);
    if (shouldRefresh) {
      await fetch(`${baseUrl}/api/recommendations/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId }),
        cache: "no-store",
      }).catch(() => {});
      localStorage.setItem(storageKeys.lastRefresh, new Date().toISOString());
    }
    return;
  }

  if (shouldRefresh) {
    // 1) disparo refresh
    await fetch(`${baseUrl}/api/recommendations/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId }),
      cache: "no-store",
    }).catch(() => {});

    // 2) vuelvo a consultar
    const next = await fetchRecos();
    const newCount = next?.total_recomendaciones ?? next?.recomendaciones?.length ?? 0;
    const newStamp = next?.cachedAt ?? next?.fecha_analisis ?? undefined;

    // 3) persistencias
    localStorage.setItem(storageKeys.lastRefresh, new Date().toISOString());
    localStorage.setItem(storageKeys.lastCount, String(newCount));
    if (newStamp) localStorage.setItem(storageKeys.lastStamp, newStamp);

    // 4) condición de modal:
    //    - si subió el total, abrimos con diff
    //    - si NO subió pero cambió el stamp (batch nuevo con mismo total), abrimos igual con diff=1
    const diff = Math.max(0, newCount - prevCount);
    const batchChanged = (newStamp && newStamp !== prevStamp) || false;

    if (showModal && (diff > 0 || batchChanged)) {
      nuevosRef.current = diff > 0 ? diff : 1;
      setOpen(true);
    }
  } else {
    // sin refresh: actualizar baseline local
    const currCount = initial.total_recomendaciones ?? initial.recomendaciones?.length ?? 0;
    localStorage.setItem(storageKeys.lastCount, String(currCount));
    if (serverStamp) localStorage.setItem(storageKeys.lastStamp, serverStamp);
  }
}

  useEffect(() => {
    // primera corrida
    refreshIfNeeded(true).catch(() => {});

    // intervalo (visible-only)
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshIfNeeded(false).catch(() => {});
      }
    }, checkIntervalMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, baseUrl]);

  return (
    <GlobalNotifModal
      open={open}
      onClose={() => setOpen(false)}
      nuevos={nuevosRef.current || 0}
    />
  );
}
