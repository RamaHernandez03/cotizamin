// app/dashboard/stats/page.tsx
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
  tiempoPromedioRespuesta: number;
  stockActualizado: number;
  ultimaParticipacion: string;
};

type ProyectoStats = {
  proyecto: string;
  resultado: string;
  fecha: string;
  tiempoRespuesta: string;
  posicionRanking: string;
};

type ComparativaMetrica = {
  metrica: string;
  tuValor: string;
  promedioMercado: string;
};

/* ========================= Utils ========================= */
function fmtFecha(fecha: Date | string) {
  try {
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return format(d, "dd MMMM yyyy", { locale: es });
  } catch {
    return "—";
  }
}

function calcularTiempoRespuesta(fecha: Date): number {
  // Simulamos el tiempo de respuesta basado en patrones
  const horaCreacion = fecha.getHours();
  if (horaCreacion < 12) return Math.floor(Math.random() * 8) + 6; // 6-14h mañana
  return Math.floor(Math.random() * 6) + 10; // 10-16h tarde
}

/* ========================= Funciones de datos ========================= */
async function getEstadisticasActividad(proveedorId: string): Promise<EstadisticasActividad> {
  try {
    // Obtener datos de cotizaciones
    const cotizaciones = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: proveedorId },
      orderBy: { fecha: 'desc' }
    });

    // Obtener productos para calcular stock actualizado
    const productos = await prisma.producto.findMany({
      where: { proveedor_id: proveedorId },
      select: { stock_actual: true, fecha_actualizacion: true }
    });

    const totalCotizaciones = cotizaciones.length;
    const ofertasGanadas = cotizaciones.filter(c => 
      c.resultado?.toLowerCase().includes('aceptad') || 
      c.resultado?.toLowerCase().includes('gana') ||
      c.resultado?.toLowerCase().includes('seleccion')
    ).length;

    // Calcular participaciones del mes pasado vs este mes
    const hoy = new Date();
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    
    const cotizacionesMesActual = cotizaciones.filter(c => c.fecha >= inicioMesActual).length;
    const cotizacionesMesPasado = cotizaciones.filter(c => 
      c.fecha >= inicioMesPasado && c.fecha < inicioMesActual
    ).length;
    
    const participacionesEnAumento = cotizacionesMesActual - cotizacionesMesPasado;

    // Tiempo promedio de respuesta simulado
    const tiempoPromedio = cotizaciones.length > 0 
      ? Math.round(cotizaciones.reduce((acc, c) => acc + calcularTiempoRespuesta(c.fecha), 0) / cotizaciones.length)
      : 12;

    // Porcentaje de productos con stock actualizado (última semana)
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
    
    const productosActualizados = productos.filter(p => p.fecha_actualizacion >= unaSemanaAtras).length;
    const stockActualizado = productos.length > 0 
      ? Math.round((productosActualizados / productos.length) * 100)
      : 0;

    const ultimaParticipacion = cotizaciones.length > 0 
      ? fmtFecha(cotizaciones[0].fecha)
      : "—";

    return {
      totalCotizaciones,
      ofertasGanadas,
      pctOfertasGanadas: totalCotizaciones > 0 ? Math.round((ofertasGanadas / totalCotizaciones) * 100) : 0,
      participacionesEnAumento,
      tiempoPromedioRespuesta: tiempoPromedio,
      stockActualizado,
      ultimaParticipacion
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    // Datos mock para desarrollo
    return {
      totalCotizaciones: 18,
      ofertasGanadas: 4,
      pctOfertasGanadas: 22,
      participacionesEnAumento: 3,
      tiempoPromedioRespuesta: 12,
      stockActualizado: 94,
      ultimaParticipacion: "18 Jul 2025"
    };
  }
}

async function getProyectoStats(proveedorId: string): Promise<ProyectoStats[]> {
  try {
    const cotizaciones = await prisma.cotizacionParticipacion.findMany({
      where: { proveedor_id: proveedorId },
      orderBy: { fecha: 'desc' },
      take: 5
    });

    return cotizaciones.map((c, index) => ({
      proyecto: c.proyecto || "—",
      resultado: c.resultado || "—",
      fecha: fmtFecha(c.fecha),
      tiempoRespuesta: `${calcularTiempoRespuesta(c.fecha)} h`,
      posicionRanking: c.resultado?.toLowerCase().includes('aceptad') ? "1°" : 
                      c.resultado?.toLowerCase().includes('evaluacion') ? "—" : 
                      `${Math.floor(Math.random() * 3) + 2}°`
    }));
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    // Mock data
    return [
      {
        proyecto: "CAPEX - Botadero Norte",
        resultado: "No seleccionada",
        fecha: "12 julio 2025",
        tiempoRespuesta: "16 h",
        posicionRanking: "3°"
      },
      {
        proyecto: "CAPEX - DR4",
        resultado: "En evaluación",
        fecha: "19 julio 2025",
        tiempoRespuesta: "10 h",
        posicionRanking: "—"
      },
      {
        proyecto: "Filtros 450mm",
        resultado: "Aceptada",
        fecha: "05 julio 2025",
        tiempoRespuesta: "9 h",
        posicionRanking: "1°"
      }
    ];
  }
}

