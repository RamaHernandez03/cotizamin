// src/components/TopNavbar.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutButton from "./TopNavbarSignOutButton";

export default async function TopNavbar() {
  const session = await getServerSession(authOptions);
  const nombre = (session?.user as any)?.nombre ?? "";

  return (
    <header className="w-full h-16 md:h-24 bg-[#0A1B2E] text-white flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-16 shadow-lg border-b border-gray-800">
      <div className="flex items-center gap-6 md:gap-12">
        <Link href="/dashboard/home" className="text-xl md:text-2xl font-bold">
          <span className="text-white">Cotiza</span>
          <span className="text-[#FFBD00]">Min</span>
        </Link>
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
            <SignOutButton />
          </>
        )}
      </div>
    </header>
  );
}
