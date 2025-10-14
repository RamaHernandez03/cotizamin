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
    <main className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">Admin • Test Lab</h1>
      <p className="text-sm text-gray-600 mb-4">
        Panel simple para explorar clientes, productos y acciones básicas.
      </p>
      {/* Client component: fetch + tabla + acciones */}
      <AdminLabClient />
    </main>
  );
}
