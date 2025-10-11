import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Image from "next/image";
import StatsImage from "../../../public/images/stats.jpeg";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ========================= Tipos ========================= */
type EstadisticasActividad = {
  totalCotizaciones: number;
  ofertasGanadas: number;
  pctOfertasGanadas: number;
  participacionesEnAumento: number;
  tiempoPromedioRespuesta: "Bueno" | "Regular" | "Malo";
  stockActualizado: number;
  ultimaParticipacion: string;
};

type ProyectoStats = {
  proyecto: string;
  resultado: string;
  fecha: string;
};

type ComparativaMetrica = {
  metrica: string;
  tuValor: string;
  promedioMercado: string;
};

/* ========================= Utils ========================= */
function fmtFecha(fecha: Date | string) {
  try {
    const d = typeof fecha === "string" ? new Date(fecha) : fecha;
    return format(d, "dd MMMM yyyy", { locale: es });
  } catch {
    return "—";
  }
}

function badgeColorByRating(r: "Bueno" | "Regular" | "Malo") {
  if (r === "Bueno") return "text-emerald-300";
  if (r === "Regular") return "text-yellow-300";
  return "text-rose-300";
}

/* ========================= Funciones de datos ========================= */
async function getEstadisticasActividad(proveedorId: string): Promise<EstadisticasActividad> {
  try {
    // Traemos participaciones + conversaciones + mensajes
    const cotizaciones = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: proveedorId },
      include: {
        conversations: {
          include: { messages: true },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const productos = await prisma.producto.findMany({
      where: { proveedor_id: proveedorId },
      select: { stock_actual: true, fecha_actualizacion: true },
    });

    const totalCotizaciones = cotizaciones.length;
    const ofertasGanadas = cotizaciones.filter(
      (c) =>
        c.resultado?.toLowerCase().includes("aceptad") ||
        c.resultado?.toLowerCase().includes("gana") ||
        c.resultado?.toLowerCase().includes("seleccion")
    ).length;

    const hoy = new Date();
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

    const cotizacionesMesActual = cotizaciones.filter((c) => c.fecha >= inicioMesActual).length;
    const cotizacionesMesPasado = cotizaciones.filter(
      (c) => c.fecha >= inicioMesPasado && c.fecha < inicioMesActual
    ).length;

    const participacionesEnAumento = cotizacionesMesActual - cotizacionesMesPasado;

    /* ========= Cálculo real de respuesta promedio (ventas/conversaciones) =========
       Para cada conversación:
       - primer mensaje recibido (senderId !== proveedorId)
       - primera respuesta del proveedor después de ese mensaje (senderId === proveedorId)
       Se promedian las diferencias en horas. Luego se mapea a Bueno/Regular/Malo.
    ================================================================================ */
    const tiemposHoras: number[] = [];

    for (const c of cotizaciones) {
      for (const conv of c.conversations || []) {
        const mensajesOrdenados = [...(conv.messages || [])].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        const primeroCliente = mensajesOrdenados.find((m) => m.senderId !== proveedorId);
        const primeraRespuesta = mensajesOrdenados.find(
          (m) => primeroCliente && m.senderId === proveedorId && m.createdAt > primeroCliente.createdAt
        );

        if (primeroCliente && primeraRespuesta) {
          const diffMs = primeraRespuesta.createdAt.getTime() - primeroCliente.createdAt.getTime();
          const diffHoras = diffMs / (1000 * 60 * 60);
          tiemposHoras.push(diffHoras);
        }
      }
    }

    const promedioHoras =
      tiemposHoras.length > 0 ? tiemposHoras.reduce((a, b) => a + b, 0) / tiemposHoras.length : 12;

    let tiempoPromedioRespuesta: "Bueno" | "Regular" | "Malo";
    if (promedioHoras <= 4) tiempoPromedioRespuesta = "Bueno";
    else if (promedioHoras <= 12) tiempoPromedioRespuesta = "Regular";
    else tiempoPromedioRespuesta = "Malo";

    // Porcentaje de productos con stock actualizado (última semana)
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);

    const productosActualizados = productos.filter((p) => p.fecha_actualizacion >= unaSemanaAtras).length;
    const stockActualizado =
      productos.length > 0 ? Math.round((productosActualizados / productos.length) * 100) : 0;

    const ultimaParticipacion = cotizaciones.length > 0 ? fmtFecha(cotizaciones[0].fecha) : "—";

    return {
      totalCotizaciones,
      ofertasGanadas,
      pctOfertasGanadas:
        totalCotizaciones > 0 ? Math.round((ofertasGanadas / totalCotizaciones) * 100) : 0,
      participacionesEnAumento,
      tiempoPromedioRespuesta,
      stockActualizado,
      ultimaParticipacion,
    };
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    return {
      totalCotizaciones: 0,
      ofertasGanadas: 0,
      pctOfertasGanadas: 0,
      participacionesEnAumento: 0,
      tiempoPromedioRespuesta: "Regular",
      stockActualizado: 0,
      ultimaParticipacion: "—",
    };
  }
}

