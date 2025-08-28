// app/dashboard/feedback/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import FeedbackClient, {
  FeedbackRow,
  FeedbackMetrics,
} from "./FeedbackClient";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // mismo patrón que ya usás para obtener el proveedorId
  const proveedorId =
    (session.user as any)?.id ??
    (session.user as any)?.id_cliente ??
    (session.user as any)?.userId ??
    (session.user as any)?.user_id ??
    (session.user as any)?.cliente_id ??
    (session.user as any)?.proveedor_id ??
    session.user.id;

  // ——————————————————————————————————————————————————————————————
  // 1) Traer participaciones/simulaciones del proveedor (si existen).
  //    Si aún no tenés tabla, caemos en MOCK para que el UI funcione.
  // ——————————————————————————————————————————————————————————————
  let rows: FeedbackRow[] = [];
  try {
    // 👇 adapta este query a tu tabla real
    const data = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: String(proveedorId) },
      orderBy: { fecha: "desc" },
      select: {
        id: true,
        fecha: true,
        proyecto: true,
        accion: true,
        resultado: true,
        comentario: true,
        sugerencia: true, // llega desde n8n
      },
      take: 100,
    });

    rows = data.map((r: any) => ({
      id: String(r.id),
      fecha: new Date(r.fecha).toISOString(),
      proyecto: r.proyecto ?? "-",
      accion: r.accion ?? "-",
      resultado: r.resultado ?? "-",
      comentario: r.comentario ?? "",
      sugerencia: r.sugerencia ?? "",
    }));
  } catch {
    // MOCK de arranque para diseño
    rows = [
      {
        id: "1",
        fecha: new Date("2025-07-21").toISOString(),
        proyecto: "Cotización CAPEX – DR3",
        accion: "Participó enviando cotización",
        resultado: "En evaluación",
        comentario: "Envío dentro del plazo",
        sugerencia: "Mejorar el detalle de plazos y garantías (n8n).",
      },
      {
        id: "2",
        fecha: new Date("2025-07-10").toISOString(),
        proyecto: "Solicitud Stock – Filtro 450mm",
        accion: "Actualizó stock",
        resultado: "Aceptado",
        comentario: "Se validaron cantidades",
        sugerencia: "Mantener stock de seguridad en 15 uds (n8n).",
      },
      {
        id: "3",
        fecha: new Date("2025-06-28").toISOString(),
        proyecto: "Cotización Botadero Norte",
        accion: "No participó",
        resultado: "-",
        comentario: "No envió oferta",
        sugerencia: "Automatizar recordatorio 48h antes del cierre (n8n).",
      },
      {
        id: "4",
        fecha: new Date("2025-06-15").toISOString(),
        proyecto: "Cotización CAPEX – Mina",
        accion: "Participó",
        resultado: "Cotización no seleccionada",
        comentario: "Superado por precio más bajo",
        sugerencia:
          "Ajustar precio del ítem 'Filtro 450mm' un 6–8% (benchmark n8n).",
      },
    ];
  }

  // ——————————————————————————————————————————————————————————————
  // 2) Métricas resumidas (luego podés reemplazar por agregados SQL)
  // ——————————————————————————————————————————————————————————————
  const participaciones = rows.filter(
    (r) =>
      r.accion?.toLowerCase().includes("particip") ||
      r.accion?.includes("cotización")
  );

  const total = participaciones.length;
  const onTime = participaciones.filter((r) =>
    (r.comentario || "").toLowerCase().includes("plazo")
  ).length;

  const aceptadas = rows.filter(
    (r) => r.resultado?.toLowerCase() === "aceptado"
  ).length;

  const metrics: FeedbackMetrics = {
    totalParticipaciones: total,
    pctRespuestaATiempo: total ? Math.round((onTime / total) * 100) : 0,
    pctAceptacion: rows.length
      ? Math.round((aceptadas / rows.length) * 100)
      : 0,
    promedioCalificacion: 4.3,
    tiempoPromedioEntregaDias: 5,
  };

  return <FeedbackClient rows={rows} metrics={metrics} />;
}
