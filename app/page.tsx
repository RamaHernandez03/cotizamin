// app/dashboard/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Cotizamin",
  description: "Tu sistema de gestión de confianza",
};

export default function DashboardIndex() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#00152F] text-[#efefef] flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-20 h-16 bg-[#00152F] shadow-md">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4">
          <Link href="/" className="text-xl md:text-2xl font-bold">
            <span className="text-white">Cotiza</span>
            <span className="text-[#FFBD00]">Min</span>
          </Link>
        </div>
      </header>

      {/* HERO con VIDEO */}
      <section className="relative flex-1">
        <div className="h-[calc(100vh-4rem-4rem)] w-full relative overflow-hidden">
          {/* Video de fondo */}
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/videos/video.mp4" type="video/mp4" />
          </video>

          {/* Película negra semi-transparente */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Contenido centrado */}
          <div className="relative z-10 flex h-full w-full items-center justify-center">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <p className="mb-2 text-xs md:text-sm uppercase tracking-[0.2em] text-[#FFBD00]">
                Bienvenido a Cotizamin
              </p>
              <h2 className="mb-4 text-3xl md:text-4xl font-semibold leading-tight">
                Tu sistema de gestión de confianza
              </h2>

              {/* Botón Ingresar */}
              <div className="mt-7">
                <Link
                  href="/login"
                  className="inline-block rounded-xl bg-[#FFBD00] px-6 py-3 md:px-8 md:py-3 text-sm md:text-base font-semibold text-[#00152F] transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#FFBD00]/40"
                >
                  Ingresar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER TRANSPARENTE */}
      <footer className="h-16 bg-transparent text-[#efefef] flex items-center justify-center text-xs md:text-sm px-4 relative z-10">
        Cotizamin — todos los derechos reservados © {year}
      </footer>
    </main>
  );
}