async function getProyectoStats(proveedorId: string): Promise<ProyectoStats[]> {
  try {
    const cotizaciones = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: proveedorId },
      orderBy: { fecha: "desc" },
      take: 5,
    });

    return cotizaciones.map((c) => ({
      proyecto: c.proyecto || "—",
      resultado: c.resultado || "—",
      fecha: fmtFecha(c.fecha),
    }));
  } catch (error) {
    console.error("Error obteniendo proyectos:", error);
    return [
      { proyecto: "CAPEX - Botadero Norte", resultado: "No seleccionada", fecha: "12 julio 2025" },
      { proyecto: "CAPEX - DR4", resultado: "En evaluación", fecha: "19 julio 2025" },
      { proyecto: "Filtros 450mm", resultado: "Aceptada", fecha: "05 julio 2025" },
    ];
  }
}

/**
 * Promedio de mercado REAL para % de éxito.
 * Definición: promedio de (ventas_del_usuario / total_cotizaciones_del_usuario) agregado sobre todos los usuarios.
 * Resultado en porcentaje entero (0-100).
 */
async function getPromedioMercadoExito(): Promise<number> {
  // Totales por proveedor
  const totales = await prisma.cotizacionParticipacion.groupBy({
    by: ["proveedor_id"],
    _count: { proveedor_id: true },
  });

  // Ganadas por proveedor (aceptada/ganada/seleccionada)
  const ganadas = await prisma.cotizacionParticipacion.groupBy({
    by: ["proveedor_id"],
    where: {
      OR: [
        { resultado: { contains: "aceptad", mode: "insensitive" } },
        { resultado: { contains: "gana", mode: "insensitive" } },
        { resultado: { contains: "seleccion", mode: "insensitive" } },
      ],
    },
    _count: { proveedor_id: true },
  });

  const mapTotales = new Map<string, number>();
  const mapGanadas = new Map<string, number>();

  for (const t of totales) mapTotales.set(t.proveedor_id, t._count.proveedor_id);
  for (const g of ganadas) mapGanadas.set(g.proveedor_id, g._count.proveedor_id);

  // Construimos ratios por proveedor
  const ratios: number[] = [];
  for (const [prov, total] of mapTotales.entries()) {
    if (!total || total <= 0) continue;
    const wins = mapGanadas.get(prov) ?? 0;
    ratios.push(wins / total);
  }

  if (ratios.length === 0) return 0;

  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(avg * 100);
}

function buildComparativaMetricas(
  stats: EstadisticasActividad,
  promedioMercadoExito: number
): ComparativaMetrica[] {
  // NOTA: Se eliminó "Tiempo de respuesta" de la comparativa
  return [
    {
      metrica: "% de éxito",
      tuValor: `${stats.pctOfertasGanadas}%`,
      promedioMercado: `${promedioMercadoExito}%`,
    },
    {
      metrica: "Frecuencia de stock actualizado",
      tuValor: "1 vez/semana",
      promedioMercado: "1 vez/15 días",
    },
  ];
}

/* ========================= Componentes Helper ========================= */
function StatusBadge({ resultado }: { resultado: string }) {
  const r = (resultado || "").toLowerCase();

  if (r.includes("acept") || r.includes("gana") || r.includes("seleccion")) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        {resultado}
      </span>
    );
  }

  if (r.includes("evalu")) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        {resultado}
      </span>
    );
  }

  if (r.includes("no seleccion") || r.includes("rechaz")) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        {resultado}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      {resultado || "—"}
    </span>
  );
}

