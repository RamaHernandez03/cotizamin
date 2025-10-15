"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const handle = () => onNavigate?.();
  const clickProps = onNavigate ? ({ onClick: handle } as const) : {};

  const menuItems = [
    { href: "/dashboard/home", icon: "📋", label: "Resumen" },
    { href: "/dashboard/inventory", icon: "📦", label: "Inventario" },
    { href: "/dashboard/sales", icon: "⭐", label: "Ventas" },
    { href: "/dashboard/feedback", icon: "💬", label: "Cotizaciones" },
    { href: "/dashboard/notifications", icon: "🔔", label: "Notificaciones" },
    { href: "/dashboard/stats", icon: "📊", label: "Estadísticas" },
    { href: "/dashboard/support", icon: "🛠️", label: "Soporte" },
    { href: "/dashboard/profile", icon: "👤", label: "Mi Perfil" },
  ];

  return (
    <nav className="space-y-2 pt-2 pb-8">
      {menuItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
              font-medium text-sm
              ${
                active
                  ? "bg-gradient-to-r from-[#00152F] to-[#001a3d] text-white shadow-md border border-[#FFBD00]/30"
                  : "text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-50/50 hover:text-[#00152F] border border-transparent hover:border-blue-200"
              }
            `}
            {...clickProps}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <span className="text-sm font-semibold">{item.label}</span>
            {active && <span className="ml-auto text-[#FFBD00]">●</span>}
          </Link>
        );
      })}
    </nav>
  );
}
