// app/dashboard/feedback/FeedbackClient.tsx
"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type FeedbackRow = {
  id: string;
  fecha: string; // ISO
  proyecto: string;
  accion: string;
  resultado: string;
  comentario?: string;
  sugerencia?: string; // texto que llega desde n8n
};

export type FeedbackMetrics = {
  totalParticipaciones: number;
  pctRespuestaATiempo: number;
  pctAceptacion: number;
  promedioCalificacion: number;
  tiempoPromedioEntregaDias: number;
};

const AZUL = "#00152F";
const AMARILLO = "#FFBD00";
const GRIS = "#efefef";

export default function FeedbackClient({
  rows,
  metrics,
}: {
  rows: FeedbackRow[];
  metrics: FeedbackMetrics;
}) {
  const title = "Métricas resumidas";

  const suggestions = useMemo(
    () => rows.filter((r) => r.sugerencia && r.sugerencia.trim().length > 0),
    [rows]
  );

  return (
    <div className="w-full px-4 pb-16 pt-6 md:px-8">
            <header>
        <h1 className="text-2xl mb-4 text-gray-900 font-semibold tracking-wide">HISTORIAL</h1>
      </header>
      {/* MÉTRICAS */}
      <section
        className="grid grid-cols-1 gap-6 rounded-2xl p-6 shadow-sm md:grid-cols-[1.2fr,1fr]"
        style={{ backgroundColor: GRIS, border: `1px solid ${AZUL}1A` }} // 1A ~ 10% alpha
      >
        <div className="space-y-4">
          <h2
            className="text-xl font-semibold tracking-tight"
            style={{ color: AZUL }}
          >
            {title} :
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricItem
              label="Participaciones Totales"
              value={`${metrics.totalParticipaciones} Cotizaciones`}
            />
            <MetricItem
              label="% De Respuesta A Tiempo"
              value={`${metrics.pctRespuestaATiempo}%`}
            />
            <MetricItem
              label="% De Aceptación"
              value={`${metrics.pctAceptacion}%`}
            />
            <MetricItem
              label="Promedio De Calificación"
              value={`${metrics.promedioCalificacion} Estrellas`}
            />
            <MetricItem
              label="Tiempo Promedio De Entrega"
              value={`${metrics.tiempoPromedioEntregaDias} Días`}
            />
          </div>
        </div>

        {/* Imagen/hero de la derecha (opcional: usa tu propia) */}
        <div className="hidden overflow-hidden rounded-xl md:block">
          <div className="h-full w-full bg-[url('/mining-hero.jpg')] bg-cover bg-center opacity-90" />
        </div>
      </section>

      {/* HISTORIAL */}
      <section className="mt-10">
        <h3
          className="mb-3 text-lg font-semibold tracking-tight"
          style={{ color: AZUL }}
        >
          HISTORIAL DE FEEDBACK
        </h3>

        <div
          className="overflow-x-auto rounded-xl"
          style={{ border: `1px solid ${AZUL}33` }} // 20% alpha
        >
          <table
            className="min-w-full text-sm"
            style={{ color: AZUL, borderColor: `${AZUL}33` }}
          >
            <thead style={{ backgroundColor: `${AMARILLO}33` }}>
              <tr>
                <Th>Fecha</Th>
                <Th>Proyecto / Solicitud</Th>
                <Th>Rol / Acción</Th>
                <Th>Resultado</Th>
                <Th>Comentario (opcional)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="transition-colors"
                  style={{
                    borderTop: `1px solid ${AZUL}1A`,
                  }}
                >
                  <Td>
                    {format(new Date(r.fecha), "dd/MM/yyyy", { locale: es })}
                  </Td>
                  <Td>{r.proyecto}</Td>
                  <Td>{r.accion}</Td>
                  <Td>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs",
                        badgeClass(r.resultado),
                      ].join(" ")}
                    >
                      {r.resultado}
                    </span>
                  </Td>
                  <Td>
                    <div className="max-w-[36ch] truncate">
                      {r.comentario || "-"}
                    </div>
                    {r.sugerencia ? (
                      <div
                        className="mt-1 text-xs italic"
                        style={{ opacity: 0.8 }}
                      >
                        Sugerencia: {r.sugerencia}
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center"
                    style={{ opacity: 0.7 }}
                  >
                    Aún no hay participaciones registradas para tu cuenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bloque de sugerencias */}
        {suggestions.length > 0 && (
          <div
            className="mt-6 rounded-xl p-4 text-sm"
            style={{
              backgroundColor: GRIS,
              border: `1px solid ${AZUL}33`,
              color: AZUL,
            }}
          >
            <p className="mb-2 font-medium">Sugerencias recientes (desde n8n):</p>
            <ul className="list-disc space-y-1 pl-5">
              {suggestions.slice(0, 5).map((s) => (
                <li key={`s-${s.id}`}>
                  <span style={{ opacity: 0.8 }}>{s.sugerencia}</span>{" "}
                  <span style={{ opacity: 0.5 }}>
                    — {format(new Date(s.fecha), "dd/MM/yyyy", { locale: es })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  const AZUL = "#00152F";
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "white",
        border: `1px solid ${AZUL}33`,
      }}
    >
      <div className="text-[13px]" style={{ color: `${AZUL}B3` }}>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold" style={{ color: AZUL }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  const AZUL = "#00152F";
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase"
      style={{ color: AZUL }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function badgeClass(resultado?: string) {
  const r = (resultado || "").toLowerCase();
  // Aceptado → verde claro
  if (r.includes("acept"))
    return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300";
  // No seleccionada → usa tu amarillo de marca
  if (r.includes("no seleccion"))
    return "bg-[#FFBD00]/20 text-[#00152F] ring-1 ring-[#FFBD00]/50";
  // En evaluación → celeste
  if (r.includes("evalu"))
    return "bg-sky-100 text-sky-700 ring-1 ring-sky-300";
  // Rechazado
  if (r.includes("rechaz"))
    return "bg-rose-100 text-rose-700 ring-1 ring-rose-300";
  // Neutro
  return "bg-[#efefef] text-[#00152F]/70 ring-1 ring-[#00152F]/20";
}
