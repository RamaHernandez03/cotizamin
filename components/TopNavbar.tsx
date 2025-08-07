// src/components/TopNavbar.tsx
"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function TopNavbar() {
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({
      callbackUrl: "/login", // Redirige al login después de cerrar sesión
      redirect: true,
    });
  };

  return (
    <header className="w-full h-24 bg-[#0A1B2E] text-white flex items-center justify-between px-16 shadow-lg border-b border-gray-800">
      {/* Logo + Links */}
      <div className="flex items-center gap-12">
        <Link href="/dashboard/home" className="text-2xl font-bold">
          <span className="text-white">Cotiza</span>
          <span className="text-[#FFBD00]">Min</span>
        </Link>
                
        <nav className="flex gap-8 text-base font-medium">
          <Link 
            href="/dashboard/home"
            className="hover:text-[#FFBD00] transition-colors duration-200 py-2"
          >
            HOME
          </Link>
          <Link 
            href="/dashboard/contact"
            className="hover:text-[#FFBD00] transition-colors duration-200 py-2"
          >
            CONTÁCTANOS
          </Link>
        </nav>
      </div>

      {/* Usuario + Logout */}
      <div className="flex items-center gap-6">
        {session?.user?.nombre && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-medium">BIENVENIDO</span>
              <span className="text-[#FFBD00] font-semibold uppercase">
                {session.user.nombre}
              </span>
            </div>
            
            {/* Botón de cerrar sesión */}
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
              SALIR
            </button>
          </>
        )}
      </div>
    </header>
  );
}