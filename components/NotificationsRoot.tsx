// components/NotificationsRoot.tsx
"use client";
import { useSession } from "next-auth/react";
import NotificationWatcher from "@/components/NotificationWatcher";

export default function NotificationsRoot() {
  const { data } = useSession();
  const clienteId =
    (data?.user as any)?.id_cliente || (data?.user as any)?.id || (data?.user as any)?.userId;

  if (!clienteId) return null;

  // initialBatchId lo podés omitir globalmente; el watcher abrirá cuando refresque/cambie
  return <NotificationWatcher clienteId={String(clienteId)} pollMs={60000} initialBatchId={null} />;
}
