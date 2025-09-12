import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import RefreshRecosButton from "@/components/RefreshRecosButton";
import prisma from "@/lib/prisma";
import NotificationsWatcher from "@/components/NotificationsWatcher";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
import NotificationsImage from "../../../public/images/Notifications.jpeg";

/* ========================= Tipos existentes ========================= */
type Prioridad = "alta" | "media" | "baja";
type Tipo = "precio" | "stock" | "perfil";

type Recomendacion = {
  tipo: Tipo;
  mensaje: string;
  producto: string | null;
  prioridad: Prioridad;
};

type RecoResponse = {
  ok: boolean;
  cliente_id: string | null;
  fecha_analisis: string | null;
  total_recomendaciones: number;
  recomendaciones: Recomendacion[];
  resumen?: { nota_general?: string };
};

/* ========================= Utils existentes ========================= */
function fmtFechaISO(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso ?? "—";
  }
}

function PriorityBadge({ p }: { p: Prioridad }) {
  const map: Record<Prioridad, string> = {
    alta: "bg-red-100 text-red-800 border-red-200",
    media: "bg-yellow-100 text-yellow-800 border-yellow-200",
    baja: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${map[p]}`}>
      {p.toUpperCase()}
    </span>
  );
}

function TipoIcon({ tipo }: { tipo: Tipo }) {
  const map: Record<Tipo, string> = {
    precio: "💲",
    stock: "📦",
    perfil: "👤",
  };
  return <span className="mr-2">{map[tipo] ?? "🔔"}</span>;
}

async function getBase() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  return `${proto}://${host}`;
}

async function fetchRecos(clienteId: string): Promise<RecoResponse> {
  const base = await getBase();
  const res = await fetch(`${base}/api/recommendations?cliente_id=${clienteId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      ok: false,
      cliente_id: clienteId,
      fecha_analisis: null,
      total_recomendaciones: 0,
      recomendaciones: [],
    };
  }
  return res.json();
}

/* ========================= NUEVO: Alertas de Demanda ========================= */
type AlertaDemanda = {
  id: string;
  fecha: Date;
  proyecto: string;   // "Alerta demanda: q=...|marca=...|modelo=...|material=..."
  comentario: string | null;
  sugerencia: string | null;
};

function parseFiltroFromProyecto(proyecto: string) {
  // Muestra solo la parte clave luego de "Alerta demanda: "
  const idx = proyecto.indexOf("Alerta demanda:");
  if (idx === -1) return proyecto;
  return proyecto.slice(idx + "Alerta demanda:".length).trim();
}

function fmtFecha(d: Date) {
  try {
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
}

async function fetchAlertasDemanda(proveedorId: string, days = 30): Promise<AlertaDemanda[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.cotizacionParticipacion.findMany({
    where: {
      proveedor_id: proveedorId,
      accion: "Demanda alta, oferta limitada",
      fecha: { gte: since },
    },
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      fecha: true,
      proyecto: true,
      comentario: true,
      sugerencia: true,
    },
    take: 200,
  });
  return rows;
}

/* ========================= Página ========================= */
export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // intenta varias propiedades habituales para el id del cliente
  const clienteId =
    (session.user as any)?.id_cliente ||
    (session.user as any)?.id ||
    (session.user as any)?.userId ||
    "3a036ad5-a1ca-4b74-9a55-b945157fd63e"; // fallback para pruebas

  // Recomendaciones (lo que ya tenías)
  const data = await fetchRecos(String(clienteId));
  const recos = data.recomendaciones ?? [];
  const countAlta = recos.filter((r) => r.prioridad === "alta").length;
  const countMedia = recos.filter((r) => r.prioridad === "media").length;
  const countBaja = recos.filter((r) => r.prioridad === "baja").length;
  const base = await getBase();
  const metaRes = await fetch(`${base}/api/recommendations/latest?cliente_id=${clienteId}`, { cache: "no-store" });
  const meta = metaRes.ok ? await metaRes.json() : { batchId: null };

  // NUEVO: Alertas de demanda (últimos 30 días)
  const alertas = await fetchAlertasDemanda(String(clienteId), 30);
  const lastAlerta = alertas[0]?.fecha ?? null;
  const totalAlertas = alertas.length;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <NotificationsWatcher
          clienteId={String(clienteId)}
          initialBatchId={meta.batchId}
          pollMs={10000} // 10s para testear
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">
            NOTIFICACIONES
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
<svg
  className="w-6 h-6 text-white"
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
>
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"
  />
</svg>
                  </div>
                  <h2 className="text-2xl font-bold text-yellow-300">
                    ACTIVIDAD RECIENTE:
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-lg">
                  <div>
                    <div className="font-semibold mb-1">Último Análisis:</div>
                    <div className="text-blue-100">
                      {data.fecha_analisis 
                        ? format(new Date(data.fecha_analisis), "dd MMMM yyyy", { locale: es })
                        : "Sin análisis recientes"
                      }
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-semibold mb-1">Total Recomendaciones:</div>
                    <div className="text-blue-100">
                      {data.total_recomendaciones ?? recos.length} Notificaciones
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Alertas de Demanda:</div>
                    <div className="text-blue-100">
                      {totalAlertas} Alertas (últimos 30 días)
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-1">Prioridades:</div>
                    <div className="flex gap-3 text-sm">
                      <span className="inline-flex text-blue-100 items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> 
                        Alta: {countAlta}
                      </span>
                      <span className="inline-flex text-blue-100 items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 
                        Media: {countMedia}
                      </span>
                      <span className="inline-flex text-blue-100 items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 
                        Baja: {countBaja}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nota general */}
                <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <div className="text-sm font-semibold mb-2">Resumen del Sistema:</div>
                  <div className="text-sm text-blue-100">
                    {data?.resumen?.nota_general ??
                      "La IA generará recomendaciones para optimizar tu competitividad y catálogo."}
                  </div>
                </div>
              </div>

              {/* Área de la imagen - placeholder por ahora */}
              <div className="lg:flex-shrink-0 mt-8 lg:mt-0">
                <div className="w-72 h-48 lg:w-80 lg:h-52 bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
                    <Image
                    src={NotificationsImage}
                    alt="Panel de Notificaciones"
                    fill
                    priority
                    className="object-cover"
                  />
                    <div className="text-sm">Panel de Notificaciones</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================= Alertas de Demanda ========================= */}
        <div className="mb-8 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
          <div className="px-8 py-6 bg-gradient-to-r from-yellow-400 to-yellow-500 border-b border-orange-600/20">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              ALERTAS DE DEMANDA (últimos 30 días)
            </h3>
          </div>

          <div className="p-8">
            {/* Resumen de métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200/50">
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Total de Alertas</div>
                <div className="text-3xl font-bold text-orange-600">{totalAlertas}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200/50">
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Última Alerta</div>
                <div className="text-lg font-semibold text-blue-600">
                  {lastAlerta ? format(lastAlerta, "dd MMM yyyy", { locale: es }) : "—"}
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-6 border border-yellow-200/50">
                <div className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Descripción</div>
                <div className="text-sm text-slate-600">
                  Se dispara cuando hay muchas búsquedas y pocos proveedores ofrecen el producto.
                </div>
              </div>
            </div>

            {/* Tabla de alertas */}
            {alertas.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" />
                </svg>
                <div className="text-xl font-medium text-slate-500 mb-2">
                  No hay alertas de demanda
                </div>
                <div className="text-slate-400">
                  Aún no se han registrado alertas en los últimos 30 días.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Filtro
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Detalle
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Sugerencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alertas.map((a, index) => (
                      <tr 
                        key={a.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                        }`}
                      >
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-900">
                          {format(a.fecha, "dd/MM/yyyy", { locale: es })}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                              DEMANDA
                            </span>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                              {parseFiltroFromProyecto(a.proyecto)}
                            </code>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600 max-w-xs">
                          <div className="truncate">
                            {a.comentario ?? "—"}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600 max-w-xs">
                          <div className="truncate">
                            {a.sugerencia ?? "—"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ========================= Historial de Recomendaciones ========================= */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
          <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-indigo-600 border-b border-blue-600/20">
            <h3 className="text-2xl font-bold text-white">
              NOTIFICACIONES
            </h3>
          </div>

          <div className="p-8">
            {recos.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5V3h5v14z" />
                </svg>
                <div className="text-xl font-medium text-slate-500 mb-2">
                  No hay recomendaciones disponibles
                </div>
                <div className="text-slate-400">
                  Aún no se han generado recomendaciones para tu cuenta.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Detalle
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Prioridad
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recos.map((r, index) => (
                      <tr 
                        key={index} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                        }`}
                      >
                        <td className="px-6 py-5 text-sm font-medium text-slate-900">
                          <div className="inline-flex items-center">
                            <TipoIcon tipo={r.tipo} />
                            <span className="capitalize">{r.tipo}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 max-w-md">
                          {r.mensaje}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600">
                          {r.producto ?? "—"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <PriorityBadge p={r.prioridad} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}