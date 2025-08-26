// app/dashboard/notifications/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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

function fmtFechaISO(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function PriorityBadge({ p }: { p: Prioridad }) {
  const map: Record<Prioridad, string> = {
    alta: "bg-red-100 text-red-700",
    media: "bg-yellow-100 text-yellow-800",
    baja: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${map[p]}`}>
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


async function fetchRecos(clienteId: string): Promise<RecoResponse> {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host")!;
    const origin = `${proto}://${host}`;
  
    const res = await fetch(`${origin}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId }),
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

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // intenta varias propiedades habituales para el id del cliente
  const clienteId =
    (session.user as any)?.id_cliente ||
    (session.user as any)?.id ||
    (session.user as any)?.userId ||
    "3a036ad5-a1ca-4b74-9a55-b945157fd63e"; // fallback para pruebas

  const data = await fetchRecos(String(clienteId));
  const recos = data.recomendaciones ?? [];

  const countAlta = recos.filter(r => r.prioridad === "alta").length;
  const countMedia = recos.filter(r => r.prioridad === "media").length;
  const countBaja = recos.filter(r => r.prioridad === "baja").length;

  return (
    <div className="space-y-8">
      {/* Título */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">NOTIFICACIONES</h1>
      </header>

      {/* Actividad Reciente */}
      <section className="bg-white border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-4">ACTIVIDAD RECIENTE :</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
          {/* Bloque de resumen */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Último Análisis</p>
              <p className="text-base font-medium">{fmtFechaISO(data.fecha_analisis)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Total Recomendaciones</p>
              <p className="text-base font-medium">{data.total_recomendaciones ?? recos.length}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Prioridades</p>
              <p className="text-sm mt-1 flex gap-2 items-center">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {countAlta}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> {countMedia}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {countBaja}
                </span>
              </p>
            </div>
          </div>

          {/* Nota general / imagen lateral */}
          <div className="rounded-lg border p-4 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Resumen</p>
            <p className="text-sm">
              {data?.resumen?.nota_general ??
                "La IA generará recomendaciones para optimizar tu competitividad y catálogo."}
            </p>
          </div>
        </div>
      </section>

      {/* Historial de Notificaciones */}
      <section className="bg-white border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-4">HISTORIAL DE NOTIFICACIONES</h2>

        {recos.length === 0 ? (
          <div className="text-sm text-gray-500">Aún no hay notificaciones.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Detalle</th>
                  <th className="py-2 pr-4">Producto</th>
                  <th className="py-2 pr-4">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {recos.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-3 pr-4">
                      <div className="inline-flex items-center">
                        <TipoIcon tipo={r.tipo} />
                        <span className="capitalize">{r.tipo}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">{r.mensaje}</td>
                    <td className="py-3 pr-4">{r.producto ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <PriorityBadge p={r.prioridad} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