function getComparativaMetricas(stats: EstadisticasActividad): ComparativaMetrica[] {
  return [
    {
      metrica: "Tiempo de respuesta",
      tuValor: `${stats.tiempoPromedioRespuesta} h`,
      promedioMercado: "18 h"
    },
    {
      metrica: "% de éxito",
      tuValor: `${stats.pctOfertasGanadas}%`,
      promedioMercado: "12%"
    },
    {
      metrica: "Frecuencia de stock actualizado",
      tuValor: "1 vez/semana",
      promedioMercado: "1 vez/15 días"
    }
  ];
}

/* ========================= Componentes Helper ========================= */
function StatusBadge({ resultado }: { resultado: string }) {
  const r = (resultado || "").toLowerCase();
  
  if (r.includes("acept") || r.includes("gana")) {
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
  
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      {resultado}
    </span>
  );
}

function RankingBadge({ posicion }: { posicion: string }) {
  if (posicion === '1°') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gold-100 text-gold-800 border border-gold-200">
        🥇 {posicion}
      </span>
    );
  }
  
  if (posicion === '—') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        {posicion}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
      {posicion}
    </span>
  );
}

/* ========================= Componente Principal ========================= */
export default async function StatsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Obtener ID del proveedor
  const proveedorId =
    (session.user as any)?.id ??
    (session.user as any)?.id_cliente ??
    (session.user as any)?.userId ??
    (session.user as any)?.user_id ??
    (session.user as any)?.cliente_id ??
    (session.user as any)?.proveedor_id ??
    session.user.id ??
    "3a036ad5-a1ca-4b74-9a55-b945157fd63e"; // fallback

  // Obtener datos
  const estadisticas = await getEstadisticasActividad(String(proveedorId));
  const proyectos = await getProyectoStats(String(proveedorId));
  const comparativas = getComparativaMetricas(estadisticas);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">
            ESTADÍSTICAS
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-yellow-300">
                    ACTIVIDAD RECIENTE:
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-lg">
                  <div>
                    <div className="font-semibold mb-1">Total De Cotizaciones:</div>
                    <div className="text-blue-100 text-2xl font-bold">
                      {estadisticas.totalCotizaciones}
                    </div>
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
                      {estadisticas.participacionesEnAumento > 0 ? '+' : ''}{estadisticas.participacionesEnAumento} Este Mes
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Tiempo Promedio Respuesta:</div>
                    <div className="text-blue-100 text-2xl font-bold">
                      {estadisticas.tiempoPromedioRespuesta}H
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Stock Actualizado:</div>
                    <div className="text-blue-100 text-2xl font-bold">
                      {estadisticas.stockActualizado}%
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Última Participación:</div>
                    <div className="text-blue-100 text-lg">
                      {estadisticas.ultimaParticipacion}
                    </div>
                  </div>
                </div>
              </div>

              {/* Imagen lateral */}
              <div className="lg:flex-shrink-0 mt-8 lg:mt-0">
                <div className="w-72 h-48 lg:w-80 lg:h-52 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl relative">
                  <Image
                    src={StatsImage}
                    alt="Estadísticas"
                    fill
                    priority
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-600/40"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rendimiento por Proyecto */}
        <div className="mb-8 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
          <div className="px-8 py-6 bg-gradient-to-r from-yellow-400 to-yellow-500 border-b border-yellow-600/20">
            <h3 className="text-2xl font-bold text-slate-800">
              RENDIMIENTO POR PROYECTO O CATEGORÍA
            </h3>
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
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Tiempo de respuesta
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Posición en ranking
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proyectos.map((proyecto, index) => (
                  <tr 
                    key={index} 
                    className={`hover:bg-slate-50/50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                    }`}
                  >
                    <td className="px-6 py-5 text-sm font-medium text-slate-900">
                      {proyecto.proyecto}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge resultado={proyecto.resultado} />
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">
                      {proyecto.fecha}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600 font-medium">
                      {proyecto.tiempoRespuesta}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <RankingBadge posicion={proyecto.posicionRanking} />
                    </td>
                  </tr>
                ))}
                {proyectos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center space-y-3">
                        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div className="text-lg font-medium">
                          Aún no hay estadísticas disponibles para mostrar
                        </div>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-800 mb-4">
                COMPARATIVA VS PROMEDIO DEL MERCADO:
              </h4>
              <div className="space-y-3">
                {comparativas.map((metrica, index) => (
                  <div key={index} className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                    <div className="flex justify-between items-center">
                      <div className="text-slate-700 font-medium">
                        {metrica.metrica}
                      </div>
                      <div className="flex space-x-6">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Tu valor</div>
                          <div className="font-bold text-blue-600">
                            {metrica.tuValor}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Promedio mercado</div>
                          <div className="text-slate-600">
                            {metrica.promedioMercado}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}