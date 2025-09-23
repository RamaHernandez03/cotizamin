"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidRuc11(ruc: string) {
  return /^\d{11}$/.test(ruc);
}

export default function AuthForm() {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", ruc: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    if (name === "ruc") {
      // solo dígitos, max 11
      value = value.replace(/\D/g, "").slice(0, 11);
    }
    setForm((f) => ({ ...f, [name]: value }));
    setMessage("");
  };

  const resendVerification = async () => {
    setResent(null);
    try {
      const r = await fetch("/api/register/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const j = await r.json();
      setResent(j.message || "Si el email existe, te enviamos un enlace de verificación.");
    } catch {
      setResent("No pudimos reenviar el correo. Probá de nuevo en unos minutos.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setResent(null);

    // validaciones rápidas en cliente
    if (form.nombre.trim().length < 2) return setMessage("El nombre es muy corto.");
    if (!isValidEmail(form.email)) return setMessage("Email inválido.");
    if (form.password.length < 8) return setMessage("La contraseña debe tener al menos 8 caracteres.");
    if (!isValidRuc11(form.ruc)) return setMessage("RUC inválido: deben ser 11 dígitos.");

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        // si el backend está configurado para reenviar cuando ya existe sin verificar
        // puede venir un 200; si viene error, lo mostramos:
        setMessage(data.error || "Error al registrar usuario");
        return;
      }

      // ✅ nuevo flujo: SIN auto-login. Pedimos verificación por email.
      setMessage(
        data.message ||
          "¡Listo! Te enviamos un correo para confirmar tu cuenta. Revisá tu inbox y spam."
      );

      // opcional: redirigir a una página que explica el paso siguiente
      // router.push("/auth/verify?status=sent");
    } catch (err) {
      setMessage("Error inesperado al registrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* Izquierda (solo desktop) */}
      <div className="hidden lg:block lg:w-3/5 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-blue-900"
          style={{
            backgroundImage: `linear-gradient(135deg, #00152F 0%, #0f172a 30%, #1e3a8a 70%, #1e40af 100%),
                            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundBlendMode: "overlay",
          }}
        >
          <div className="absolute top-20 left-20 w-32 h-32 bg-white opacity-5 rounded-full animate-pulse" />
          <div
            className="absolute bottom-32 right-32 w-24 h-24 bg-white opacity-10 rotate-45 animate-bounce"
            style={{ animationDuration: "3s" }}
          />
          <div
            className="absolute top-1/2 left-1/4 w-16 h-16 border-2 border-white opacity-20 rounded-lg animate-spin"
            style={{ animationDuration: "8s" }}
          />
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-12">
            <div className="text-center max-w-lg">
              <h1 className="text-4xl xl:text-6xl font-bold mb-6 tracking-tight">
                <span style={{ color: "#efefef" }}>Cotiza</span>
                <span style={{ color: "#FFBD00" }}>min</span>
              </h1>
              <p className="text-lg xl:text-xl opacity-90 leading-relaxed mb-8">
                Únete a la plataforma líder de gestión de productos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header mobile */}
      <div className="lg:hidden bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-8 text-white text-center">
        <h1 className="text-3xl font-bold mb-2">
          <span style={{ color: "#efefef" }}>Cotiza</span>
          <span style={{ color: "#FFBD00" }}>min</span>
        </h1>
        <p className="text-sm opacity-90">Gestiona tus cotizaciones y productos</p>
      </div>

      {/* Derecha: form */}
      <div className="flex-1 lg:w-2/5 flex flex-col" style={{ backgroundColor: "#efefef" }}>
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: "#00152F" }}>
              Crear Cuenta
            </h2>
            <p className="text-sm opacity-70" style={{ color: "#00152F" }}>
              Regístrate en Cotizamin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#00152F" }}>
                Nombre
              </label>
              <input
                name="nombre"
                type="text"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Tu nombre completo"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: "white", color: "#00152F" }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#00152F" }}>
                RUC
              </label>
              <input
                name="ruc"
                type="text"
                inputMode="numeric"
                pattern="\d{11}"
                maxLength={11}
                value={form.ruc}
                onChange={handleChange}
                placeholder="12345678901"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: "white", color: "#00152F" }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#00152F" }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: "white", color: "#00152F" }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#00152F" }}>
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                style={{ backgroundColor: "white", color: "#00152F" }}
                required
                minLength={8}
              />
            </div>

            <GoogleSignInButton />

            {message && (
              <div
                className={`px-4 py-3 rounded-lg text-sm ${
                  /listo|enviamos|confirmar/i.test(message)
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            {/* Reenviar verificación */}
            {!!form.email && (
              <button
                type="button"
                onClick={resendVerification}
                className="text-sm underline text-blue-700 hover:text-blue-500"
              >
                ¿No te llegó el correo? Reenviar verificación
              </button>
            )}
            {resent && <p className="text-xs text-gray-700">{resent}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: "#00152F" }}
            >
              {loading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>

            <div className="text-center">
              <label className="block text-sm font-medium" style={{ color: "#00152F" }}>
                ¿Ya tienes una cuenta?{" "}
                <a href="/login" className="text-blue-700 hover:text-blue-500 transition-colors">
                  Inicia Sesión
                </a>
              </label>
            </div>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-xs sm:text-sm opacity-60" style={{ color: "#00152F" }}>
              © 2025 Cotizamin. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
