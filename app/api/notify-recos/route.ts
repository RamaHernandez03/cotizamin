// app/api/notify-recos/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!process.env.N8N_WEBHOOK_URL) {
      return NextResponse.json({ ok: false, error: "N8N_WEBHOOK_URL missing" }, { status: 500 });
    }
    if (!process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "N8N_WEBHOOK_SECRET missing" }, { status: 500 });
    }

    const payload = {
      userId: body.userId,
      event: body.event ?? "manual-trigger",
    };

    const signature = crypto
      .createHmac("sha256", process.env.N8N_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    const res = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature, // asegurate que n8n lea este header
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text(); // ← body crudo para debug
    if (!res.ok) {
      console.error("notify-recos failed", res.status, text);
      return NextResponse.json({ ok: false, status: res.status, error: text }, { status: res.status });
    }

    // si es JSON, lo parseamos; si no, devolvemos como texto
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error("notify-recos exception", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
