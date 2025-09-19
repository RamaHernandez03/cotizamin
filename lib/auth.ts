// lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // 1) Email + password
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.cliente.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        // 🚫 BLOQUEAR si NO verificó el email
        if (!user.email_verificado) {
          // (opcional) disparamos reenvío automático del link
          try {
            const baseUrl =
              process.env.NEXTAUTH_URL ||
              process.env.NEXT_PUBLIC_APP_URL ||
              "http://localhost:3000";
            await fetch(`${baseUrl}/api/register/resend`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
              cache: "no-store",
            }).catch(() => {});
          } catch {}
          // Mostrar mensaje claro en /login
          throw new Error("Debes verificar tu correo. Te enviamos un enlace de verificación.");
        }

        return {
          id: user.id_cliente,
          nombre: user.nombre,
          email: user.email,
          ruc: user.ruc ?? null,
          telefono: user.telefono ?? null,
          ruc_locked: user.ruc_locked,
          email_verificado: user.email_verificado?.toISOString() ?? null,
        } as any;
      },
    }),

    // 2) Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Evita "OAuthAccountNotLinked" si ya existía el email
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    /**
     * Crear/actualizar Cliente cuando entra por Google.
     */
async signIn({ user, account }) {
  if (account?.provider === "google") {
    const email = user.email?.trim().toLowerCase();
    if (!email) return false;

    await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { email } });

      if (!cliente) {
        await tx.cliente.create({
          data: {
            nombre: user.name ?? "Usuario Google",
            email,
            ruc: null,
            ruc_locked: false,
            email_verificado: new Date(), // ✅ verificado por Google
          },
        });
      } else {
        const updates: Record<string, any> = {};
        if (user.name && user.name !== cliente.nombre) updates.nombre = user.name;
        if (!cliente.email_verificado) updates.email_verificado = new Date(); // ✅ marca verificado

        if (Object.keys(updates).length > 0) {
          await tx.cliente.update({ where: { email }, data: updates });
        }
      }

      // (Opcional) limpiar tokens de verificación antiguos
      await tx.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => {});
    });

    return true;
  }
  return true;
},

    /**
     * JWT: hidratar SIEMPRE desde Cliente (login, trigger=update, o si ya hay email en token).
     */
    async jwt({ token, user, trigger }) {
      if (user?.email) token.email = user.email as string;

      if (trigger === "update" || user || token.email) {
        const email = token.email as string | undefined;
        if (email) {
          const cliente = await prisma.cliente.findUnique({
            where: { email },
            select: {
              id_cliente: true,
              nombre: true,
              ruc: true,
              telefono: true,
              ruc_locked: true,
              email_verificado: true,
            },
          });
          if (cliente) {
            token.id = cliente.id_cliente;
            token.nombre = cliente.nombre;
            token.ruc = cliente.ruc ?? null;
            token.telefono = cliente.telefono ?? null;
            token.ruc_locked = cliente.ruc_locked;
            token.email_verificado = cliente.email_verificado
              ? cliente.email_verificado.toISOString()
              : null;
          }
        }
      }

      return token;
    },

    /**
     * Session: exponer campos de Cliente en session.user
     */
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).nombre = token.nombre as string;
        (session.user as any).ruc = (token.ruc as string) ?? null;
        (session.user as any).telefono = (token.telefono as string) ?? null;
        (session.user as any).ruc_locked = Boolean(token.ruc_locked);
        (session.user as any).email_verificado = (token.email_verificado as string | null) ?? null;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
