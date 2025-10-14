// app/admin/test-lab/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminLabClient from "./AdminLabClient";

export const runtime = "nodejs";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  // Allowlist por env (separado por coma)
  const raw = process.env.TEST_LAB_ALLOWED_EMAILS || "";
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allow.includes(session.user.email.toLowerCase())) {
    redirect("/"); // 403 simple
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Admin Panel • Test Lab
          </h1>
          <p className="text-sm text-gray-600">
            Panel de administración para explorar clientes, productos, analytics y métricas de negocio.
          </p>
        </div>
        
        {/* Client component: fetch + tabla + acciones */}
        <AdminLabClient />
      </div>
    </main>
  );
}