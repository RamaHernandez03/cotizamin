"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, FormEvent } from "react";

function isValidRuc11(v: string) {
  return /^\d{11}$/.test(v);
}

export default function RucForm({ from }: { from: string }) {
  const router = useRouter();
  const { update } = useSession();

  const [ruc, setRuc] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      if (!isValidRuc11(ruc)) throw new Error("El RUC debe tener exactamente 11 dígitos.");

      const fd = new FormData();
      fd.set("ruc", ruc);
      const res = await fetch("/onboarding/ruc/submit", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Error guardando RUC");

      await update({}); // refresca JWT
      router.replace(from || "/dashboard/home");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4">
      {/* Imagen de fondo con filtro */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/ruc.jpeg')" }}
      />

      {/* Overlay con filtro oscuro */}
      <div className="absolute inset-0 bg-[#00152F]/70 backdrop-blur-sm" />

      {/* Contenido principal */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-3xl font-bold mb-3 text-white text-center">Completa tu RUC</h1>
          <p className="text-white/80 mb-8 text-center leading-relaxed">
            Para continuar usando CotizaMin necesitamos tu RUC. Se guarda una única vez.
          </p>

          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div>
              <label className="block text-white font-medium mb-3">RUC</label>
              <input
                value={ruc}
                onChange={(e) => {
                  // solo números y tope 11
                  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setRuc(v);
                  if (err) setErr(null);
                }}
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#FFBD00] focus:border-transparent backdrop-blur-sm transition-all duration-200"
                placeholder="Ej: 12345678901"
                required
                inputMode="numeric"
                maxLength={11}
                pattern="\d{11}"
              />
              <p className="mt-1 text-white/70 text-xs">Debe tener exactamente 11 dígitos.</p>
            </div>

            {err && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm backdrop-blur-sm">
                {err}
              </div>
            )}

            <button
              disabled={loading || !isValidRuc11(ruc)}
              className="w-full rounded-xl bg-gradient-to-r from-[#FFBD00] to-yellow-400 hover:from-yellow-400 hover:to-[#FFBD00] text-[#0A1B2E] font-bold py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 shadow-lg"
            >
              {loading ? "Guardando..." : "Guardar RUC"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer con logo CotizaMin */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 bg-[#00152F]/30 backdrop-blur-sm border-t border-white/10">
        <div className="flex justify-center py-4">
          <div className="text-2xl font-bold">
            <span className="text-white">Cotiza</span>
            <span className="text-[#FFBD00]">Min</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
