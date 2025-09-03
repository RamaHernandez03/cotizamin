// app/dashboard/layout.tsx
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TopNavbar from "@/components/TopNavbar";

function WelcomeCard({ user, ruc }: { user: string; ruc: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-base md:text-lg font-semibold text-gray-800">Hola {user}</h2>
      <p className="text-sm text-gray-600">RUC: {ruc}</p>
    </div>
  );
}

function MenuWidget() {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="mb-4">
        <h3 className="text-sm md:text-base font-semibold text-gray-800 mb-3">MI CUENTA</h3>
      </div>
      <nav className="space-y-2">
        <a href="/dashboard/home" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">📋</span> <span className="text-sm">Resumen</span>
        </a>
        <a href="/dashboard/inventory" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">📦</span> <span className="text-sm">Inventario</span>
        </a>
        <a href="/dashboard/sales" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">⭐</span> <span className="text-sm">Ventas</span>
        </a>
        <a href="/dashboard/feedback" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">⭐</span> <span className="text-sm">Feedback</span>
        </a>
        <a href="/dashboard/notifications" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">🔔</span> <span className="text-sm">Notificaciones</span>
        </a>
        <a href="/dashboard/stats" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">📊</span> <span className="text-sm">Estadísticas</span>
        </a>
        <a href="/dashboard/support" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">🛠️</span> <span className="text-sm">Soporte</span>
        </a>
        <a href="/dashboard/profile" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">👤</span> <span className="text-sm">Mi Perfil</span>
        </a>
      </nav>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavbar />

      {/* Contenedor principal: stack en mobile, 2 columnas desde md */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 px-3 sm:px-4 md:px-6 pt-4 md:pt-6">
        {/* Sidebar MOBILE (visible solo en < md) */}
        <div className="md:hidden space-y-4">
          <WelcomeCard user={(session.user as any).nombre || "Usuario"} ruc={(session.user as any).ruc || "N/A"} />
          <MenuWidget />
        </div>

        {/* Sidebar DESKTOP (hidden en mobile) */}
        <aside className="hidden md:block md:sticky md:top-20 md:self-start md:w-64 md:h-[calc(100vh-6rem)] space-y-6 overflow-y-auto">
          <WelcomeCard user={(session.user as any).nombre || "Usuario"} ruc={(session.user as any).ruc || "N/A"} />
          <MenuWidget />
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 md:ml-2">
          <div className="bg-white rounded-xl shadow-sm min-h-[60vh] p-4 sm:p-6 md:p-8 text-base">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
