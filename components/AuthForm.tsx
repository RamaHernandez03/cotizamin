"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function AuthForm() {
  const router = useRouter();
  const [form, setForm] = useState({ nombre:"", ruc:"", email:"", password:"" });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Error al registrar usuario");
      return;
    }

    // Auto-login con NextAuth
    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,           // importante para manejar el push manual
    });

    if (result?.error) {
      setMessage(result.error || "Error al iniciar sesión");
      return;
    }

    // Sesión creada: a home
    router.push("/dashboard/home");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Left side - Image (hidden on mobile, 3/5 on desktop) */}
      <div className="hidden lg:block lg:w-3/5 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-blue-900"
          style={{ 
            backgroundImage: `linear-gradient(135deg, #00152F 0%, #0f172a 30%, #1e3a8a 70%, #1e40af 100%),
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
              <h1 className="text-4xl xl:text-6xl font-bold mb-6 tracking-tight">
                <span style={{ color: '#efefef' }}>Cotiza</span>
                <span style={{ color: '#FFBD00' }}>min</span>
              </h1>
              <p className="text-lg xl:text-xl opacity-90 leading-relaxed mb-8">
                Únete a la plataforma lider de gestion de productos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header - Only visible on mobile */}
      <div className="lg:hidden bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-8 text-white text-center">
        <h1 className="text-3xl font-bold mb-2">
          <span style={{ color: '#efefef' }}>Cotiza</span>
          <span style={{ color: '#FFBD00' }}>min</span>
        </h1>
        <p className="text-sm opacity-90">
          Gestiona tus cotizaciones y productos
        </p>
      </div>

      {/* Right side - Register Form (full width on mobile, 2/5 on desktop) */}
      <div className="flex-1 lg:w-2/5 flex flex-col" style={{ backgroundColor: '#efefef' }}>
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: '#00152F' }}>
              Crear Cuenta
            </h2>
            <p className="text-sm opacity-70" style={{ color: '#00152F' }}>
              Regístrate en Cotizamin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                Nombre
              </label>
              <input
                name="nombre"
                type="text"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Tu nombre completo"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                RUC
              </label>
              <input
                name="ruc"
                type="text"
                value={form.ruc}
                onChange={handleChange}
                placeholder="12345678901"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#00152F' }}>
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: 'white', color: '#00152F'}}
                required
              />
            </div>
            <GoogleSignInButton />

            {message && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                message.includes('correctamente')
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg active:scale-95"
              style={{ backgroundColor: '#00152F' }}
            >
              Crear Cuenta
            </button>

            <div className="text-center">
              <label className="block text-sm font-medium" style={{ color: '#00152F' }}>
                ¿Ya tienes una cuenta?{' '}
                <a href='/login' className='text-blue-700 hover:text-blue-500 transition-colors'>
                  Inicia Sesión
                </a>
              </label>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-xs sm:text-sm opacity-60" style={{ color: '#00152F' }}>
              © 2025 Cotizamin. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}