import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

/** Validación básica de envs para errores más claros */
function assertEnv(name: string) {
  const v = process.env[name]
  if (!v || v.trim() === '') throw new Error(`Falta configurar la variable de entorno ${name}`)
  return v
}

const SMTP_HOST = assertEnv('SMTP_HOST')
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER = assertEnv('SMTP_USER')
const SMTP_PASS = assertEnv('SMTP_PASS')
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'soporte@tuempresa.com'

/** Transport correcto (createTransport, no createTransporter) */
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión.' },
        { status: 401 }
      )
    }

    const { asunto, mensaje } = await request.json()

    if (!asunto || !mensaje) {
      return NextResponse.json(
        { error: 'Asunto y mensaje son requeridos' },
        { status: 400 }
      )
    }
    if (asunto.trim().length === 0 || mensaje.trim().length < 10) {
      return NextResponse.json(
        { error: 'El asunto no puede estar vacío y el mensaje debe tener al menos 10 caracteres' },
        { status: 400 }
      )
    }

    // Tu sesión parece tener "nombre" en lugar de "name" (y hacemos fallback por si acaso)
    const userEmail = session.user.email
    const userName =
      session.user.nombre ?? (session.user as any).name ?? 'Usuario'

    const now = new Date().toLocaleString('es-ES')

    const supportEmailContent = {
      from: SMTP_FROM,
      to: SUPPORT_EMAIL,
      subject: `[SOPORTE] ${asunto}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #00152F; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Nueva Consulta de Soporte</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #00152F; margin-top: 0;">Detalles de la Consulta</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #00152F;">Usuario:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #00152F;">Email:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #00152F;">Asunto:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${asunto}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #00152F;">Fecha:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${now}</td>
              </tr>
            </table>
            
            <div style="background-color: white; padding: 20px; border-left: 4px solid #FFBD00; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #00152F;">Mensaje:</h3>
              <p style="line-height: 1.6; color: #333; white-space: pre-wrap;">${mensaje}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #e8f4f8; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #00152F;"><strong>Responder a:</strong> ${userEmail}</p>
            </div>
          </div>
        </div>
      `,
    }

    const userConfirmationEmail = {
      from: SMTP_FROM,
      to: userEmail,
      subject: `Confirmación: Hemos recibido tu consulta - ${asunto}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #00152F; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">¡Consulta Recibida!</h1>
          </div>
          
          <div style="padding: 20px;">
            <p style="font-size: 16px; color: #333;">Hola <strong>${userName}</strong>,</p>
            <p style="color: #333; line-height: 1.6;">
              Hemos recibido exitosamente tu consulta de soporte. El equipo de cotizamin la revisará y te responderá lo antes posible.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #00152F;">Resumen de tu consulta:</h3>
              <p style="margin: 5px 0;"><strong>Asunto:</strong> ${asunto}</p>
              <p style="margin: 5px 0;"><strong>Fecha:</strong> ${now}</p>
              <p style="margin: 5px 0;"><strong>Email de contacto:</strong> ${userEmail}</p>
            </div>
            
            <div style="background-color: #fff9e6; padding: 15px; border-left: 4px solid #FFBD00; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>Tiempo estimado de respuesta:</strong> 24-48 horas durante días laborables.</p>
            </div>
            
            <p style="color: #333;">Gracias por utilizar cotizamin.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">Este es un email automático, por favor no responder directamente.</p>
            </div>
          </div>
        </div>
      `,
    }

    await Promise.all([
      transporter.sendMail(supportEmailContent),
      transporter.sendMail(userConfirmationEmail),
    ])

    return NextResponse.json({ message: 'Consulta enviada exitosamente' }, { status: 200 })
  } catch (error) {
    console.error('Error al enviar email de soporte:', error)
    const message =
      error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
