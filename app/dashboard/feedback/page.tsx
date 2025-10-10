// app/dashboard/feedback/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
import History from "../../../public/images/history.jpeg";
import Link from "next/link";

export const dynamic = "force-dynamic";

const AZUL = "#00152F";
const AMARILLO = "#FFBD00";
const PAGE_SIZE_DEFAULT = 10;
const MAX_BTNS = 5;

/* ==================== Helpers visuales ==================== */

/** Devuelve solo el párrafo final del comentario.
 *  - Si encuentra "Producto:", muestra desde su última aparición hasta el final.
 *  - Si no, toma el último bloque separado por saltos dobles.
 */
function commentBottomOnly(text?: string) {
  const raw = (text ?? "").trim();
  if (!raw) return raw;

  const lower = raw.toLowerCase();
  const lastProducto = lower.lastIndexOf("producto:");
  if (lastProducto >= 0) {
    return raw.slice(lastProducto).trim();
  }

  const parts = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : raw;
}

function extractDescAndCode(comentario?: string, fallbackProyecto?: string) {
  const c = commentBottomOnly(comentario) || "";
  const mDesc = c.match(/Producto:\s*([^•\n]+?)(?:•|$)/i);
  const mCode = c.match(/Código:\s*([A-Za-z0-9._-]+)/i);
  const desc = mDesc ? mDesc[1].trim() : null;
  const code = mCode ? mCode[1].trim() : null;
  if (desc) return `${desc}${code ? ` - ${code}` : ""}`;
  return fallbackProyecto || "-";
}

function extractRankShortStrict(text?: string) {
  const t = (text || "").toLowerCase();

  // 1) "posición 2 de 10" / "puesto 3 sobre 12"
  let m =
    t.match(/posici(?:ó|o)n\s+(\d+)\s+(?:de|sobre)\s+(\d+)/i) ||
    t.match(/puesto\s+(\d+)\s+(?:de|sobre)\s+(\d+)/i);
  if (m) return `${m[1]}/${m[2]}`;

  // 2) "rank 2/10", "ranking: 2/10", "probable(rank1/1)"
  m = t.match(/rank(?:ing)?[:=]?\s*\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?/i);
  if (m) return `${m[1]}/${m[2]}`;

  // 3) Cualquier "2/10" suelto evitando fechas (01/10/2025)
  const all = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
  for (const mm of all) {
    const after = t.slice((mm.index ?? 0) + mm[0].length);
    const hasAnotherSlashSoon = /^\s*\/\s*\d{1,4}/.test(after);
    if (!hasAnotherSlashSoon) return `${mm[1]}/${mm[2]}`;
  }

  return null;
}

/** Badge neutral para "P/T" */
function rankBadgeClass() {
  return "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
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
  rank_pos?: number | null;
  rank_total?: number | null;
};

