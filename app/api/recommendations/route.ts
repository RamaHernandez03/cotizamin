// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";

function normalizeN8N(raw: any) {
  // Puede venir como:
  //  A) { response: { response: "<json-string>" } }
  //  B) { response: "<json-string>" }
  //  C) { response: { ...obj } }
  //  D) { ...obj }
  let payload: any = raw?.response?.response ?? raw?.response ?? raw;

  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch {
      payload = { recomendaciones: [], resumen: { error_parseo: true, raw: String(payload) } };
    }
  }

  const recomendaciones = Array.isArray(payload?.recomendaciones) ? payload.recomendaciones : [];

  return {
    ok: payload?.ok ?? true,
    cliente_id: payload?.cliente_id ?? null,
    fecha_analisis: payload?.fecha_analisis ?? null,
    total_recomendaciones: recomendaciones.length,
    recomendaciones,
    resumen: payload?.resumen ?? {},
    // deja pasar campos extra por si luego agregás más
    ...payload,
  };
}

export async function POST(req: NextRequest) {
  const { cliente_id } = await req.json();

  const base = process.env.N8N_BASE_URL!;
  const path = process.env.N8N_RECO_PATH || "/webhook/recomendacion";
  const url = `${base}${path}`;

  const n8nRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Si protegés el webhook, agrega:
      // Authorization: `Bearer ${process.env.N8N_TOKEN}`
    },
    body: JSON.stringify({ cliente_id }),
    cache: "no-store",
  });

  if (!n8nRes.ok) {
    return NextResponse.json(
      { ok: false, error: `n8n error ${n8nRes.status}` },
      { status: 502 }
    );
  }

  const raw = await n8nRes.json();
  const normalized = normalizeN8N(raw);
  return NextResponse.json(normalized);
}
