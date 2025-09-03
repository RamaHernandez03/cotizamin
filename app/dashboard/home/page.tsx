// app/dashboard/home/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import StatWidget from "@/components/StatWidget";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";

/* ===== Config RSC ===== */
export const runtime = "nodejs";
export const revalidate = 60;

/* ===== Utils ===== */
function formatDateArg(date?: Date | null) {
  if (!date) return "—";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
const DAYS_THRESHOLD = 7;
function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function daysBetween(date?: Date) { if (!date) return 30; const diffMs = Date.now() - new Date(date).getTime(); return Math.floor(diffMs / (1000*60*60*24)); }
function isTop3(resultado?: string | null) {
  if (!resultado) return false;
  const s = resultado.toLowerCase();
  return s.includes("top 3") || s.includes("top3") || /rank\s*:\s*[1-3]/.test(s);
}
function hasCert(certs?: string | null, clave?: string) {
  if (!certs || !clave) return false;
  return certs.toLowerCase().includes(clave.toLowerCase());
}
function buildRadar(values: Record<string, number>): number[] {
  return [
    values.velocidad ?? 50,
    values.calidad ?? 50,
    values.precios ?? 50,
    values.disponibilidad ?? 50,
    values.cumplimiento ?? 50,
    values.participacion ?? 50,
    values.reputacion ?? 50,
  ];
}

/* ===== Data Layer (cacheada) ===== */
type DashboardData = {
  productosListados: number;
  ultimoProductoFecha: Date | null;
  cliente: { certificaciones: string | null; nombre: string | null } | null;
  participacionesMes: number;
  participaciones90d: number;
  resultados90d: { resultado: string | null }[];
  feedbacks5: {
    id: string; fecha: Date; proyecto: string | null; accion: string | null;
    resultado: string | null; comentario: string | null; sugerencia: string | null;
  }[];
  recBatch: null | {
    fecha_analisis?: Date | null;
    createdAt?: Date | null;
    items: { id: string; tipo: string | null; mensaje: string | null; producto: string | null }[];
  };
};

const getDashboardData = unstable_cache(
  async (proveedorId: string): Promise<DashboardData> => {
    const [
      productosListados,
      ultimoProducto,
      cliente,
      participacionesMes,
      participaciones90d,
      resultados90d,
      feedbacks5,
      recBatches
    ] = await prisma.$transaction([
      prisma.producto.count({ where: { proveedor_id: proveedorId } }),
      prisma.producto.findFirst({
        where: { proveedor_id: proveedorId },
        orderBy: { fecha_actualizacion: "desc" },
        select: { fecha_actualizacion: true },
      }),
      prisma.cliente.findUnique({
        where: { id_cliente: proveedorId },
        select: { certificaciones: true, nombre: true },
      }),
      prisma.cotizacionParticipacion.count({
        where: { proveedor_id: proveedorId, fecha: { gte: startOfMonth(new Date()) } },
      }),
      prisma.cotizacionParticipacion.count({
        where: { proveedor_id: proveedorId, fecha: { gte: daysAgo(90) } },
      }),
      prisma.cotizacionParticipacion.findMany({
        where: { proveedor_id: proveedorId, fecha: { gte: daysAgo(90) } },
        select: { resultado: true },
      }),
      prisma.cotizacionParticipacion.findMany({
        where: { proveedor_id: proveedorId },
        orderBy: { fecha: "desc" },
        take: 5,
        select: {
          id: true, fecha: true, proyecto: true, accion: true, resultado: true,
          comentario: true, sugerencia: true
        },
      }),
      prisma.recommendationBatch.findMany({
        where: { cliente_id: proveedorId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          fecha_analisis: true as any,
          items: { select: { id: true, tipo: true, mensaje: true, producto: true } }
        },
      }),
    ]);

    return {
      productosListados,
      ultimoProductoFecha: ultimoProducto?.fecha_actualizacion ?? null,
      cliente,
      participacionesMes,
      participaciones90d,
      resultados90d,
      feedbacks5,
      recBatch: recBatches?.[0]
        ? {
            createdAt: recBatches[0]?.createdAt ?? null,
            fecha_analisis: recBatches[0]?.fecha_analisis ?? null,
            items: recBatches[0]?.items ?? [],
          }
        : null,
    };
  },
  {
    revalidate: 60,
    tags: (proveedorId: string) => [`proveedor:${proveedorId}:home`],
  } as any
);

/* ===== Page ===== */
export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#efefef] to-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-8 text-center">
            <h1 className="text-3xl font-bold text-[#00152F] mb-4">Dashboard</h1>
            <p className="text-gray-600 text-lg">Iniciá sesión para ver tu resumen.</p>
          </div>
        </div>
      </main>
    );
  }
  const proveedorId = String((session.user as any).id_cliente ?? (session.user as any).id);

  // 1) Traigo data cacheada
  const data = await getDashboardData(proveedorId);

  // 2) Derivados ligeros (todo server-side, sin JS al cliente)
  const { productosListados, ultimoProductoFecha, cliente, participacionesMes, participaciones90d, resultados90d } = data;

  let estado: "ok" | "pending" = "pending";
  if (ultimoProductoFecha) {
    const diffMs = Date.now() - new Date(ultimoProductoFecha).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    estado = diffDays <= DAYS_THRESHOLD ? "ok" : "pending";
  }

  const top3Count = resultados90d.reduce(
    (acc: number, r) => acc + (isTop3(r.resultado) ? 1 : 0),
    0
  );
  const visibilidadPct = participaciones90d > 0
    ? Math.round((top3Count / participaciones90d) * 100)
    : 0;

  const pendientes: string[] = [];
  const isNewAccount = productosListados === 0 && participaciones90d === 0 && !ultimoProductoFecha;

  let score = isNewAccount ? 20 : 40;
  if (productosListados > 0) score += 25;
  if (estado === "ok") score += 15;
  if (hasCert(cliente?.certificaciones, "empresa")) score += 15;
  if (hasCert(cliente?.certificaciones, "mina")) score += 10;
  if (visibilidadPct >= 50) score += 10;

  if (!hasCert(cliente?.certificaciones, "empresa")) pendientes.push("Certificado de empresa");
  if (!hasCert(cliente?.certificaciones, "mina")) pendientes.push("Certificado proveedor mina");
  if (estado !== "ok") pendientes.push("Actualizar stock semanalmente");

  score = clamp(score, 0, 100);

  const baseRadar = buildRadar({
    velocidad: clamp(100 - daysBetween(ultimoProductoFecha ?? undefined) * 8, 20, 95),
    calidad: 60 + visibilidadPct / 4,
    precios: 60 + visibilidadPct / 3,
    disponibilidad: estado === "ok" ? 85 : 55,
    cumplimiento: 75,
    participacion: Math.min(90, participacionesMes * 6 + 40),
    reputacion: score,
  });

  const hasCotizaciones = participaciones90d > 0;
  const radarData = hasCotizaciones ? baseRadar : Array(baseRadar.length).fill(0);

  return (
    <main className="min-h-screen overflow-x-hidden">
    {/* ✅ SOLUCIÓN: Padding responsive y overflow-x-hidden */}
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      
      {/* Header mejorado con mejor responsive */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#00152F] to-[#001a3d] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Inicio</h1>
          <p className="text-blue-200 text-base sm:text-lg break-words">
            Aqui tienes tu resumen de cuenta, {cliente?.nombre || 'Proveedor'}
          </p>
        </div>
        {/* Decorative elements - ocultos en móvil si causan problemas */}
        <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/5 rounded-full blur-xl hidden sm:block"></div>
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#FFBD00]/10 rounded-full blur-lg hidden sm:block"></div>
      </div>

        {/* KPIs Grid mejorado */}
        <section className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Productos listados" 
            value={productosListados}
            icon="📦"
            color="blue"
            delay="0ms"
          />
          <StatCard 
            title="Stock actualizado" 
            value={estado === "pending" ? "PENDIENTE" : "OK"} 
            subtitle={formatDateArg(ultimoProductoFecha)} 
            status={estado}
            icon="📊"
            color={estado === "ok" ? "green" : "red"}
            delay="100ms"
          />
          <StatCard 
            title="Descuento por mayor" 
            value="—" 
            subtitle="(configurar en perfil)"
            icon="💰"
            color="yellow"
            delay="200ms"
          />
          <StatCard 
            title="Participación" 
            value={String(participaciones90d || 0)} 
            subtitle="últimos 90 días"
            icon="📈"
            color="purple"
            delay="300ms"
          />
        </section>

        {/* Analytics Section mejorado */}
        <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 order-2 lg:order-1">
            <ChartCard title="MÉTRICAS DE RENDIMIENTO" delay="400ms">
              <div className="w-full max-w-[280px] mx-auto">
                <RadarChartSVG
                  labels={[
                    "Velocidad","Calidad","Precios","Disponibilidad",
                    "Cumplimiento","Participación","Reputación"
                  ]}
                  values={radarData}
                />
              </div>
            </ChartCard>
          </div>

          <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">
            <ScoreCard 
              score={score}
              visibilidadPct={visibilidadPct}
              pendientes={pendientes}
              delay="500ms"
            />
            
            <QuickStatsCard 
              participacionesMes={participacionesMes}
              delay="600ms"
            />
          </div>
        </section>

        {/* Async Sections con mejor loading */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ModernSkeleton title="Feedback Reciente" />}>
            <FeedbackSection proveedorId={proveedorId} />
          </Suspense>

          <Suspense fallback={<ModernSkeleton title="Recomendaciones" />}>
            <RecomendacionesSection proveedorId={proveedorId} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

/* ===== Componentes Modernos ===== */
function StatCard({ 
  title, 
  value, 
  subtitle, 
  status, 
  icon, 
  color, 
  delay 
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  status?: "ok" | "pending";
  icon: string;
  color: string;
  delay: string;
}) {
  const colorClassesMap: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/50",
    green: "from-green-500/10 to-green-600/5 border-green-200/50",
    red: "from-red-500/10 to-red-600/5 border-red-200/50",
    yellow: "from-yellow-500/10 to-yellow-600/5 border-yellow-200/50",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-200/50",
  };
  
  const colorClasses = colorClassesMap[color] || colorClassesMap.blue;

  return (
    <div 
      className={`group relative overflow-hidden bg-gradient-to-br ${colorClasses} backdrop-blur-sm rounded-2xl border p-6 hover:shadow-lg transition-all duration-500 hover:-translate-y-1`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-2xl opacity-60">{icon}</span>
        {status && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {status === "ok" ? "✓" : "⚠"}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
        <p className="text-2xl font-bold text-[#00152F] mb-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, delay }: { title: string; children: React.ReactNode; delay: string }) {
  return (
    <div 
      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-500 h-full flex flex-col"
      style={{ animationDelay: delay }}
    >
      <h2 className="text-sm font-semibold text-gray-700 mb-6 tracking-wide">{title}</h2>
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function ScoreCard({ 
  score, 
  visibilidadPct, 
  pendientes, 
  delay 
}: { 
  score: number; 
  visibilidadPct: number; 
  pendientes: string[]; 
  delay: string; 
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-500">
      <div className="space-y-6">
        <VisibilityBar value={visibilidadPct} />
        
        {/* ✅ SOLUCIÓN: Layout responsive para móvil */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#00152F] to-[#001a3d] flex items-center justify-center">
                <span className="text-white font-bold text-lg">{score}</span>
              </div>
              <div className="absolute -inset-1 rounded-full border-2 border-[#FFBD00]/30"></div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Puntaje de cuenta</h3>
              <p className="text-2xl font-bold text-[#00152F]">{score}/100</p>
            </div>
          </div>
          
          <div className="flex-1 w-full sm:w-auto">
            {pendientes.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <span className="text-lg">✓</span>
                <span className="text-sm font-medium">Sin pendientes</span>
              </div>
            ) : (
              <ul className="space-y-1 text-sm text-gray-600">
                {pendientes.slice(0, 2).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 break-words">
                    <span className="w-1.5 h-1.5 bg-[#FFBD00] rounded-full mt-2 flex-shrink-0"></span>
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <Link 
            href="/dashboard/profile" 
            className="bg-[#FFBD00] hover:bg-[#e6a600] text-[#00152F] font-medium px-4 py-2 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap self-start sm:self-center"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuickStatsCard({ participacionesMes, delay }: { participacionesMes: number; delay: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-500">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">ACTIVIDAD RECIENTE</h3>
      {/* ✅ SOLUCIÓN: Grid responsive que se adapta a móvil */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
        <QuickStat label="Este mes" value={String(participacionesMes || 0)} icon="📅" />
        <QuickStat label="Última respuesta" value="—" icon="⚡" />
        <QuickStat label="Total cotizado" value="—" icon="💼" />
      </div>
    </div>
  );
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors min-w-0">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs text-gray-500 mb-1 break-words leading-tight">{label}</div>
      <div className="font-semibold text-[#00152F] text-sm sm:text-base break-all">{value}</div>
    </div>
  );
}

function VisibilityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct < 40 ? "#ef4444" : pct < 70 ? "#FFBD00" : "#22c55e";
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Visibilidad del perfil</h3>
        <span className="text-sm font-bold text-[#00152F]">{pct}%</span>
      </div>
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{ 
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>
      <p className="text-xs text-gray-500">Top 3 en últimos 90 días</p>
    </div>
  );
}

function RadarChartSVG({ labels, values }: { labels: string[]; values: number[] }) {
  const count = labels.length;
  const R = 80;
  const center = { x: R + 20, y: R + 20 };
  const toPoint = (i: number, v: number) => {
    const angle = ((Math.PI * 2) / count) * i - Math.PI / 2;
    const r = (v / 100) * R;
    return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
  };
  const gridLevels = 4;
  const gridPolys = Array.from({ length: gridLevels }, (_, k) =>
    Array.from({ length: count }, (_, i) => toPoint(i, ((k + 1) / gridLevels) * 100))
  );
  const areaPoints = values.map((v, i) => toPoint(i, v));
  const areaPath = areaPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
  
  return (
    <div className="flex items-center justify-center p-4 w-full overflow-hidden">
      <svg 
        width="100%" 
        height="200" 
        viewBox={`0 0 ${center.x * 2} ${center.y * 2}`}
        className="drop-shadow-sm max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {gridPolys.map((poly, idx) => (
          <polygon 
            key={idx} 
            points={poly.map(p => `${p.x},${p.y}`).join(" ")} 
            fill="none" 
            stroke="#e5e7eb" 
            strokeWidth="1"
            opacity={0.6}
          />
        ))}
        {/* Radial lines */}
        {labels.map((_, i) => {
          const end = toPoint(i, 100);
          return (
            <line 
              key={i} 
              x1={center.x} 
              y1={center.y} 
              x2={end.x} 
              y2={end.y} 
              stroke="#e5e7eb" 
              strokeWidth="1"
              opacity={0.6}
            />
          );
        })}
        {/* Data area */}
        <path 
          d={areaPath} 
          fill="url(#radarGradient)" 
          stroke="#00152F" 
          strokeWidth="2"
          opacity={0.8}
        />
        {/* Data points */}
        {areaPoints.map((point, i) => (
          <circle 
            key={i} 
            cx={point.x} 
            cy={point.y} 
            r="3" 
            fill="#FFBD00"
            stroke="#00152F"
            strokeWidth="2"
          />
        ))}
        {/* Labels */}
        {labels.map((lbl, i) => {
          const p = toPoint(i, 115);
          return (
            <text 
              key={i} 
              x={p.x} 
              y={p.y} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              fontSize="9" 
              fill="#374151"
              fontWeight="500"
            >
              {lbl}
            </text>
          );
        })}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00152F" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#FFBD00" stopOpacity="0.1"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ===== Secciones Async Mejoradas ===== */
async function FeedbackSection({ proveedorId }: { proveedorId: string }) {
  const { feedbacks5 } = await getDashboardData(proveedorId);
  
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[#00152F]">Feedback Reciente</h2>
        <span className="text-xs text-gray-500">{feedbacks5.length} registros</span>
      </div>
      
      <div className="space-y-4">
        {feedbacks5.length === 0 ? (
          <EmptyState 
            text="Todavía no hay feedback registrado" 
            subtext="Carga tu stock y participa de las cotizaciones"
            icon="📝"
          />
        ) : (
          feedbacks5.map((f) => <FeedbackRow key={f.id} data={f} />)
        )}
      </div>
      
      {feedbacks5.length > 0 && (
        <div className="mt-6">
          <Link 
            href="/dashboard/feedback" 
            className="inline-flex items-center gap-2 bg-[#00152F] hover:bg-[#001a3d] text-white px-4 py-2 rounded-xl transition-all duration-200 hover:shadow-md text-sm font-medium"
          >
            Ver historial completo
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

async function RecomendacionesSection({ proveedorId }: { proveedorId: string }) {
  const { recBatch } = await getDashboardData(proveedorId);
  const items = recBatch?.items ?? [];
  const fecha = recBatch?.fecha_analisis ?? recBatch?.createdAt ?? null;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[#00152F]">Recomendaciones</h2>
        {fecha && (
          <span className="text-xs text-gray-500">
            Actualizado: {formatDateArg(fecha)}
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        {items.length === 0 ? (
          <EmptyState 
            text="Aún no hay recomendaciones disponibles" 
            subtext="Carga tu stock y actualiza las notificaciones en tu menú"
            icon="💡"
          />
        ) : (
          items.map((r) => (
            <div key={r.id} className="group p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#FFBD00] to-[#e6a600] rounded-lg flex items-center justify-center text-sm">
                  💡
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#00152F] bg-gray-100 px-2 py-1 rounded">
                      {r.tipo ?? "General"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {r.mensaje ?? "—"}
                    {r.producto && (
                      <span className="text-gray-600"> — {r.producto}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ===== Componentes de UI Mejorados ===== */
function EmptyState({ text, subtext, icon }: { text: string; subtext: string; icon: string }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3 opacity-60">{icon}</div>
      <p className="text-gray-600 font-medium mb-1">{text}</p>
      <p className="text-sm text-gray-500">{subtext}</p>
    </div>
  );
}

function FeedbackRow({ data }: { data: any }) {
  const detalle = data.sugerencia ?? data.comentario;
  const isPositive = data.resultado?.toLowerCase().includes('top') || 
                    data.resultado?.toLowerCase().includes('ganó') ||
                    data.resultado?.toLowerCase().includes('seleccionado');
  
                    return (
                      <div className="group p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                            isPositive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isPositive ? '✓' : '📋'}
                          </div>
                          <div className="flex-1 min-w-0"> {/* ✅ min-w-0 previene overflow */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <span className="text-xs text-gray-500">{formatDateArg(data.fecha)}</span>
                              <span className="text-xs font-medium text-[#00152F] bg-gray-50 px-2 py-1 rounded self-start break-words">
                                {data.proyecto ?? "Sin proyecto"}
                              </span>
                            </div>
                            <div className="mb-1 break-words">
                              <span className="text-sm font-medium text-gray-900">{data.accion ?? "—"}</span>
                              <span className="text-gray-400 mx-2 hidden sm:inline">•</span>
                              <span className={`text-sm font-medium block sm:inline ${isPositive ? 'text-green-600' : 'text-gray-700'}`}>
                                {data.resultado ?? "—"}
                              </span>
                            </div>
                            {detalle && (
                              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-2 rounded-lg mt-2 break-words">
                                {detalle}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

function ModernSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-300">{title}</h2>
        <div className="w-16 h-4 bg-gray-200 rounded"></div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-3 bg-gray-200 rounded"></div>
                  <div className="w-20 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded"></div>
                <div className="w-3/4 h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Styles CSS-in-JS para animaciones ===== */
const styles = `
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes pulseGlow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 189, 0, 0.4);
    }
    50% {
      box-shadow: 0 0 0 10px rgba(255, 189, 0, 0);
    }
  }
  
  .animate-slide-in-up {
    animation: slideInUp 0.6s ease-out forwards;
  }
  
  .animate-fade-in-scale {
    animation: fadeInScale 0.5s ease-out forwards;
  }
  
  .animate-pulse-glow {
    animation: pulseGlow 2s ease-in-out infinite;
  }
  
  /* Optimizaciones de rendimiento */
  .will-change-transform {
    will-change: transform;
  }
  
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
  }
  
  /* Mejoras de scroll */
  .scroll-smooth {
    scroll-behavior: smooth;
  }
  
  /* Hover states optimizados */
  .hover-lift {
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px -5px rgba(0, 21, 47, 0.1), 
                0 4px 10px -2px rgba(0, 21, 47, 0.05);
  }
  
  /* Loading states */
  .skeleton-wave {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
  }
  
  @keyframes skeleton-loading {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

// Inyectar estilos en el head (solo en cliente)
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}