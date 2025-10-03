"use client";

import { Loader2 } from "lucide-react";

export default function LoadingSales() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFBD00]" />
        <p className="text-[#00152F] font-medium">Cargando ventas...</p>
      </div>
    </div>
  );
}
