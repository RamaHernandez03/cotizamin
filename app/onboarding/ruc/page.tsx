"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";

export default function OnboardingRucPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const from = sp.get("from") || "/dashboard";
  const { update } = useSession();

  const [ruc, setRuc] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("ruc", ruc);
      const res = await fetch("/onboarding/ruc/submit", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Error guardando RUC");

      await update({});
      router.replace(from);
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
        style={{
          backgroundImage: "url('/images/ruc.jpeg')"
        }}
      />
      
      {/* Overlay con filtro oscuro */}
      <div className="absolute inset-0 bg-[#00152F]/70 backdrop-blur-sm" />

      {/* Contenido principal */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-3xl font-bold mb-3 text-white text-center">
            Completa tu RUC
          </h1>
          <p className="text-white/80 mb-8 text-center leading-relaxed">
            Para continuar usando CotizaMin necesitamos tu RUC. Se guarda una única vez.
          </p>

          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-white font-medium mb-3">RUC</label>
              <input
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#FFBD00] focus:border-transparent backdrop-blur-sm transition-all duration-200"
                placeholder="Ej: 12345678901"
                required
                inputMode="numeric"
              />
            </div>

            {err && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm backdrop-blur-sm">
                {err}
              </div>
            )}

            <button
              disabled={loading || !ruc}
              className="w-full rounded-xl bg-gradient-to-r from-[#FFBD00] to-yellow-400 hover:from-yellow-400 hover:to-[#FFBD00] text-[#0A1B2E] font-bold py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </span>
              ) : (
                "Guardar RUC"
              )}
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