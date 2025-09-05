// app/dashboard/feedback/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
import History from "../../../public/images/history.jpeg";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  fecha: string;
  proyecto: string;
  accion: string;
  resultado: string;
  comentario?: string;
  sugerencia?: string;
};

type FeedbackMetrics = {
  totalParticipaciones: number;
  pctRespuestaATiempo: number;
  pctAceptacion: number;
  promedioCalificacion: number;
  tiempoPromedioEntregaDias: number;
  ultimaParticipacion?: string;
  pendientesEvaluacion: number;
};

export default async function HistorialPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const proveedorId =
    (session.user as any)?.id ??
    (session.user as any)?.id_cliente ??
    (session.user as any)?.userId ??
    (session.user as any)?.user_id ??
    (session.user as any)?.cliente_id ??
    (session.user as any)?.proveedor_id ??
    session.user.id;

  // Obtener datos reales o usar mock
  let rows: FeedbackRow[] = [];
  try {
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
        sugerencia: true,
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
    // Mock data
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
        sugerencia: "Ajustar precio del ítem 'Filtro 450mm' un 6–8% (benchmark n8n).",
      },
    ];
  }

  // Calcular métricas
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

  const enEvaluacion = rows.filter(
    (r) => r.resultado?.toLowerCase().includes("evalua")
  ).length;

  const metrics: FeedbackMetrics = {
    totalParticipaciones: total,
    pctRespuestaATiempo: total ? Math.round((onTime / total) * 100) : 0,
    pctAceptacion: rows.length ? Math.round((aceptadas / rows.length) * 100) : 0,
    promedioCalificacion: 4.3,
    tiempoPromedioEntregaDias: 5,
    ultimaParticipacion: rows.length > 0 ? rows[0].fecha : undefined,
    pendientesEvaluacion: enEvaluacion,
  };

  const suggestions = rows.filter((r) => r.sugerencia && r.sugerencia.trim().length > 0);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">
            HISTORIAL DE COTIZACIONES
          </h1>
        </div>

        {/* Tarjeta de actividad reciente */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00152F] to-[#001a3d] shadow-xl">
            {/* Patrón de fondo */}
            <div className="absolute inset-0 bg-[url('/mining-pattern.png')] opacity-10"></div>
            
            {/* Contenido */}
            <div className="relative flex flex-col lg:flex-row items-center p-8 lg:p-10">
              {/* Información principal */}
              <div className="flex-1 text-white space-y-4 lg:pr-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-yellow-300">
                    ACTIVIDAD RECIENTE:
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-lg">
                  <div>
                    <div className="font-semibold mb-1">Última Participación:</div>
                    <div className="text-blue-100">
                      {metrics.ultimaParticipacion 
                        ? format(new Date(metrics.ultimaParticipacion), "dd MMMM yyyy", { locale: es })
                        : "Sin participaciones"
                      }
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-semibold mb-1">Total Participaciones:</div>
                    <div className="text-blue-100">
                      {metrics.totalParticipaciones} Cotizaciones
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Ofertas Aceptadas:</div>
                    <div className="text-blue-100">
                      {aceptadas} Aceptadas ({metrics.pctAceptacion}%)
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Pendientes / En Evaluación:</div>
                    <div className="text-blue-100">
                      {metrics.pendientesEvaluacion} En Evaluación
                    </div>
                  </div>
                </div>
              </div>

              {/* Imagen del camión minero */}
{/* Imagen del camión minero */}
<div className="lg:flex-shrink-0 mt-8 lg:mt-0">
  <div className="w-72 h-48 lg:w-80 lg:h-52 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl relative">
    {/* Imagen */}
    <Image
      src={History}
      alt="Estadísticas"
      fill
      priority
      className="object-cover"
    />

  </div>
</div>

            </div>
          </div>
        </div>

        {/* Tabla de historial */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
          <div className="px-8 py-6 bg-gradient-to-r from-yellow-400 to-yellow-500 border-b border-yellow-600/20">
            <h3 className="text-2xl font-bold text-slate-800">
              HISTORIAL DE COTIZACIONES
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Proyecto / Solicitud
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Rol / Acción
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Resultado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Comentario (opcional)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr 
                    key={row.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                    }`}
                  >
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-900">
                      {format(new Date(row.fecha), "dd/MM/yyyy", { locale: es })}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700 font-medium">
                      {row.proyecto}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {row.accion}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge resultado={row.resultado} />
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600 max-w-xs">
                      <div className="truncate">
                        {row.comentario || "-"}
                      </div>
                      {row.sugerencia && (
                        <div className="mt-1 text-xs text-blue-600 italic">
                          Sugerencia: {row.sugerencia}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center space-y-3">
                        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-lg font-medium">
                          Aún no hay participaciones registradas para tu cuenta
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-200/50 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-slate-800 mb-4">
                  Sugerencias recientes (desde n8n):
                </h4>
                <div className="space-y-3">
                  {suggestions.slice(0, 5).map((s) => (
                    <div key={`s-${s.id}`} className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                      <div className="text-slate-700 font-medium">
                        {s.sugerencia}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        {format(new Date(s.fecha), "dd MMMM yyyy", { locale: es })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para los badges de estado
function StatusBadge({ resultado }: { resultado: string }) {
  const r = (resultado || "").toLowerCase();
  
  if (r.includes("acept")) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        {resultado}
      </span>
    );
  }
  
  if (r.includes("no seleccion")) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
        {resultado}
      </span>
    );
  }
  
  if (r.includes("evalu")) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {resultado}
      </span>
    );
  }
  
  if (r.includes("rechaz")) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
        {resultado}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      {resultado}
    </span>
  );
}