import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Payload mínimo para enviar a n8n
    const payload = {
      userId: body.userId,
      event: body.event ?? "manual-trigger",
    };

    // URL del webhook de n8n
    const url = process.env.N8N_WEBHOOK_URL!; 
    const secret = process.env.N8N_WEBHOOK_SECRET!;

    // Firma HMAC para seguridad
    const signature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    // Disparo hacia n8n
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