type EventRowDB = {
  id: string;
  fecha: Date;
  proyecto: string | null;
  accion: string | null;
  resultado: string | null;
  comentario: string | null;
  sugerencia: string | null;
  rank_pos: number | null;
  rank_total: number | null;
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

/** Construye URL con page/pageSize preservando otros query params */
function pageUrl(baseSearchParams: Record<string, string | undefined>, page: number, pageSize: number) {
  const sp = new URLSearchParams();
  Object.entries(baseSearchParams).forEach(([k, v]) => {
    if (v && k !== "page" && k !== "pageSize") sp.set(k, v);
  });
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  return `?${sp.toString()}`;
}

/** Genera ventana de numeración centrada en la página actual */
function numberedPages(current: number, totalPages: number) {
  let start = Math.max(1, current - Math.floor(MAX_BTNS / 2));
  let end = start + MAX_BTNS - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - MAX_BTNS + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function formatRankFromRow(row: FeedbackRow) {
  if (row.rank_pos != null && row.rank_total != null) return `${row.rank_pos}/${row.rank_total}`;
  return extractRankShortStrict(row.resultado) || extractRankShortStrict(row.comentario);
}

/* ==================== Badge resultado ==================== */
function StatusBadge({ resultado }: { resultado: string }) {
  const onlyRank = extractRankShortStrict(resultado);

  if (onlyRank) {
    return <span className={rankBadgeClass()}>{onlyRank}</span>;
  }

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

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // ✅ Next 15: await params
  const sp = await searchParams;

  // ✅ Definí proveedorId (string) a partir de la sesión
  const proveedorId = String(
    (session.user as any)?.id ??
      (session.user as any)?.id_cliente ??
      (session.user as any)?.userId ??
      (session.user as any)?.user_id ??
      (session.user as any)?.cliente_id ??
      (session.user as any)?.proveedor_id ??
      (session.user as any)?.id_cliente ??
      (session.user as any)?.id ??
      ""
  );

  // --- Parámetros de paginación ---
  const pageParamRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const pageSizeParamRaw = Array.isArray(sp.pageSize) ? sp.pageSize[0] : sp.pageSize;

  const PAGE_SIZE = Math.max(1, Math.min(100, Number(pageSizeParamRaw) || PAGE_SIZE_DEFAULT));
  const page = Math.max(1, Number(pageParamRaw) || 1);

  // --- Totales para paginación ---
  const totalItems = await prisma.cotizacionParticipacion.count({
    where: { proveedor_id: String(proveedorId) },
  });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Corrige page si viene fuera de rango
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

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
          // NUEVO:
          rank_pos: true,
          rank_total: true,
        },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.quoteMetricsDaily.findFirst({
        where: { proveedor_id: String(proveedorId) },
        orderBy: { fecha: "desc" },
      }),
    ]);

    const clean = (txt?: string | null) => (txt ?? "").replace(/simulada/gi, "").trim();

    rows = (events as EventRowDB[]).map((r) => ({
      id: String(r.id),
      fecha: new Date(r.fecha).toISOString(),
      proyecto: clean(r.proyecto) || "-",
      accion: clean(r.accion) || "-",
      resultado: clean(r.resultado) || "-",
      comentario: r.comentario ?? "",
      sugerencia: r.sugerencia ?? "",
      rank_pos: r.rank_pos ?? null,
      rank_total: r.rank_total ?? null,
    }));

    // Métricas
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
      const aceptadasEnPagina = rows.filter((r) => (r.resultado || "").toLowerCase().includes("acept")).length;
      const enEvaluacion = rows.filter((r) => (r.resultado || "").toLowerCase().includes("evalua")).length;

      metrics = {
        totalParticipaciones: totalItems,
        pctRespuestaATiempo: 0,
        pctAceptacion: totalItems ? Math.round((aceptadasEnPagina / totalItems) * 100) : 0,
        promedioCalificacion: 0,
        tiempoPromedioEntregaDias: 0,
        ultimaParticipacion: rows[0]?.fecha,
        pendientesEvaluacion: enEvaluacion,
      };
    }

    aceptadasCount = await prisma.cotizacionParticipacion.count({
      where: {
        proveedor_id: String(proveedorId),
        resultado: { contains: "acept", mode: "insensitive" },
      },
    });
  } catch {
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

  const suggestions = rows.filter((r) => (r.sugerencia ?? "").trim().length > 0);

  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, totalItems);
  const nums = numberedPages(safePage, totalPages);

  const baseParams: Record<string, string | undefined> = {
    page: String(page),
    pageSize: String(PAGE_SIZE),
  };

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
          <div className="border-b border-yellow-600/20 bg-gradient-to-r from-yellow-400 to-yellow-500 px-8 py-6 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-800">HISTORIAL DE COTIZACIONES</h3>
            <div className="text-xs text-slate-700">
              Mostrando <span className="font-semibold">{startIdx}</span>–<span className="font-semibold">{endIdx}</span> de{" "}
              <span className="font-semibold">{totalItems}</span>
            </div>
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
                    Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const comentarioLimpio = commentBottomOnly(row.comentario);

                  return (
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

                      {/* Resultado (prioriza rank numérico) */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        {(() => {
                          const rankDisplay = formatRankFromRow(row);
                          if (rankDisplay) {
                            return <span className={rankBadgeClass()}>{rankDisplay}</span>;
                          }
                          return <StatusBadge resultado={row.resultado} />;
                        })()}
                      </td>

                      {/* Comentario con scroll interno (solo el párrafo final) */}
                      <td className="px-6 py-5 text-sm text-slate-700">
                        {comentarioLimpio ? (
                          <div
                            className={[
                              "rounded-lg border border-slate-200/70 bg-white/70 p-3 text-[13px] leading-relaxed",
                              "whitespace-pre-wrap break-words",
                              "overflow-y-auto pr-2",
                              "max-h-40 md:max-h-56",
                            ].join(" ")}
                          >
                            {comentarioLimpio}
                          </div>
                        ) : (
                          <div className="text-slate-400">-</div>
                        )}
                      </td>
                    </tr>
                  );
                })}

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

          {/* Paginador estilo Ventas (server-side con links) */}
          {totalItems > 0 && (
            <div className="px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 items-center justify-between bg-gray-50 border-t">
              <span className="text-sm text-gray-600">
                Página <strong>{safePage}</strong> de <strong>{totalPages}</strong> ·&nbsp;Mostrando{" "}
                <strong>{rows.length}</strong> de <strong>{totalItems}</strong>
              </span>

              <div className="flex items-center gap-1">
                <Link
                  href={pageUrl(baseParams, 1, PAGE_SIZE)}
                  aria-disabled={safePage === 1}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 transition ${
                    safePage === 1 ? "pointer-events-none opacity-50" : "hover:bg-white"
                  }`}
                  style={{ color: AZUL }}
                >
                  <span className="hidden sm:inline">Primera</span>
                </Link>

                <Link
                  href={pageUrl(baseParams, Math.max(1, safePage - 1), PAGE_SIZE)}
                  aria-disabled={safePage === 1}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 transition ${
                    safePage === 1 ? "pointer-events-none opacity-50" : "hover:bg-white"
                  }`}
                  style={{ color: AZUL }}
                >
                  <span className="hidden sm:inline">Anterior</span>
                </Link>

                {nums.map((n) => (
                  <Link
                    key={n}
                    href={pageUrl(baseParams, n, PAGE_SIZE)}
                    aria-current={n === safePage ? "page" : undefined}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                      n === safePage ? "shadow-sm" : "hover:bg-white"
                    }`}
                    style={
                      n === safePage
                        ? { backgroundColor: AMARILLO, color: AZUL, borderColor: "transparent" }
                        : { color: AZUL, borderColor: "#e5e7eb" }
                    }
                  >
                    {n}
                  </Link>
                ))}

                <Link
                  href={pageUrl(baseParams, Math.min(totalPages, safePage + 1), PAGE_SIZE)}
                  aria-disabled={safePage === totalPages}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 transition ${
                    safePage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-white"
                  }`}
                  style={{ color: AZUL }}
                >
                  <span className="hidden sm:inline">Siguiente</span>
                </Link>

                <Link
                  href={pageUrl(baseParams, totalPages, PAGE_SIZE)}
                  aria-disabled={safePage === totalPages}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 transition ${
                    safePage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-white"
                  }`}
                  style={{ color: AZUL }}
                >
                  <span className="hidden sm:inline">Última</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div className="mt-8 rounded-3xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547z" />
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
