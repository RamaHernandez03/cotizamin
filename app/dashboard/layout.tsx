// app/dashboard/layout.tsx
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#00152F] text-white p-6">
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-1">{session?.user?.nombre}</h2>
          <p className="text-sm text-gray-300">{session?.user?.ruc}</p>
        </div>

        <nav className="flex flex-col space-y-4">
          <Link href="/dashboard/home" className="hover:text-yellow-300">
            🏠 Inicio
          </Link>
          <Link href="/dashboard/inventory" className="hover:text-yellow-300">
            📦 Inventario
          </Link>
          <Link href="/dashboard/support" className="hover:text-yellow-300">
            🛠️ Soporte
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-100 p-8">{children}</main>
    </div>
  );
}
