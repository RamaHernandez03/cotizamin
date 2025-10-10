"use client";

import { useMemo, useState } from "react";
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
const clean = (t?: string) => (t ?? "").replace(/simulada/ig, "").trim();

/** Intenta extraer "P/T" desde resultado o comentario (2/10, posición 2 de 10, puesto 2 sobre 10, etc.) */
function extractRankShort(resultado?: string, comentario?: string) {
  const candidates = [resultado ?? "", comentario ?? ""];
  for (const raw of candidates) {
    const t = (raw || "").toLowerCase();

    // 1) Formato directo: "2/10"
    let m = t.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return `${m[1]}/${m[2]}`;

    // 2) "posición 2 de 10", "posicion 2 de 10"
    m = t.match(/posici(?:ó|o)n\s+(\d+)\s+(?:de|sobre)\s+(\d+)/i);
    if (m) return `${m[1]}/${m[2]}`;

    // 3) "puesto 2 de 10" / "puesto 2 sobre 10"
    m = t.match(/puesto\s+(\d+)\s+(?:de|sobre)\s+(\d+)/i);
    if (m) return `${m[1]}/${m[2]}`;

    // 4) "ranking: 2/10", "rank 2/10", "ranking 2 de 10"
    m = t.match(/rank(?:ing)?[:=]?\s*(\d+)\s*(?:\/|\bde\b|\bsobre\b)\s*(\d+)/i);
    if (m) return `${m[1]}/${m[2]}`;

    // 5) "quedaste 2 de 10" / "quedó 2 de 10"
    m = t.match(/qued(?:a|o|aste)\s+(\d+)\s+(?:de|sobre)\s+(\d+)/i);
    if (m) return `${m[1]}/${m[2]}`;
  }
  return null;
}

/** Badge neutral para números de ranking tipo "2/10" */
function rankBadgeClass() {
  return "bg-[#efefef] text-[#00152F] ring-1 ring-[#00152F]/20";
}

/* ========================================================== */

/** Bloque para comentario con scroll interno si supera el alto máximo */
function CommentCell({ text, sugerencia }: { text?: string; sugerencia?: string }) {
  const comentario = text?.trim() ?? "";
  if (!comentario) return <span className="text-slate-400">-</span>;

  return (
    <div className="text-slate-700">
      <div
        className={[
          "rounded-lg border border-slate-200/70 bg-white/70 p-3 text-[13px] leading-relaxed",
          "whitespace-pre-wrap break-words",
          "overflow-y-auto pr-2",           // scroll vertical + un poco de padding para la barra
          "max-h-40 md:max-h-56",           // alto máximo
        ].join(" ")}
      >
        {comentario}
      </div>

      {sugerencia && (
        <div className="mt-2 text-xs italic text-blue-700/90">
          Sugerencia IA: {sugerencia}
        </div>
      )}
    </div>
  );
}

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
        <h1 className="mb-4 text-2xl font-semibold tracking-wide text-gray-900">
          HISTORIAL
        </h1>
      </header>

      {/* MÉTRICAS */}
      <section
        className="grid grid-cols-1 gap-6 rounded-2xl p-6 shadow-sm md:grid-cols-[1.2fr,1fr]"
        style={{ backgroundColor: GRIS, border: `1px solid ${AZUL}1A` }}
      >
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: AZUL }}>
            {title} :
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricItem label="Participaciones Totales" value={`${metrics.totalParticipaciones} Cotizaciones`} />
            <MetricItem label="% De Respuesta A Tiempo" value={`${metrics.pctRespuestaATiempo}%`} />
            <MetricItem label="% De Aceptación" value={`${metrics.pctAceptacion}%`} />
            <MetricItem label="Promedio De Calificación" value={`${metrics.promedioCalificacion} Estrellas`} />
            <MetricItem label="Tiempo Promedio De Entrega" value={`${metrics.tiempoPromedioEntregaDias} Días`} />
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-xl md:block">
          <div className="h-full w-full bg-[url('/mining-hero.jpg')] bg-cover bg-center opacity-90" />
        </div>
      </section>

      {/* HISTORIAL */}
      <section className="mt-10">
        <h3 className="mb-3 text-lg font-semibold tracking-tight" style={{ color: AZUL }}>
          HISTORIAL DE FEEDBACK
        </h3>

        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${AZUL}33` }}>
          <table className="min-w-full text-sm" style={{ color: AZUL, borderColor: `${AZUL}33` }}>
            <thead style={{ backgroundColor: `${AMARILLO}33` }}>
              <tr>
                <Th>Fecha</Th>
                <Th>Proyecto / Solicitud</Th>
                <Th>Rol / Acción</Th>
                <Th>Resultado</Th>
                <Th>Comentario</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const proyectoLimpio = clean(r.proyecto);
                const accionLimpia = clean(r.accion);
                const resultadoLimpio = clean(r.resultado);
                const rank = extractRankShort(r.resultado, r.comentario);
                const display = rank ?? resultadoLimpio;

                return (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{ borderTop: `1px solid ${AZUL}1A` }}
                  >
                    <Td>{format(new Date(r.fecha), "dd/MM/yyyy", { locale: es })}</Td>

                    <Td className="font-medium text-slate-700">
                      {extractDescAndCode(r.comentario, proyectoLimpio)}
                    </Td>

                    <Td className="text-slate-600">{accionLimpia}</Td>

                    <Td>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs",
                          rank ? rankBadgeClass() : badgeClass(resultadoLimpio),
                        ].join(" ")}
                        title={resultadoLimpio}
                      >
                        {display || "-"}
                      </span>
                    </Td>

                    <Td className="text-slate-700">
                      <CommentCell text={r.comentario} sugerencia={r.sugerencia} />
                    </Td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center" style={{ opacity: 0.7 }}>
                    Aún no hay participaciones registradas para tu cuenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {suggestions.length > 0 && (
          <div
            className="mt-6 rounded-xl p-4 text-sm"
            style={{ backgroundColor: GRIS, border: `1px solid ${AZUL}33`, color: AZUL }}
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
      style={{ backgroundColor: "white", border: `1px solid ${AZUL}33` }}
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
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: AZUL }}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function badgeClass(resultado?: string) {
  const r = (resultado || "").toLowerCase();
  if (r.includes("acept")) return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300";
  if (r.includes("no seleccion")) return "bg-[#FFBD00]/20 text-[#00152F] ring-1 ring-[#FFBD00]/50";
  if (r.includes("evalu")) return "bg-sky-100 text-sky-700 ring-1 ring-sky-300";
  if (r.includes("rechaz")) return "bg-rose-100 text-rose-700 ring-1 ring-rose-300";
  return "bg-[#efefef] text-[#00152F]/70 ring-1 ring-[#00152F]/20";
}
