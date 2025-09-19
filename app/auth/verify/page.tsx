// app/auth/verify/page.tsx
export default function VerifyPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams?.status ?? "ok";
  const map: Record<string, { t: string; d: string }> = {
    ok: { t: "¡Email verificado!", d: "Tu cuenta ya está activa. Ya podés iniciar sesión." },
    expired: { t: "Enlace vencido", d: "Solicitá un nuevo correo de verificación." },
    invalid: { t: "Enlace inválido", d: "Revisá el email que te enviamos o registrate otra vez." },
    missing: { t: "Falta el token", d: "Volvé a abrir tu enlace de verificación." },
  };
  const { t, d } = map[status] ?? map.ok;

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4">
      {/* Imagen de fondo con filtro */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/authverif.jpeg')" }}
      />

      {/* Overlay con filtro oscuro */}
      <div className="absolute inset-0 bg-[#00152F]/70 backdrop-blur-sm" />

      {/* Contenido principal */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold text-white">
              {t}
            </h1>
            <p className="text-white/80 leading-relaxed">
              {d}
            </p>
            
            <a
              href="/login"
              className="inline-block w-full rounded-xl bg-gradient-to-r from-[#FFBD00] to-yellow-400 hover:from-yellow-400 hover:to-[#FFBD00] text-[#0A1B2E] font-bold py-3 px-6 transform transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Ir a iniciar sesión
            </a>
          </div>
        </div>
      </div>

      {/* Footer con logo CotizaMin */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 bg-[#00152F]/30 backdrop-blur-sm border-t border-white/10">
        <div className="flex justify-center py-4">
          <div className="text-2xl font-bold">
            <span className="text-white">Cotiza</span>
            <span className="text-[#FFBD00]">Min</span>
          </div>
        </div>
      </footer>
    </main>
  );
}