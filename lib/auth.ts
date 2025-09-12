// lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter"; // (seguí con esta, v4)
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Session, User, Account, Profile } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // ── 1) Login con email+password (tu flujo actual)
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.cliente.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.password) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id_cliente,
          nombre: user.nombre,
          email: user.email,
          ruc: user.ruc ?? null,
          telefono: user.telefono ?? null,
        } as any;
      },
    }),

    // ── 2) Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // authorization: { params: { hd: "tudominio.com" } } // opcional: limitar dominio
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
     * Cuando un user se loguea (por credenciales o por Google),
     * nos aseguramos de que exista un Cliente y llenamos el JWT con campos de Cliente.
     */
    async signIn({ user, account, profile }) {
      // Si viene por Google, sincronizamos Cliente por email
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        // ¿Existe Cliente con ese email?
        let cliente = await prisma.cliente.findUnique({ where: { email } });

        if (!cliente) {
          // Crear Cliente “mínimo viable”
          cliente = await prisma.cliente.create({
            data: {
              // gracias al default(cuid()) y default(now()) esto es simple
              nombre: user.name ?? "Usuario Google",
              email,
              // ruc: null,                   // si lo dejaste opcional
              // password: null,              // usuarios Google no tienen password
            },
          });
        } else {
          // Pequeña actualización “cosmética” si llega info nueva
          const nuevoNombre = user.name && user.name !== cliente.nombre ? user.name : undefined;
          if (nuevoNombre) {
            await prisma.cliente.update({
              where: { email },
              data: { nombre: nuevoNombre },
            });
          }
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      // Si es login por credenciales, 'user' trae tus campos ya listos
      if (user) {
        token.id = (user as any).id ?? token.id;
        token.nombre = (user as any).nombre ?? token.nombre;
        token.ruc = (user as any).ruc ?? token.ruc;
        token.telefono = (user as any).telefono ?? token.telefono;
      }

      // En cualquier request (credenciales o Google), hidratamos el token desde Cliente por email
      if (token?.email) {
        const cliente = await prisma.cliente.findUnique({ where: { email: token.email as string } });
        if (cliente) {
          token.id = cliente.id_cliente;
          token.nombre = cliente.nombre;
          token.ruc = cliente.ruc ?? null;
          token.telefono = cliente.telefono ?? null;
        }
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).nombre = token.nombre as string;
        (session.user as any).ruc = (token.ruc as string) ?? null;
        (session.user as any).telefono = (token.telefono as string) ?? null;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
