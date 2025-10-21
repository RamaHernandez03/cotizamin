// src/components/TopNavbar.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import TopNavbarClient from "./TopNavbarClient";

export default async function TopNavbar() {
  const session = await getServerSession(authOptions);

  const clienteId = (session?.user as any)?.id as string | undefined;

  // Nombre / RUC / Email desde la sesión
  const nombre = (session?.user as any)?.nombre ?? "";
  const ruc = (session?.user as any)?.ruc ?? "N/A";
  const email = (session?.user as any)?.email ?? "—";

  // Avatar desde sesión o, si no existe, desde DB
  let avatarUrl: string | null =
    (session?.user as any)?.avatarUrl ??
    (session?.user as any)?.avatar_url ??
    null;

  if (!avatarUrl && clienteId) {
    const c = await prisma.cliente.findUnique({
      where: { id_cliente: clienteId },
      select: { avatar_url: true },
    });
    avatarUrl = c?.avatar_url ?? null;
  }

  // Versión para romper caché (idealmente setearla al actualizar el avatar)
  const avatarVersion: string | number | undefined =
    (session?.user as any)?.avatarVersion ??
    (session?.user as any)?.updatedAt ??
    undefined;

  return (
    <TopNavbarClient
      nombre={nombre}
      ruc={ruc}
      email={email}
      avatarUrl={avatarUrl}
      avatarVersion={avatarVersion}
    />
  );
}
