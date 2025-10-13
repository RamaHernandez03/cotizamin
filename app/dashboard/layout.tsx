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
      <GlobalChatFab />
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNavbar />
      <NotificationsWatcher clienteId={String(clienteId)} pollMs={60000} />

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 px-3 sm:px-4 md:px-6 pt-4 md:pt-6">
        <aside className="hidden md:block md:sticky md:top-20 md:self-start md:w-64 md:h[calc(100vh-6rem)] space-y-6 overflow-y-auto">
          <WelcomeCard user={(session.user as any).nombre || "Usuario"} ruc={cliente?.ruc || "N/A"} />
          <MenuWidget />
        </aside>
        <main className="flex-1 md:ml-2">
          <div className="bg-white rounded-xl shadow-sm min-h-[60vh] p-4 sm:p-6 md:p-8 text-base">
            {children}
          </div>
        </main>
      </div>

      {/* ==== FOOTER AZUL ==== */}
      <footer className="h-16 bg-[#00152F] text-white flex items-center justify-center text-xs md:text-sm px-4 mt-8">
        Cotizamin — todos los derechos reservados © {year}
      </footer>
    </div>
  );
}
