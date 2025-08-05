// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { compare } from "bcryptjs"

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        ruc: { label: "RUC", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials?.email || "" },
        })

        if (!user) return null

        const passwordMatch = await compare(credentials!.password, user.password!)
        if (!passwordMatch) return null

        return user
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
        if (session.user && token) {
          (session.user as { id: string }).id = token.id as string;
        }
        return session;
      }
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
