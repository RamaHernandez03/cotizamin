import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import StatWidget from "@/components/StatWidget";

function formatDateArg(date?: Date | null) {
  if (!date) return "—";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Regla simple:
 * - "COMPLETO" si hubo actualización en los últimos 7 días
 * - "PENDIENTE" si no hay actualizaciones o si la última es > 7 días
 * (Cambialo fácil en DAYS_THRESHOLD si querés otra política)
 */
const DAYS_THRESHOLD = 7;

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Si por alguna razón no hay sesión, mostramos vacío suave
    return (
      <main className="p-4 text-blue-900">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p>Iniciá sesión para ver tu resumen.</p>
      </main>
    );
  }

  // ID del proveedor (tu modelo usa id_cliente)
  const proveedorId = session.user.id as string;

  // 1) Cantidad de productos del proveedor
  const productosListados = await prisma.producto.count({
    where: { proveedor_id: proveedorId },
  });

  // 2) Última fecha de actualización de stock
  const ultimoProducto = await prisma.producto.findFirst({
    where: { proveedor_id: proveedorId },
    orderBy: { fecha_actualizacion: "desc" },
    select: { fecha_actualizacion: true },
  });
  const ultimaFecha = ultimoProducto?.fecha_actualizacion ?? null;

  // 3) Estado Pendiente/Completo
  let estado: "ok" | "pending" = "pending";
  if (ultimaFecha) {
    const diffMs = Date.now() - new Date(ultimaFecha).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    estado = diffDays <= DAYS_THRESHOLD ? "ok" : "pending";
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          title="Productos listados"
          value={productosListados}
        />
        <StatWidget
          title="Stock actualizado"
          value={estado === "pending" ? "PENDIENTE" : "OK"}
          subtitle={formatDateArg(ultimaFecha)}
          status={estado}
        />
        <StatWidget
          title="Ofrece descuento por mayor"
          value="—"
          subtitle="(próximamente)"
        />
        <StatWidget
          title="Participación en cotizaciones"
          value="—"
          subtitle="(próximamente)"
        />
      </section>
    </main>
  );
}
