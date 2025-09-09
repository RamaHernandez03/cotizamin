// src/components/DashboardMenu.tsx
"use client";

import Link from "next/link";

export default function DashboardMenu({ onNavigate }: { onNavigate?: () => void }) {
  const itemClass =
    "flex items-center p-2 text-gray-700 hover:bg-[#00152F] hover:text-[#efefef] rounded-md transition-colors";

  const handle = () => onNavigate?.();
  // Solo agregamos onClick si existe onNavigate
  const clickProps = onNavigate ? { onClick: handle } as const : {};

  return (
    <nav className="space-y-2">
      <Link href="/dashboard/home" className={itemClass} {...clickProps}>
        <span className="mr-3">📋</span> <span className="text-sm">Resumen</span>
      </Link>
      <Link href="/dashboard/inventory" className={itemClass} {...clickProps}>
        <span className="mr-3">📦</span> <span className="text-sm">Inventario</span>
      </Link>
      <Link href="/dashboard/sales" className={itemClass} {...clickProps}>
        <span className="mr-3">⭐</span> <span className="text-sm">Ventas</span>
      </Link>
      <Link href="/dashboard/feedback" className={itemClass} {...clickProps}>
        <span className="mr-3">💬</span> <span className="text-sm">Cotizaciones</span>
      </Link>
      <Link href="/dashboard/notifications" className={itemClass} {...clickProps}>
        <span className="mr-3">🔔</span> <span className="text-sm">Notificaciones</span>
      </Link>
      <Link href="/dashboard/stats" className={itemClass} {...clickProps}>
        <span className="mr-3">📊</span> <span className="text-sm">Estadísticas</span>
      </Link>
      <Link href="/dashboard/support" className={itemClass} {...clickProps}>
        <span className="mr-3">🛠️</span> <span className="text-sm">Soporte</span>
      </Link>
      <Link href="/dashboard/profile" className={itemClass} {...clickProps}>
        <span className="mr-3">👤</span> <span className="text-sm">Mi Perfil</span>
      </Link>
    </nav>
  );
}
