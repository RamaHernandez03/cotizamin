// lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Session, User } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
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

        if (!user) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id_cliente,
          nombre: user.nombre,
          email: user.email,
          ruc: user.ruc,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Duración de la sesión en segundos
    maxAge: 30 * 60, // 30 minutos (30 * 60 segundos)
    // maxAge: 60 * 60, // 1 hora
    // maxAge: 24 * 60 * 60, // 24 horas
    // maxAge: 7 * 24 * 60 * 60, // 7 días
    
    // Actualizar la sesión cada vez que se use (opcional)
    updateAge: 5 * 60, // Actualizar cada 5 minutos si la sesión está activa
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.nombre = user.nombre;
        token.ruc = user.ruc;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.nombre = token.nombre as string;
        session.user.ruc = token.ruc as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};