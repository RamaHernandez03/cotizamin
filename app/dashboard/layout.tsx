// app/dashboard/layout.tsx
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import TopNavbar from "@/components/TopNavbar";
import DashboardMenu from "@/components/DashboardMenu";
import NotificationsWatcher from "@/components/NotificationsWatcher";
import GlobalChatFab from "@/components/GlobalChatFab";

function WelcomeCard({ user, ruc }: { user: string; ruc: string }) {
  return (
    <div className="bg-gradient-to-br from-[#00152F] to-[#001a3d] rounded-2xl shadow-lg p-6 mb-6 text-white border border-[#FFBD00]/20">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base md:text-lg font-bold mb-2">👋 Hola {user}</h2>
          <p className="text-sm text-blue-100 font-medium">RUC: <span className="text-[#FFBD00]">{ruc}</span></p>
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
        <h3 className="text-sm md:text-base font-bold text-[#00152F] mb-4 tracking-wide uppercase"> Navegación</h3>
        <div className="h-1 bg-gradient-to-r from-[#FFBD00] to-[#FFBD00]/30 rounded-full w-12"></div>
      </div>
      <DashboardMenu />
      <div className="mt-6 pt-6 border-t border-gray-200">
        <GlobalChatFab />
      </div>
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
      <NotificationsWatcher clienteId={String(clienteId)} pollMs={60000} />

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 px-3 sm:px-4 md:px-6 pt-4 md:pt-6 pb-8">
        {/* Sidebar */}
        <aside className="hidden md:block md:sticky md:top-20 md:self-start md:w-72 space-y-6 overflow-y-auto pr-2">
          <WelcomeCard user={(session.user as any).nombre || "Usuario"} ruc={cliente?.ruc || "N/A"} />
          <MenuWidget />
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#00152F] to-[#001a3d] text-white flex items-center justify-center text-xs md:text-sm px-4 py-5 mt-auto border-t border-[#FFBD00]/20">
        <span className="font-semibold">Cotizamin</span>
        <span className="mx-3 opacity-50">•</span>
        <span>todos los derechos reservados © {year}</span>
      </footer>
    </div>
  );
}