// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      nombre: string;
      ruc: string;
      telefono: string | null; // 👈 permite null
    };
  }

  interface User {
    id: string;
    email: string;
    nombre: string;
    ruc: string;
    telefono: string | null; // 👈 permite null
  }

  interface JWT {
    id: string;
    email: string;
    nombre: string;
    ruc: string;
    telefono: string | null; // 👈 permite null
  }

}
