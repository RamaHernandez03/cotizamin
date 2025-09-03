'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface SupportFormData {
  asunto: string
  mensaje: string
}

export default function SupportPage() {
  const [formData, setFormData] = useState<SupportFormData>({
    asunto: '',
    mensaje: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al enviar la consulta')
      }

      setSubmitStatus('success')
      setFormData({ asunto: '', mensaje: '' })
    } catch (error) {
      setSubmitStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const asuntoHasValue = formData.asunto.trim().length > 0
  const mensajeLen = formData.mensaje.trim().length
  const canSubmit = !isSubmitting && asuntoHasValue && mensajeLen >= 10

  return (
    <main className="min-h-screen p-4 text-blue-900">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 flex items-center gap-3 text-3xl font-bold" style={{ color: '#00152F' }}>
            <Mail className="h-8 w-8" />
            Centro de Soporte
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: '#00152F' }}>
            ¿Tienes alguna consulta sobre la gestión de tu inventario, problemas técnicos o necesitas asistencia?
            Nuestro equipo de soporte está aquí para ayudarte. Completa el formulario y nos pondremos en contacto
            contigo lo antes posible.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white p-8 shadow-lg">
              <h2 className="mb-6 text-xl font-semibold" style={{ color: '#00152F' }}>
                Enviar Consulta
              </h2>

              {/* Mensaje de éxito */}
              {submitStatus === 'success' && (
                <div
                  className="mb-6 flex items-center gap-3 rounded-lg border-l-4 p-4"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#FFBD00' }}
                >
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">¡Consulta enviada exitosamente!</p>
                    <p className="text-sm text-green-600">
                      Hemos recibido tu mensaje y te responderemos pronto.
                    </p>
                  </div>
                </div>
              )}

              {/* Mensaje de error */}
              {submitStatus === 'error' && (
                <div
                  className="mb-6 flex items-center gap-3 rounded-lg border-l-4 p-4"
                  style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444' }}
                >
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Error al enviar la consulta</p>
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campo Asunto */}
                <div>
                  <label
                    htmlFor="asunto"
                    className="mb-2 block text-sm font-medium"
                    style={{ color: '#00152F' }}
                  >
                    Asunto *
                  </label>
                  <input
                    type="text"
                    id="asunto"
                    name="asunto"
                    value={formData.asunto}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    aria-invalid={!asuntoHasValue}
                    className={clsx(
                      'w-full rounded-lg border-2 px-4 py-3 transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-[#FFBD00]',
                      asuntoHasValue ? 'border-[#FFBD00]' : 'border-gray-200'
                    )}
                    placeholder="Describe brevemente tu consulta..."
                  />
                </div>

                {/* Campo Mensaje */}
                <div>
                  <label
                    htmlFor="mensaje"
                    className="mb-2 block text-sm font-medium"
                    style={{ color: '#00152F' }}
                  >
                    Mensaje *
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleChange}
                    required
                    rows={6}
                    disabled={isSubmitting}
                    aria-invalid={mensajeLen < 10}
                    className={clsx(
                      'w-full resize-y rounded-lg border-2 px-4 py-3 transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-[#FFBD00]',
                      mensajeLen > 0 ? 'border-[#FFBD00]' : 'border-gray-200'
                    )}
                    placeholder="Detalla tu consulta, problema o sugerencia..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo 10 caracteres ({mensajeLen}/10)
                  </p>
                </div>

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={clsx(
                    'flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-white',
                    'transition-all duration-200 disabled:cursor-not-allowed',
                    'hover:brightness-110 hover:shadow-lg'
                  )}
                  style={{ backgroundColor: '#FFBD00' }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Enviar Consulta
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Panel informativo */}
          <div className="lg:col-span-1">
            <div className="rounded-xl p-6 shadow-lg" style={{ backgroundColor: '#00152F' }}>
              <h3 className="mb-4 text-lg font-semibold text-white">Información de Contacto</h3>

              <div className="space-y-4 text-gray-300">
                <div>
                  <h4 className="mb-2 font-medium text-white">Tiempo de Respuesta</h4>
                  <p className="text-sm">Normalmente respondemos en 24-48 horas durante días laborables.</p>
                </div>

                <div>
                  <h4 className="mb-2 font-medium text-white">Tipos de Consulta</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Problemas técnicos</li>
                    <li>• Gestión de inventario</li>
                    <li>• Configuración de productos</li>
                    <li>• Reportes y análisis</li>
                    <li>• Sugerencias de mejora</li>
                  </ul>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-sm">
                    Para consultas urgentes relacionadas con el sistema,
                    incluye tu RUC y email de registro en el mensaje.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
