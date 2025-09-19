// lib/mailer.ts
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const appName = "Cotizamin";
  await transporter.sendMail({
    from,
    to,
    subject: "Confirmá tu email",
    html: `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
        <h2 style="color:#00152F">Confirmá tu email</h2>
        <p>Gracias por registrarte en ${appName}. Para activar tu cuenta hacé click:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#00152F;color:#fff;text-decoration:none">Confirmar correo</a></p>
        <p>O copiá este enlace:</p>
        <code>${verifyUrl}</code>
      </div>
    `,
  });
}
