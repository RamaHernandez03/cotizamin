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
import Image from "next/image";

function WelcomeCard({
  user, ruc, email, avatarUrl,
}: { user: string; ruc: string; email: string; avatarUrl?: string | null }) {
  const fallback = "/images/avatar-default.png";
  const src = avatarUrl || fallback;

  return (
    <div className="bg-gradient-to-br from-[#00152F] to-[#001a3d] rounded-2xl shadow-lg p-6 mb-6 text-white border border-[#FFBD00]/20">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative h-14 w-14 rounded-full ring-2 ring-white/20 overflow-hidden bg-[#0e223e]">
          {/* si falla la imagen, el onError del <img> básico es más simple; con <Image> usamos fallback por src ya resuelto */}
          <Image
            src={src}
            alt="Avatar empresa"
            fill
            sizes="56px"
            className="object-cover"
            priority
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-[#FFBD00] font-bold">Email: </p>
        <p className="text-sm text-blue-100 font-medium">
          <span className="text-white font-semibold">{email}</span>
        </p>
        <p className="text-sm text-[#FFBD00] font-bold">Razón social: </p>
        <p className="text-sm text-blue-100 font-medium">
          <span className="text-white font-semibold">{user}</span>
        </p>
        <p className="text-sm text-[#FFBD00] font-bold">RUC: </p>
        <p className="text-sm text-blue-100 font-medium">
          <span className="text-white font-semibold">{ruc}</span>
        </p>
      </div>

      <div className="mt-4 h-1 bg-gradient-to-r from-[#FFBD00] to-[#FFBD00]/30 rounded-full" />
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
  select: { ruc: true, ruc_locked: true, nombre: true, email: true, avatar_url: true },
});

  if (!cliente?.ruc_locked) {
    redirect("/onboarding/ruc?from=/dashboard");
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
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
  user={cliente?.nombre || (session.user as any).nombre || "Usuario"}
  ruc={cliente?.ruc || "N/A"}
  email={cliente?.email || (session.user as any).email || "—"}
  avatarUrl={cliente?.avatar_url || (session.user as any).avatarUrl}
/>
            <MenuWidget />
          </div>
        </aside>

        {/* Main */}
<main className="flex-1 rounded-2xl min-w-0 overflow-x-auto">
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