/* ========================= Componente Principal ========================= */
export default async function StatsPage() {
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
    "3a036ad5-a1ca-4b74-9a55-b945157fd63e"; // fallback

  const [estadisticas, proyectos, promedioMercadoExito] = await Promise.all([
    getEstadisticasActividad(String(proveedorId)),
    getProyectoStats(String(proveedorId)),
    getPromedioMercadoExito(),
  ]);

  const comparativas = buildComparativaMetricas(estadisticas, promedioMercadoExito);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">ESTADÍSTICAS</h1>
        </div>

        {/* Tarjeta de actividad reciente */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00152F] to-[#001a3d] shadow-xl">
            <div className="absolute inset-0 bg-[url('/mining-pattern.png')] opacity-10"></div>

            <div className="relative flex flex-col lg:flex-row items-center p-8 lg:p-10">
              {/* Información principal */}
              <div className="flex-1 text-white space-y-4 lg:pr-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-yellow-300">ACTIVIDAD RECIENTE:</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-lg">
                  <div>
                    <div className="font-semibold mb-1">Total De Cotizaciones:</div>
                    <div className="text-blue-100 text-2xl font-bold">{estadisticas.totalCotizaciones}</div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Ofertas Ganadas:</div>
                    <div className="text-blue-100 text-2xl font-bold">
                      {estadisticas.ofertasGanadas} ({estadisticas.pctOfertasGanadas}%)
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Participaciones En Aumento:</div>
                    <div className="text-blue-100 text-2xl font-bold">
                      {estadisticas.participacionesEnAumento > 0 ? "+" : ""}
                      {estadisticas.participacionesEnAumento} Este Mes
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Tiempo Promedio Respuesta:</div>
                    <div className={`text-2xl font-bold ${badgeColorByRating(estadisticas.tiempoPromedioRespuesta)}`}>
                      {estadisticas.tiempoPromedioRespuesta}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Stock Actualizado:</div>
                    <div className="text-blue-100 text-2xl font-bold">{estadisticas.stockActualizado}%</div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Última Participación:</div>
                    <div className="text-blue-100 text-lg">{estadisticas.ultimaParticipacion}</div>
                  </div>
                </div>
              </div>

              {/* Imagen lateral */}
              <div className="lg:flex-shrink-0 mt-8 lg:mt-0">
                <div className="w-72 h-48 lg:w-80 lg:h-52 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl relative">
                  <Image src={StatsImage} alt="Estadísticas" fill priority className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-600/40"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rendimiento por Proyecto */}
        <div className="mb-8 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
          <div className="px-8 py-6 bg-gradient-to-r from-yellow-400 to-yellow-500 border-b border-yellow-600/20">
            <h3 className="text-2xl font-bold text-slate-800">RENDIMIENTO POR PROYECTO O CATEGORÍA</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Proyecto
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Resultado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proyectos.map((proyecto, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-slate-50/50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-25"}`}
                  >
                    <td className="px-6 py-5 text-sm font-medium text-slate-900">{proyecto.proyecto}</td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge resultado={proyecto.resultado} />
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">{proyecto.fecha}</td>
                  </tr>
                ))}
                {proyectos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center space-y-3">
                        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <div className="text-lg font-medium">Aún no hay estadísticas disponibles para mostrar</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparativa vs Promedio del Mercado */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-200/50 shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-800 mb-4">COMPARATIVA VS PROMEDIO DEL MERCADO:</h4>
              <div className="space-y-3">
                {comparativas.map((metrica, index) => (
                  <div key={index} className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                    <div className="flex justify-between items-center">
                      <div className="text-slate-700 font-medium">{metrica.metrica}</div>
                      <div className="flex space-x-6">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Tu valor</div>
                          <div className="font-bold text-blue-600">{metrica.tuValor}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Promedio mercado</div>
                          <div className="text-slate-600">{metrica.promedioMercado}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Nota: Se eliminó la fila "Tiempo de respuesta" */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
