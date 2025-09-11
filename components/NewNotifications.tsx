import React from 'react';
import { Bell, X } from 'lucide-react';

interface NewNotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewNotification: React.FC<NewNotificationProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleGoToNotifications = () => {
    window.location.href = '/dashboard/notifications/page.tsx';
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal Container */}
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto transform transition-all duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: isOpen ? 'slideIn 0.3s ease-out' : 'slideOut 0.3s ease-in'
          }}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <X size={20} className="text-gray-500" />
            </button>
            
            {/* Icon */}
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#00152F' }}
            >
              <Bell size={28} className="text-white animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 text-center">
            <h2 
              className="text-xl font-bold mb-3"
              style={{ color: '#00152F' }}
            >
              ¡Nueva Notificación!
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Tenés nuevas notificaciones en tu centro de notificaciones
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGoToNotifications}
                className="flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ backgroundColor: '#FFBD00' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E6A800';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFBD00';
                }}
              >
                Ver Notificaciones
              </button>
              
              <button
                onClick={onClose}
                className="flex-1 py-3 px-6 rounded-xl font-semibold border-2 transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ 
                  borderColor: '#00152F',
                  color: '#00152F',
                  backgroundColor: '#efefef'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#efefef';
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
        }
      `}</style>
    </>
  );
};

export default NewNotification;