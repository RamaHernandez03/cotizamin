'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle, AlertCircle, Clock, HelpCircle, Zap } from 'lucide-react'

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
    <main className="min-h-screen bg-white p-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full p-4 shadow-lg" style={{ backgroundColor: '#00152F' }}>
            <Mail className="h-10 w-10 text-white" />
          </div>
          <h1 className="mb-4 text-5xl font-bold" style={{ color: '#00152F' }}>
            Centro de Soporte
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            ¿Tienes alguna consulta sobre la gestión de tu inventario, problemas técnicos o necesitas asistencia?
            Nuestro equipo está aquí para ayudarte.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: '#00152F' }}>
                  Enviar Consulta
                </h2>
                <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: '#E8F4FD' }}>
                  <Zap className="h-4 w-4" style={{ color: '#00152F' }} />
                  <span className="text-sm font-medium" style={{ color: '#00152F' }}>Respuesta Rápida</span>
                </div>
              </div>

              {submitStatus === 'success' && (
                <div className="mb-6 rounded-xl border-2 border-green-200 p-5 shadow-sm" style={{ backgroundColor: '#f0fdf4' }}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-green-100 p-1">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">¡Consulta enviada exitosamente!</p>
                      <p className="mt-1 text-sm text-green-700">
                        Hemos recibido tu mensaje y te responderemos pronto.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 rounded-xl border-2 border-red-200 p-5 shadow-sm" style={{ backgroundColor: '#fef2f2' }}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-red-100 p-1">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800">Error al enviar la consulta</p>
                      <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="asunto"
                    className="mb-2 block text-sm font-semibold"
                    style={{ color: '#00152F' }}
                  >
                    Asunto <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="asunto"
                      name="asunto"
                      value={formData.asunto}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                      className={`w-full rounded-xl border-2 px-4 py-3.5 transition-all duration-300 focus:outline-none focus:ring-4 ${
                        asuntoHasValue 
                          ? 'bg-yellow-50/30' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      style={asuntoHasValue ? { 
                        borderColor: '#FFBD00',
                        boxShadow: '0 0 0 4px rgba(255, 189, 0, 0.1)'
                      } : {}}
                      placeholder="Describe brevemente tu consulta..."
                    />
                    {asuntoHasValue && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-5 w-5" style={{ color: '#FFBD00' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="mensaje"
                    className="mb-2 block text-sm font-semibold"
                    style={{ color: '#00152F' }}
                  >
                    Mensaje <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleChange}
                    required
                    rows={6}
                    disabled={isSubmitting}
                    className={`w-full resize-y rounded-xl border-2 px-4 py-3.5 transition-all duration-300 focus:outline-none focus:ring-4 ${
                      mensajeLen > 0 
                        ? 'bg-yellow-50/30' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    style={mensajeLen > 0 ? { 
                      borderColor: '#FFBD00',
                      boxShadow: '0 0 0 4px rgba(255, 189, 0, 0.1)'
                    } : {}}
                    placeholder="Detalla tu consulta, problema o sugerencia..."
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className={`text-xs font-medium ${mensajeLen >= 10 ? 'text-green-600' : 'text-slate-500'}`}>
                      {mensajeLen >= 10 ? '✓ Mínimo alcanzado' : `Mínimo 10 caracteres (${mensajeLen}/10)`}
                    </p>
                    <p className="text-xs text-slate-400">{mensajeLen} caracteres</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`group relative w-full overflow-hidden rounded-xl px-6 py-4 font-bold shadow-lg transition-all duration-300 ${
                    canSubmit
                      ? 'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                      : 'cursor-not-allowed bg-slate-200 text-slate-400'
                  }`}
                  style={canSubmit ? { backgroundColor: '#FFBD00', color: '#00152F' } : {}}
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-3 border-t-transparent" style={{ borderColor: '#00152F', borderTopColor: 'transparent' }} />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        <span>Enviar Consulta</span>
                      </>
                    )}
                  </div>
                  {canSubmit && (
                    <div className="absolute inset-0 -z-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundColor: '#FFD54F' }} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-6">
              <div className="rounded-2xl p-6 shadow-xl" style={{ backgroundColor: '#00152F' }}>
                <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
                  <HelpCircle className="h-6 w-6" />
                  Información de Contacto
                </h3>

                <div className="space-y-5">
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className="h-5 w-5" style={{ color: '#FFBD00' }} />
                      <h4 className="font-semibold text-white">Tiempo de Respuesta</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-100">
                      Normalmente respondemos en 24-48 horas durante días laborables.
                    </p>
                  </div>

                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <h4 className="mb-3 font-semibold text-white">Tipos de Consulta</h4>
                    <ul className="space-y-2 text-sm text-blue-100">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FFBD00' }} />
                        Problemas técnicos
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FFBD00' }} />
                        Gestión de inventario
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FFBD00' }} />
                        Configuración de productos
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FFBD00' }} />
                        Reportes y análisis
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FFBD00' }} />
                        Sugerencias de mejora
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <p className="text-sm leading-relaxed text-blue-100">
                      💡 <strong className="text-white">Tip:</strong> Para consultas urgentes, incluye tu RUC y email de registro en el mensaje.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  )
}