"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const rucSchema = z.string().trim().min(6).max(20); // ajustá a tu regla real

export async function setRucOnce(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "No autenticado" };

  const clienteId = (session.user as any).id as string;
  const raw = String(formData.get("ruc") ?? "");
  const ruc = rucSchema.parse(raw);

  const cliente = await prisma.cliente.findUnique({ where: { id_cliente: clienteId } });
  if (!cliente) return { ok: false, error: "Cliente no encontrado" };
  if (cliente.ruc_locked) return { ok: false, error: "El RUC ya está bloqueado" };

  // Unicidad con mensaje claro
  const exists = await prisma.cliente.findFirst({ where: { ruc } });
  if (exists) return { ok: false, error: "Ese RUC ya está registrado" };

  await prisma.cliente.update({
    where: { id_cliente: clienteId },
    data: { ruc, ruc_locked: true },
  });

  return { ok: true };
}
