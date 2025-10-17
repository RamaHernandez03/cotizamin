// app/dashboard/layout.tsx
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import TopNavbar from "@/components/TopNavbar";
import DashboardMenu from "@/components/DashboardMenu";
import NotificationWatcher from "@/components/NotificationWatcher";
import GlobalChatFab from "@/components/GlobalChatFab";

function WelcomeCard({ user, ruc }: { user: string; ruc: string }) {
  return (
    <div className="bg-gradient-to-br from-[#00152F] to-[#001a3d] rounded-2xl shadow-lg p-6 mb-6 text-white border border-[#FFBD00]/20">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base md:text-lg font-bold mb-2">👋 Hola {user}</h2>
          <p className="text-sm text-blue-100 font-medium">
            RUC: <span className="text-[#FFBD00]">{ruc}</span>
          </p>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[#FFBD00] to-[#FFBD00]/30 rounded-full"></div>
    </div>
  );
}

function MenuWidget() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-md p-6 border border-gray-200/50">
      <div className="mb-6">
        <h3 className="text-sm md:text-base font-bold text-[#00152F] mb-4 tracking-wide uppercase">
          Navegación
        </h3>
        <div className="h-1 bg-gradient-to-r from-[#FFBD00] to-[#FFBD00]/30 rounded-full w-12"></div>
      </div>
      <DashboardMenu />
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const clienteId = (session.user as any)?.id as string;
  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: clienteId },
    select: { ruc: true, ruc_locked: true, nombre: true },
  });

  if (!cliente?.ruc_locked) {
    redirect("/onboarding/ruc?from=/dashboard");
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopNavbar />
      
      {/* 
        Watcher Unificado:
        - checkIntervalMs: 5 minutos (300000ms)
        - showOnNotificationsPage: false (no mostrar modal en /notifications)
      */}
      <NotificationWatcher 
        clienteId={String(clienteId)} 
        checkIntervalMs={5 * 60 * 1000}
        showOnNotificationsPage={false}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 px-3 sm:px-4 md:px-6 pt-4 md:pt-6 pb-8 w-full">
        {/* Sidebar con sticky y scroll interno */}
        <aside
          className="
            hidden md:block
            md:w-80 md:flex-shrink-0
          "
        >
          <div 
            className="
              sticky top-4
              max-h-[calc(100vh-8rem)]
              overflow-y-auto overflow-x-hidden
              space-y-6 pr-2
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
              hover:scrollbar-thumb-gray-400
            "
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db transparent'
            }}
          >
            <WelcomeCard
              user={(session.user as any).nombre || "Usuario"}
              ruc={cliente?.ruc || "N/A"}
            />
            <MenuWidget />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-x-auto">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#00152F] to-[#001a3d] text-white flex items-center justify-center text-xs md:text-sm px-4 py-5 mt-auto border-t border-[#FFBD00]/20 flex-shrink-0">
        <span className="font-semibold">Cotizamin</span>
        <span className="mx-3 opacity-50">•</span>
        <span>todos los derechos reservados © {year}</span>
      </footer>

      {/* FAB fuera del sidebar */}
      <GlobalChatFab />
    </div>
  );
}