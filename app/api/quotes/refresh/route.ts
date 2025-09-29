import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { proveedor_id } = await req.json();
  if (!proveedor_id) return NextResponse.json({ ok:false, error:"proveedor_id required" }, { status:400 });

  const base = process.env.N8N_BASE_URL!;
  const path = process.env.N8N_QUOTES_PATH || "/webhook/quotes-metrics.v1";

  const r = await fetch(`${base}${path}`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ proveedor_id }),
    cache: "no-store",
  });

  if (!r.ok) return NextResponse.json({ ok:false, error:`n8n ${r.status}` }, { status:502 });
  const j = await r.json().catch(() => ({}));

  return NextResponse.json({ ok:true, job_id: j.job_id ?? null });
}
