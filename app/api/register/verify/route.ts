// app/api/register/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const token = req.nextUrl.searchParams.get("token");

  const redirectTo = (status: string) =>
    NextResponse.redirect(new URL(`/auth/verify?status=${status}`, req.url));

  if (!email || !token) return redirectTo("missing");

  const vt = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!vt || vt.identifier !== email) return redirectTo("invalid");
  if (vt.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return redirectTo("expired");
  }
  
  await prisma.cliente.update({
    where: { email },
    data: { email_verificado: new Date() },
  });

  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  return redirectTo("ok");
}
