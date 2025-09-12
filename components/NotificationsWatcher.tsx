"use client";
import { useEffect, useRef, useState } from "react";
import NewNotification from "@/components/NewNotifications";

type Props = { clienteId: string; initialBatchId?: string | null; pollMs?: number; };

export default function NotificationsWatcher({ clienteId, initialBatchId = null, pollMs = 60000 }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const lastSeenBatchId = useRef<string | null>(initialBatchId);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const r1 = await fetch("/api/recommendations/refresh-if-stale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ cliente_id: clienteId, thresholdHours: 12 }),
        });
        const j1 = await r1.json().catch(() => ({}));
        const r2 = await fetch(`/api/recommendations/latest?cliente_id=${clienteId}`, { cache: "no-store" });
        const j2 = await r2.json();
        if (!mounted) return;

        const currentId: string | null = j2.batchId ?? null;
        const changed = !!(currentId && lastSeenBatchId.current && currentId !== lastSeenBatchId.current);
        const refreshed = j1?.refreshed === true;
        if (refreshed || changed) setIsOpen(true);
        if (currentId) lastSeenBatchId.current = currentId;
      } catch {}
    };

    tick(); // primera corrida
    const id = setInterval(tick, pollMs);
    return () => { mounted = false; clearInterval(id); };
  }, [clienteId, pollMs]);

  return <NewNotification isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
