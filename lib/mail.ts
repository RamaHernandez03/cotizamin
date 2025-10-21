import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn("[mail] Faltan variables SMTP_*. Los mails no se enviarán.");
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

export function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const transporter = createTransport();
  if (!transporter) {
    console.warn("[mail] Transport no disponible. Saltando envío:", params.subject, params.to);
    return { ok: false, skipped: true };
  }
  const from = SMTP_FROM || SMTP_USER!;
  await transporter.sendMail({ from, ...params });
  return { ok: true };
}

/* ===== Helpers HTML sencillos ===== */
export function btn(url: string, label: string) {
  return `
    <a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#00152F;color:#fff;text-decoration:none;font-weight:600">
      ${label}
    </a>
  `;
}

export function wrap(title: string, body: string) {
  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #00152F1A;border-radius:16px">
    <h2 style="margin:0 0 12px 0;color:#00152F">${title}</h2>
    <div style="color:#1a2942;line-height:1.55">${body}</div>
    <p style="margin-top:24px;color:#667085;font-size:12px">Cotizamin • Notificación automática</p>
  </div>`;
}

export { getBaseUrl };
