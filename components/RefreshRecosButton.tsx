// components/RefreshRecosButton.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshRecosButton({ clienteId }: { clienteId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const run = async () => {
    setLoading(true);
    await fetch("/api/recommendations/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId }),
    });
    setLoading(false);
    router.refresh(); // vuelve a GET cacheado
  };

  return (
    <button
      onClick={run}
      className="px-3 py-2 rounded-md border text-gray-900 hover:bg-gray-50 text-sm"
      disabled={loading}
    >
      {loading ? "Actualizando…" : "Actualizar"}
    </button>
  );
}
