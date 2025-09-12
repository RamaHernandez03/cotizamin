"use client";
import { useSession } from "next-auth/react";
import NotificationsWatcher from "@/components/NotificationsWatcher";

export default function NotificationsRoot() {
  const { data } = useSession();
  const clienteId =
    (data?.user as any)?.id_cliente || (data?.user as any)?.id || (data?.user as any)?.userId;

  if (!clienteId) return null;

  // initialBatchId lo podés omitir globalmente; el watcher abrirá cuando refresque/cambie
  return <NotificationsWatcher clienteId={String(clienteId)} pollMs={60000} initialBatchId={null} />;
}
