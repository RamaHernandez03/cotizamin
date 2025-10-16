import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // 👈 Importá Providers
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cotizamin | Plataforma Inteligente de Cotizaciones y Precios",
  description:
    "Cotizamin es una plataforma B2B que permite comparar precios, gestionar stock y obtener recomendaciones inteligentes para optimizar tus cotizaciones y compras industriales.",
  keywords: [
    "cotizaciones online",
    "comparador de precios",
    "proveedores industriales",
    "gestión de stock",
    "inteligencia artificial",
    "Cotizamin",
  ],
  authors: [{ name: "Ramiro Hernandez", url: "https://ramiro-hernandez.netlify.app" }],
  creator: "Ramiro Hernandez",
  openGraph: {
    title: "Cotizamin | Plataforma Inteligente de Cotizaciones y Precios para proveedores",
    description:
      "Optimiza tus cotizaciones industriales con IA: compara precios, gestiona proveedores y mejora tus márgenes con Cotizamin.",
    url: "https://cotizamin.vercel.app", // ✅ tu dominio si ya lo tenés
    siteName: "Cotizamin",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "https://cotizamin.vercel.app/public/images/logo.png", // ✅ reemplazalo por tu imagen OG real
        width: 1200,
        height: 630,
        alt: "Cotizamin - Cotizaciones Inteligentes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cotizamin | Plataforma Inteligente de Cotizaciones",
    description:
      "Compará precios, gestioná stock y optimizá tus compras con IA. Probá Cotizamin.",
    creator: "@RamaHernandez03", // o tu handle real
    images: ["https://cotizamin.vercel.app/public/images/logo.png"],
  },
  metadataBase: new URL("https://cotizamin.vercel.app"),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://cotizamin.vercel.app",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers> {/* 👈 Ahora sí envolvemos con SessionProvider */}
          {children}
          <SpeedInsights /> {/* 👈 acá se agrega */}
        </Providers>
      </body>
    </html>
  );
}
