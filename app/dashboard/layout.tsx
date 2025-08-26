import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TopNavbar from "@/components/TopNavbar";

// Componente de saludo
function WelcomeCard({ user, ruc }: { user: string; ruc: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-800">Hola {user}</h2>
      <p className="text-sm text-gray-600">RUC: {ruc}</p>
    </div>
  );
}

// Componente de menú tipo widget
function MenuWidget() {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800 mb-3">MI CUENTA</h3>
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
        <a href="/dashboard/settings" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">⚙️</span> <span className="text-sm">Configuración</span>
        </a>
        <a href="/dashboard/stats" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">📊</span> <span className="text-sm">Estadísticas</span>
        </a>
        <a href="/dashboard/support" className="flex items-center p-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <span className="mr-3">🛠️</span> <span className="text-sm">Soporte/Ayuda</span>
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

  // 🔐 Redirección si no hay sesión
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar superior */}
      <TopNavbar />

      {/* Contenedor principal con sidebar y contenido */}
      <div className="flex px-6 pt-6">
        {/* Sidebar tipo widget sticky */}
        <div className="sticky top-20 self-start w-64 h-[calc(100vh-6rem)] space-y-6 overflow-y-auto">
          <WelcomeCard user={session.user.nombre || "Usuario"} ruc={session.user.ruc || "N/A"} />
          <MenuWidget />
        </div>

        {/* Contenido principal */}
        <div className="flex-1 ml-8 p-6">
          <div className="bg-white rounded-xl shadow-sm min-h-[600px] p-8 text-base">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
