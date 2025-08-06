'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (res?.error) {
      setError(res.error)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Left side - Image (3/5) */}
      <div className="w-3/5 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900"
          style={{ 
            backgroundImage: `linear-gradient(135deg, #00152F 0%, #1e3a8a 50%, #3730a3 100%),
                            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundBlendMode: 'overlay'
          }}
        >
          {/* Animated geometric shapes */}
          <div className="absolute top-20 left-20 w-32 h-32 bg-white opacity-5 rounded-full animate-pulse"></div>
          <div className="absolute bottom-32 right-32 w-24 h-24 bg-white opacity-10 rotate-45 animate-bounce" style={{ animationDuration: '3s' }}></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 border-2 border-white opacity-20 rounded-lg animate-spin" style={{ animationDuration: '8s' }}></div>
          
          {/* Main content overlay */}
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-12">
            <div className="text-center max-w-lg">
              <h1 className="text-6xl font-bold mb-6 tracking-tight" style={{ color: '#efefef' }}>
                Cotizamin
              </h1>
              <p className="text-xl opacity-90 leading-relaxed mb-8">
                Inicia sesión para acceder a tu plataforma de gestión de cotizaciones
              </p>
              <div className="flex items-center justify-center space-x-8 text-sm opacity-75">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span>Seguro</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span>Rápido</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span>Confiable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form (2/5) */}
      <div className="w-2/5 flex flex-col" style={{ backgroundColor: '#efefef' }}>
        <div className="flex-1 flex flex-col justify-center p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#00152F' }}>
              Iniciar Sesión
            </h2>
            <p className="text-sm opacity-70" style={{ color: '#00152F' }}>
              Accede a tu cuenta de Cotizamin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
              style={{ backgroundColor: '#00152F' }}
            >
              Ingresar
            </button>

            <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                ¿Aun no estas Registrado?   <a href='http://localhost:3000/register' className='text-blue-700 hover:text-blue-500'>Registrate aqui</a>
              </label>


          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm opacity-60" style={{ color: '#00152F' }}>
              © 2025 Cotizamin. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}