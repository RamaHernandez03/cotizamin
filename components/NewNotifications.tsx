"use client";
import React from "react";
import { Bell, X } from "lucide-react";
import ModalPortal from "./ModalPortal";
import { useRouter } from "next/navigation";

interface NewNotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewNotification: React.FC<NewNotificationProps> = ({ isOpen, onClose }) => {
  const router = useRouter();

  // ✅ Llamar SIEMPRE el hook; condicionar la lógica adentro

  const handleGoToNotifications = () => {
    router.push("/dashboard/notifications");
    onClose();
  };

  return (
    <ModalPortal>
      {/* Render persistente; el overlay se monta sólo si isOpen */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 h-dvh"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto transform transition-all duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideIn 0.25s ease-out" }}
          >
            <div className="relative px-6 pt-6 pb-4">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#00152F]">
                <Bell size={28} className="text-white animate-pulse" />
              </div>
            </div>

            <div className="px-6 pb-6 text-center">
              <h2 className="text-xl font-bold mb-3 text-[#00152F]">¡Nueva Notificación!</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Tenés nuevas notificaciones en tu centro de notificaciones
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGoToNotifications}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold text-white transition hover:shadow-lg hover:-translate-y-0.5"
                  style={{ backgroundColor: "#FFBD00" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E6A800")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFBD00")}
                >
                  Ver Notificaciones
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold border-2 transition hover:shadow-md hover:-translate-y-0.5"
                  style={{ borderColor: "#00152F", color: "#00152F", backgroundColor: "#efefef" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0e0e0")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#efefef")}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes slideIn {
              from { opacity: 0; transform: scale(0.98) translateY(-6px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </ModalPortal>
  );
};

export default NewNotification;
