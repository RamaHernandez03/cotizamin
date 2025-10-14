// app/admin/test-lab/AdminNavbar.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

interface AdminNavbarProps {
  userEmail: string;
}

export default function AdminNavbar({ userEmail }: AdminNavbarProps) {
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
      {/* NAVBAR: fijo en mobile, estático en desktop */}
      <header className="fixed md:static top-0 left-0 w-full z-50 md:z-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-b border-blue-800">
        <div className="mx-auto flex h-16 md:h-20 max-w-[1600px] items-center justify-between px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-4 md:gap-8">
            {/* Botón hamburguesa SOLO en mobile */}
            <button
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-blue-500 focus:outline-none"
              aria-label="Abrir menú"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <Link href="/dashboard/home" className="text-lg md:text-xl font-bold">
              <span className="text-white">Cotiza</span>
              <span className="text-yellow-300">Min</span>
            </Link>

            {/* Links solo desktop */}
            <nav className="hidden md:flex gap-6 text-sm font-medium">
              <Link href="/dashboard/home" className="hover:text-yellow-300 transition-colors duration-200 py-2">
                Dashboard
              </Link>
              <span className="text-blue-300">/</span>
              <span className="text-blue-100">Admin Lab</span>
            </nav>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Email y LogOut solo desktop */}
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-blue-100">
                {userEmail}
              </span>
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: "/" })}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-blue-500"
              onClick={() => setOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948-.684l1.498-4.493a1 1 0 011.502-.684l1.498 4.493a1 1 0 00.948.684H19a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white text-gray-900 shadow-2xl p-4 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold">
                <span className="text-blue-600">Cotiza</span>
                <span className="text-yellow-400">Min</span>
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

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Admin Email</span>
              </p>
              <p className="text-xs text-gray-600 break-all">{userEmail}</p>
            </div>

            <div className="flex-1">
              <nav className="space-y-2">
                <Link
                  href="/dashboard/home"
                  className="block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  Dashboard
                </Link>
              </nav>
            </div>

            <div className="border-t pt-4 mt-4">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ redirect: true, callbackUrl: "/" });
                }}
                className="w-full rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}