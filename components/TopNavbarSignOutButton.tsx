"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export default function SignOutButton() {
  const [showModal, setShowModal] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login", redirect: true });
  };

  return (
    <>
      {/* Botón principal */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-white hover:bg-gray-50 text-[#00152F] border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
          />
        </svg>
        Cerrar Sesión
      </button>

      {/* Modal de confirmación */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            {/* Icono de advertencia */}
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-[#FFBD00] bg-opacity-20 rounded-full">
              <svg 
                className="w-6 h-6 text-[#FFBD00]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.732-.833-2.5 0L5.314 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>

            {/* Contenido del modal */}
            <h3 className="text-lg font-semibold text-[#00152F] text-center mb-2">
              Confirmar cierre de sesión
            </h3>
            <p className="text-gray-600 text-center mb-6">
              ¿Estás seguro que deseas cerrar tu sesión? Tendrás que iniciar sesión nuevamente para acceder al sistema.
            </p>

            {/* Botones */}
            <div className="flex gap-3">
              {/* Botón Cancelar */}
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-[#00152F] bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
              >
                Cancelar
              </button>
              
              {/* Botón Confirmar */}
              <button
                onClick={handleSignOut}
                className="flex-1 px-4 py-2 bg-[#00152F] text-white rounded-lg font-medium hover:bg-[#001a3d] transition-colors duration-200"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}