// src/components/TopNavbar.tsx (SERVER COMPONENT)
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutButton from "./TopNavbarSignOutButton"; // client subcomponent para el botón

export default async function TopNavbar() {
  const session = await getServerSession(authOptions);
  const nombre = (session?.user as any)?.nombre ?? "";

  return (
    <header className="w-full h-24 bg-[#0A1B2E] text-white flex items-center justify-between px-16 shadow-lg border-b border-gray-800">
      <div className="flex items-center gap-12">
        <Link href="/dashboard/home" className="text-2xl font-bold">
          <span className="text-white">Cotiza</span>
          <span className="text-[#FFBD00]">Min</span>
        </Link>
        <nav className="flex gap-8 text-base font-medium">
          <Link href="/dashboard/home" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">HOME</Link>
          <Link href="/dashboard/contact" className="hover:text-[#FFBD00] transition-colors duration-200 py-2">CONTÁCTANOS</Link>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        {nombre && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-medium">BIENVENIDO</span>
              <span className="text-[#FFBD00] font-semibold uppercase">{nombre}</span>
            </div>
            <SignOutButton />
          </>
        )}
      </div>
    </header>
  );
}
