// app/dashboard/home/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import StatWidget from "@/components/StatWidget";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";

/* ===== Config RSC ===== */
export const runtime = "nodejs";          // Prisma no corre en Edge
export const revalidate = 60;             // fallback global (60s)

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
          fecha_analisis: true as any, // por compatibilidad si el campo existe
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
            // @ts-ignore opcional si tu schema tiene fecha_analisis
            fecha_analisis: recBatches[0]?.fecha_analisis ?? null,
            items: recBatches[0]?.items ?? [],
          }
        : null,
    };
  },
  {
    revalidate: 60,
    tags: (proveedorId: string) => [`proveedor:${proveedorId}:home`], // útil para invalidar
  } as any // TS narrow workaround para tags como función
);

/* ===== Page ===== */
export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main className="p-6 text-blue-900">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p>Iniciá sesión para ver tu resumen.</p>
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
    <main className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>

      {/* KPIs top (render inmediato) */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatWidget title="Productos listados" value={productosListados} />
        <StatWidget title="Stock actualizado" value={estado === "pending" ? "PENDIENTE" : "OK"} subtitle={formatDateArg(ultimoProductoFecha)} status={estado} />
        <StatWidget title="Ofrece descuento por mayor" value="—" subtitle="(no definido en schema)" />
        <StatWidget title="Participación en cotizaciones" value={String(participaciones90d || 0)} subtitle="últimos 90 días" />
      </section>

      {/* Gráfico + Score/Pendientes */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">ÚLTIMAS COTIZACIONES</h2>
          <RadarChartSVG
            labels={[
              "Velocidad de respuesta","Calidad de cotizaciones","Precios",
              "Disponibilidad de stock","Cumplimiento de entrega","Participación activa","Reputación"
            ]}
            values={radarData}
          />
        </div>

        <div className="rounded-2xl border bg-white p-4 lg:col-span-2 grid gap-4">
          <div className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Visibilidad del perfil</h3>
            <VisibilityBar value={visibilidadPct} />
          </div>

          <div className="rounded-xl border p-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Puntaje de cuenta:</h3>
              <p className="text-2xl font-bold text-gray-900">{score}/100</p>
            </div>
            <ul className="text-sm text-gray-700 list-disc ml-6">
              {pendientes.length === 0 ? <li>Sin pendientes, ¡bien!</li>
                : pendientes.map((p, i) => <li key={i}>Pendiente: {p}</li>)}
            </ul>
            <Link href="/dashboard/profile" className="rounded-full bg-blue-900 text-white text-sm px-4 py-2">Ver perfil</Link>
          </div>
        </div>
      </section>

      {/* Actividad reciente (ligero) */}
      <section className="mt-6 rounded-2xl border bg-white p-4">
        <h2 className="mb-4 text-base font-bold text-gray-900">Actividad reciente</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <ActivityItem label="Cotizaciones este mes" value={String(participacionesMes || 0)} />
          <ActivityItem label="Última respuesta" value={"—"} />
          <ActivityItem label="Total cotizado" value={"—"} />
        </div>
      </section>

      {/* Feedback (streaming con cache) */}
      <Suspense fallback={<SectionSkeleton title="Feedback de las 5 últimas cotizaciones" rows={3} />}>
        <FeedbackSection proveedorId={proveedorId} />
      </Suspense>

      {/* Recomendaciones (streaming con cache) */}
      <Suspense fallback={<SectionSkeleton title="Recomendaciones" rows={3} />}>
        <RecomendacionesSection proveedorId={proveedorId} />
      </Suspense>
    </main>
  );
}

/* ===== Secciones async cacheadas (streaming) ===== */
async function FeedbackSection({ proveedorId }: { proveedorId: string }) {
  const { feedbacks5 } = await getDashboardData(proveedorId);
  return (
    <section className="mt-6 rounded-2xl border bg-white p-4">
      <h2 className="text-base font-bold text-gray-900">Feedback de las 5 últimas cotizaciones</h2>
      <div className="mt-3 space-y-3">
        {feedbacks5.length === 0
          ? <EmptyLine text="Todavía no hay feedback registrado. Carga tu stock y participa de las cotizaciones" />
          : feedbacks5.map((f) => <FeedbackRow key={f.id} data={f} />)}
      </div>
      <div className="mt-3">
        <Link href="/dashboard/feedback" className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-white text-sm">Ver historial</Link>
      </div>
    </section>
  );
}

async function RecomendacionesSection({ proveedorId }: { proveedorId: string }) {
  const { recBatch } = await getDashboardData(proveedorId);
  const items = recBatch?.items ?? [];
  const fecha = recBatch?.fecha_analisis ?? recBatch?.createdAt ?? null;

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4">
      <h2 className="text-base font-bold text-gray-900">Recomendaciones</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <EmptyLine text='Aún no hay recomendaciones. Carga tu stock y actualiza la pestaña "Notificaciones" en tu menú' />
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 text-sm text-gray-800">
              <div className="text-xs text-gray-500">{formatDateArg(fecha)}</div>
              <div><span className="font-semibold">[{r.tipo ?? "—"}]</span> {r.mensaje ?? "—"}{r.producto ? ` — ${r.producto}` : ""}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ===== Subcomponentes ===== */
function ActivityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed p-3 text-sm text-gray-500">{text}</div>;
}
function FeedbackRow({ data }: { data: any }) {
  const detalle = data.sugerencia ?? data.comentario;
  return (
    <div className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-500">{formatDateArg(data.fecha)}</div>
        <div className="text-xs text-gray-700">{data.proyecto ?? "—"}</div>
      </div>
      <div className="mt-1 text-sm text-gray-900 font-medium">{data.accion ?? "—"} · {data.resultado ?? "—"}</div>
      {detalle && <div className="mt-1 text-sm text-gray-700">{detalle}</div>}
    </div>
  );
}
function VisibilityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct < 40 ? "bg-red-500" : pct < 70 ? "bg-yellow-400" : "bg-green-500";
  const label = `${pct}% de visibilidad (Top 3 últimos 90 días)`;
  return (
    <div className="w-full">
      <div className="mb-1 text-sm text-gray-700">{label}</div>
      <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-3 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function RadarChartSVG({ labels, values }: { labels: string[]; values: number[] }) {
  const count = labels.length;
  const R = 120;
  const center = { x: R + 16, y: R + 16 };
  const toPoint = (i: number, v: number) => {
    const angle = ((Math.PI * 2) / count) * i - Math.PI / 2;
    const r = (v / 100) * R;
    return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
  };
  const gridLevels = 5;
  const gridPolys = Array.from({ length: gridLevels }, (_, k) =>
    Array.from({ length: count }, (_, i) => toPoint(i, ((k + 1) / gridLevels) * 100))
  );
  const areaPoints = values.map((v, i) => toPoint(i, v));
  const areaPath = areaPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
  return (
    <div className="flex items-center justify-center">
      <svg width={center.x * 2} height={center.y * 2}>
        {gridPolys.map((poly, idx) => (
          <polygon key={idx} points={poly.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#e5e7eb" />
        ))}
        {labels.map((_, i) => {
          const end = toPoint(i, 100);
          return <line key={i} x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="#e5e7eb" />;
        })}
        <path d={areaPath} fill="rgba(59,130,246,0.15)" stroke="#1f2937" />
        {labels.map((lbl, i) => {
          const p = toPoint(i, 115);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#374151">
              {lbl}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* Skeleton simple para Suspense */
function SectionSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-4 animate-pulse">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border p-3">
            <div className="h-3 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded mb-1" />
            <div className="h-3 w-2/3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
