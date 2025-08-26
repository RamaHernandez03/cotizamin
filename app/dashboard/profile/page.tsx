'use client';

import { useState, useEffect } from 'react';

export default function ProfileCard() {
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/profile');
      const data = await res.json();
      setCliente(data);
      setLoading(false);
    }
    fetchProfile();
  }, []);

  if (loading) return <div>Cargando perfil...</div>;

  return (
    <div className="bg-white shadow p-6 rounded-xl w-full max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4" style={{color: '#FFBD00'}}>ACTIVIDAD RECIENTE :</h2>

      <div className="flex justify-between">
        <div className="flex flex-col space-y-2 text-lg" style={{color: '#00152F'}}>
          <div><strong>Nombre / Razón Social:</strong> {cliente.nombre}</div>
          <div><strong>RUC / Nº Documento:</strong> {cliente.ruc}</div>
          <div><strong>Correo Electrónico:</strong> {cliente.email}</div>
          <div><strong>Teléfono De Contacto:</strong> {cliente.telefono || '—'}</div>
        </div>

        <img src="/avatar-placeholder.png" alt="Avatar" className="w-24 h-24 rounded-full" />
      </div>

      <div className="mt-6 text-right">
        <a href="/dashboard/profile/edit">
          <button className="bg-[#001d3d] px-6 py-2 rounded-full hover:bg-[#003566]" style={{color: '#FFBD00'}}>
            EDITAR PERFIL
          </button>
        </a>
      </div>
    </div>
  );
}
