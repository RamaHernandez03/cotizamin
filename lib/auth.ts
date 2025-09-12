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

        const user = await prisma.cliente.findUnique({ where: { email: credentials.email } });
        if (!user || !user.password) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id_cliente,
          nombre: user.nombre,
          email: user.email,
          ruc: user.ruc ?? null,
          telefono: user.telefono ?? null,
          ruc_locked: user.ruc_locked,
        } as any;
      },
    }),

    // 2) Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Para resolver OAuthAccountNotLinked cuando ya existe el email:
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
        const email = user.email;
        if (!email) return false;

        const cliente = await prisma.cliente.findUnique({ where: { email } });
        if (!cliente) {
          await prisma.cliente.create({
            data: {
              nombre: user.name ?? "Usuario Google",
              email,
              ruc: null,
              ruc_locked: false,
            },
          });
        } else if (user.name && user.name !== cliente.nombre) {
          await prisma.cliente.update({ where: { email }, data: { nombre: user.name } });
        }
      }
      return true;
    },

    /**
     * JWT: hidratar SIEMPRE desde Cliente (login, trigger=update, o si ya hay email en token).
     * Esto evita falsos positivos en el middleware.
     */
    async jwt({ token, user, trigger }) {
      // asegura que tengamos email en el token
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
            },
          });
          if (cliente) {
            token.id = cliente.id_cliente;
            token.nombre = cliente.nombre;
            token.ruc = cliente.ruc ?? null;
            token.telefono = cliente.telefono ?? null;
            token.ruc_locked = cliente.ruc_locked;
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
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
