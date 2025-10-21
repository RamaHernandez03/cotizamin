// src/components/TopNavbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import SignOutButton from "./TopNavbarSignOutButton";
import DashboardMenu from "./DashboardMenu";

export default function TopNavbar() {
  const { data: session } = useSession();
  const nombre = (session?.user as any)?.nombre ?? "";
  const avatarUrl =
    (session?.user as any)?.avatarUrl ||
    (session?.user as any)?.avatar_url || // por si viene con snake_case desde el server
    "/images/avatar-default.png";

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
      {/* NAVBAR: fijo SOLO en mobile, estático en tablet+desktop */}
      <header className="fixed md:static top-0 left-0 w-full z-50 md:z-auto bg-[#0A1B2E] text-white shadow-lg border-b border-gray-800">
        <div className="mx-auto flex h-16 md:h-24 max-w-7xl items-center justify-between px-4 sm:px-6 md:px-8 lg:px-16">
          <div className="flex items-center gap-4 md:gap-12">
            {/* Botón hamburguesa en mobile+tablet */}
            <button
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-md border border-white/10 hover:bg-white/10 focus:outline-none"
              aria-label="Abrir menú"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <Link href="/dashboard/home" className="text-xl md:text-3xl font-bold">
              <span className="text-white">Cotiza</span>
              <span className="text-[#FFBD00]">Min</span>
            </Link>

            {/* Links solo desktop (lg+) */}
            <nav className="hidden lg:flex gap-6 xl:gap-8 text-sm lg:text-base font-medium">
              <Link href="/dashboard/home" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">HOME</Link>
              <Link href="/dashboard/inventory" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">INVENTARIO</Link>
              <Link href="/dashboard/support" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">CONTÁCTANOS</Link>
            </nav>
          </div>

          {/* Bienvenida con avatar — visible desde sm: en adelante (como pediste “en la resolución que corresponde”) */}
          <div className="flex items-center gap-3 md:gap-6 max-w-[60%] md:max-w-none">
            {nombre && (
              <>
                <div className="hidden sm:flex items-center gap-3 md:gap-4">
                  {/* AVATAR */}
                  <div className="relative h-8 w-8 md:h-12 md:w-12 rounded-full overflow-hidden ring-2 ring-white/15 bg-[#0F2744]">
                    <Image
                      src={avatarUrl}
                      alt="Avatar empresa"
                      fill
                      sizes="48px"
                      className="object-cover"
                      priority
                    />
                  </div>

                  {/* BLOQUE TEXTO: BIENVENIDO (arriba) + NOMBRE (abajo) */}
                  <div className="leading-tight">
                    <div className="text-[10px] md:text-xs tracking-[0.14em] text-gray-300 uppercase">
                      Bienvenido
                    </div>
                    <div className="text-sm md:text-base font-extrabold uppercase text-white truncate max-w-[160px] md:max-w-[240px]">
                      {nombre}
                    </div>
                  </div>
                </div>

                {/* Botón salir solo desktop (lg+) */}
                <div className="hidden lg:block">
                  <SignOutButton />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Spacer solo en mobile (porque el header es fixed solo ahí) */}
      <div className="h-16 md:hidden" />

      {/* Drawer mobile+tablet */}
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white text-gray-900 shadow-2xl p-4 overflow-y-auto flex flex-col">
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

            {session?.user && (
              <div className="bg-gray-50 rounded-lg border p-3 mb-4">
                <p className="text-sm text-gray-700">
                  Hola <span className="font-semibold">{(session.user as any).nombre || "Usuario"}</span>
                </p>
                <p className="text-xs text-gray-500">RUC: {(session.user as any).ruc || "N/A"}</p>
              </div>
            )}

            <div className="flex-1">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">MI CUENTA</h3>
                <DashboardMenu onNavigate={() => setOpen(false)} />
              </div>

              <div className="mt-6 border-t pt-4">
                <Link
                  href="/dashboard/support"
                  className="block w-full text-center rounded-md bg-[#0A1B2E] text-white py-2 text-sm font-medium hover:opacity-90"
                  onClick={() => setOpen(false)}
                >
                  Contáctanos
                </Link>
              </div>
            </div>

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
