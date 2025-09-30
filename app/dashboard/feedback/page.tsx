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

/* ==================== Helpers visuales ==================== */
function extractDescAndCode(comentario?: string, fallbackProyecto?: string) {
  const c = comentario || "";
  const mDesc = c.match(/Producto:\s*([^•]+?)(?:•|$)/i);
  const mCode = c.match(/Código:\s*([A-Za-z0-9._-]+)/i);
  const desc = mDesc ? mDesc[1].trim() : null;
  const code = mCode ? mCode[1].trim() : null;
  if (desc) return `${desc}${code ? ` - ${code}` : ""}`;
  return fallbackProyecto || "-";
}

/** preview corto para el <summary> */
function summarize(text?: string, max = 140) {
  const t = (text || "").trim();
  if (t.length <= max) return t || "-";
  return t.slice(0, max - 1) + "…";
}
/* ========================================================== */

type FeedbackRow = {
  id: string;
  fecha: string;
  proyecto: string;
  accion: string;
  resultado: string;
  comentario?: string;
  sugerencia?: string;
};

type EventRowDB = {
  id: string;
  fecha: Date;
  proyecto: string | null;
  accion: string | null;
  resultado: string | null;
  comentario: string | null;
  sugerencia: string | null;
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
    (session.user as any)?.id_cliente ??
    session.user.id;

  let rows: FeedbackRow[] = [];
  let metrics: FeedbackMetrics;
  let aceptadasCount = 0;

  try {
    const [events, metricsRow] = await Promise.all([
      prisma.cotizacionParticipacion.findMany({
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
      }) as Promise<EventRowDB[]>,
      prisma.quoteMetricsDaily.findFirst({
        where: { proveedor_id: String(proveedorId) },
        orderBy: { fecha: "desc" },
      }),
    ]);

rows = events.map((r: EventRowDB) => {
  const clean = (txt?: string | null) =>
    (txt ?? "").replace(/simulada/ig, "").trim();

  return {
    id: String(r.id),
    fecha: new Date(r.fecha).toISOString(),
    proyecto: clean(r.proyecto) || "-",
    accion: clean(r.accion) || "-",
    resultado: clean(r.resultado) || "-",
    comentario: r.comentario ?? "",   // <- aquí NO tocamos: debe verse tal cual llega (comentario_ia)
    sugerencia: r.sugerencia ?? "",
  };
});

    aceptadasCount = rows.filter(
      (r) => (r.resultado || "").toLowerCase().includes("acept")
    ).length;

    if (metricsRow) {
      metrics = {
        totalParticipaciones: metricsRow.total_participaciones,
        pctRespuestaATiempo: metricsRow.pct_respuesta_tiempo,
        pctAceptacion: metricsRow.pct_aceptacion,
        promedioCalificacion: metricsRow.promedio_calificacion,
        tiempoPromedioEntregaDias: metricsRow.tiempo_prom_entrega_dias,
        ultimaParticipacion: rows[0]?.fecha,
        pendientesEvaluacion: metricsRow.pendientes_evaluacion,
      };
    } else {
      const participaciones = rows.filter(
        (r) =>
          (r.accion || "").toLowerCase().includes("particip") ||
          (r.accion || "").toLowerCase().includes("cotiz")
      );

      const total = participaciones.length;
      const onTime = participaciones.filter((r) =>
        (r.comentario || "").toLowerCase().includes("plazo")
      ).length;

      const enEvaluacion = rows.filter((r) =>
        (r.resultado || "").toLowerCase().includes("evalua")
      ).length;

      metrics = {
        totalParticipaciones: total,
        pctRespuestaATiempo: total ? Math.round((onTime / total) * 100) : 0,
        pctAceptacion: rows.length ? Math.round((aceptadasCount / rows.length) * 100) : 0,
        promedioCalificacion: 4.3,
        tiempoPromedioEntregaDias: 5,
        ultimaParticipacion: rows[0]?.fecha,
        pendientesEvaluacion: enEvaluacion,
      };
    }
  } catch (e) {
    rows = [];
    metrics = {
      totalParticipaciones: 0,
      pctRespuestaATiempo: 0,
      pctAceptacion: 0,
      promedioCalificacion: 0,
      tiempoPromedioEntregaDias: 0,
      ultimaParticipacion: undefined,
      pendientesEvaluacion: 0,
    };
  }

  const suggestions = rows.filter(
    (r) => (r.sugerencia ?? "").trim().length > 0
  );

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
            <div className="absolute inset-0 bg-[url('/mining-pattern.png')] opacity-10"></div>
            <div className="relative flex flex-col lg:flex-row items-center p-8 lg:p-10">
              <div className="flex-1 text-white space-y-4 lg:pr-8">
                <div className="mb-6 flex items-center space-x-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-yellow-300">
                    ACTIVIDAD RECIENTE:
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 text-lg sm:grid-cols-2">
                  <div>
                    <div className="mb-1 font-semibold">Última Participación:</div>
                    <div className="text-blue-100">
                      {metrics.ultimaParticipacion
                        ? format(new Date(metrics.ultimaParticipacion), "dd MMMM yyyy", { locale: es })
                        : "Sin participaciones"}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 font-semibold">Total Participaciones:</div>
                    <div className="text-blue-100">{metrics.totalParticipaciones} Cotizaciones</div>
                  </div>

                  <div>
                    <div className="mb-1 font-semibold">Ofertas Aceptadas:</div>
                    <div className="text-blue-100">
                      {aceptadasCount} Aceptadas ({metrics.pctAceptacion}%)
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 font-semibold">Pendientes / En Evaluación:</div>
                    <div className="text-blue-100">{metrics.pendientesEvaluacion} En Evaluación</div>
                  </div>
                </div>
              </div>

              {/* Imagen */}
              <div className="mt-8 lg:mt-0 lg:flex-shrink-0">
                <div className="relative h-48 w-72 overflow-hidden rounded-2xl bg-white/10 shadow-2xl backdrop-blur-sm lg:h-52 lg:w-80">
                  <Image src={History} alt="Estadísticas" fill priority className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de historial */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-white shadow-xl">
          <div className="border-b border-yellow-600/20 bg-gradient-to-r from-yellow-400 to-yellow-500 px-8 py-6">
            <h3 className="text-2xl font-bold text-slate-800">HISTORIAL DE COTIZACIONES</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700">
                    Proyecto / Solicitud
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700">
                    Rol / Acción
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700">
                    Resultado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700">
                    Comentario (opcional)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-slate-50/50 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-25"
                    }`}
                  >
                    {/* Fecha */}
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-900">
                      {format(new Date(row.fecha), "dd/MM/yyyy", { locale: es })}
                    </td>

                    {/* Proyecto / Solicitud = Descripción - Código */}
                    <td className="px-6 py-5 text-sm font-medium text-slate-700">
                      {extractDescAndCode(row.comentario, row.proyecto)}
                    </td>

                    {/* Acción */}
                    <td className="px-6 py-5 text-sm text-slate-600">{row.accion}</td>

                    {/* Resultado */}
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge resultado={row.resultado} />
                    </td>

                    {/* Comentario expandible */}
{/* Comentario con scroll interno */}
<td className="px-6 py-5 text-sm text-slate-700">
  {row.comentario ? (
    <div
      className={[
        "rounded-lg border border-slate-200/70 bg-white/70 p-3 text-[13px] leading-relaxed",
        "whitespace-pre-wrap break-words",
        "overflow-y-auto pr-2",
        "max-h-40 md:max-h-56",
      ].join(" ")}
    >
      {row.comentario}
    </div>
  ) : (
    <div className="text-slate-400">-</div>
  )}
</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center space-y-3">
                        <svg className="h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-lg font-medium">Aún no hay participaciones registradas para tu cuenta</div>
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
          <div className="mt-8 rounded-3xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="mb-4 text-lg font-bold text-slate-800">Sugerencias recientes (desde n8n):</h4>
                <div className="space-y-3">
                  {suggestions.slice(0, 5).map((s) => (
                    <div key={`s-${s.id}`} className="rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur-sm">
                      <div className="font-medium text-slate-700">{s.sugerencia}</div>
                      <div className="mt-2 text-xs text-slate-500">
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

/* ==================== Badge resultado ==================== */
function StatusBadge({ resultado }: { resultado: string }) {
  const r = (resultado || "").toLowerCase();

  if (r.includes("acept")) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        {resultado}
      </span>
    );
  }

  if (r.includes("no seleccion")) {
    return (
      <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
        {resultado}
      </span>
    );
  }

  if (r.includes("evalu")) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
        {resultado}
      </span>
    );
  }

  if (r.includes("rechaz")) {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
        {resultado}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {resultado}
    </span>
  );
}
