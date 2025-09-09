// src/components/TopNavbar.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import SignOutButton from "./TopNavbarSignOutButton";
import DashboardMenu from "./DashboardMenu";

export default function TopNavbar() {
  const { data: session } = useSession();
  const nombre = (session?.user as any)?.nombre ?? "";

  const [open, setOpen] = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* NAVBAR */}
      <header className="w-full h-16 md:h-24 bg-[#0A1B2E] text-white flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-16 shadow-lg border-b border-gray-800">
        <div className="flex items-center gap-4 md:gap-12">
          {/* Botón hamburguesa SOLO en mobile */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md border border-white/10 hover:bg-white/10 focus:outline-none"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            {/* Ícono hamburguesa simple */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/dashboard/home" className="text-xl md:text-2xl font-bold">
            <span className="text-white">Cotiza</span>
            <span className="text-[#FFBD00]">Min</span>
          </Link>

          {/* Links solo desktop */}
          <nav className="hidden md:flex gap-6 lg:gap-8 text-sm md:text-base font-medium">
            <Link href="/dashboard/home" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">HOME</Link>
            <Link href="/dashboard/contact" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">CONTÁCTANOS</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-6 max-w-[60%] md:max-w-none">
          {nombre && (
            <>
              <div className="hidden sm:flex items-center gap-2 md:gap-3">
                <span className="text-gray-400 font-medium text-xs md:text-sm">BIENVENIDO</span>
                <span className="text-[#FFBD00] font-semibold uppercase truncate max-w-[120px] sm:max-w-[180px]">
                  {nombre}
                </span>
              </div>
              {/* Botón de cerrar sesión SOLO en desktop */}
              <div className="hidden md:block">
                <SignOutButton />
              </div>
            </>
          )}
        </div>
      </header>

      {/* OVERLAY del Drawer (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Fondo oscuro clickeable para cerrar */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Panel lateral */}
          <aside
            className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white text-gray-900 shadow-2xl p-4 overflow-y-auto flex flex-col"
          >
            {/* Header dentro del drawer */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold">
                <span className="text-[#0A1B2E]">Cotiza</span>
                <span className="text-[#FFBD00]">Min</span>
              </div>
              <button
                className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Bienvenida breve */}
            {session?.user && (
              <div className="bg-gray-50 rounded-lg border p-3 mb-4">
                <p className="text-sm text-gray-700">
                  Hola <span className="font-semibold">{(session.user as any).nombre || "Usuario"}</span>
                </p>
                <p className="text-xs text-gray-500">
                  RUC: {(session.user as any).ruc || "N/A"}
                </p>
              </div>
            )}

            {/* Contenido principal del drawer */}
            <div className="flex-1">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">MI CUENTA</h3>
                <DashboardMenu onNavigate={() => setOpen(false)} />
              </div>

              {/* Contáctanos */}
              <div className="mt-6 border-t pt-4">
                <Link
                  href="/dashboard/contact"
                  className="block w-full text-center rounded-md bg-[#0A1B2E] text-white py-2 text-sm font-medium hover:opacity-90"
                  onClick={() => setOpen(false)}
                >
                  Contáctanos
                </Link>
              </div>
            </div>

            {/* Botón de cerrar sesión al final del drawer */}
            {session?.user && (
              <div className="border-t pt-4 mt-4">
                <div className="w-full">
                  <SignOutButton />
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}