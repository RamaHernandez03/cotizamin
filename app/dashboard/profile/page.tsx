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
      <h2 className="text-xl font-bold text-yellow-600 mb-4">ACTIVIDAD RECIENTE :</h2>

      <div className="flex justify-between">
        <div className="flex flex-col space-y-2 text-lg">
          <div><strong>Nombre / Razón Social:</strong> {cliente.nombre}</div>
          <div><strong>RUC / Nº Documento:</strong> {cliente.ruc}</div>
          <div><strong>Correo Electrónico De Contacto:</strong> {cliente.email_contacto || cliente.email}</div>
          <div><strong>Correo Electrónico De Inicio:</strong> {cliente.email}</div>
          <div><strong>Teléfono De Contacto:</strong> {cliente.telefono || '—'}</div>
          <div><strong>Dirección / Sede:</strong> {cliente.direccion || '—'}</div>
          <div><strong>País:</strong> {cliente.pais || '—'}</div>
          <div><strong>Certificaciones:</strong> {cliente.certificaciones || '—'}</div>
        </div>

        <img src="/avatar-placeholder.png" alt="Avatar" className="w-24 h-24 rounded-full" />
      </div>

      <div className="mt-6 text-right">
        <a href="/dashboard/profile/edit">
          <button className="bg-[#001d3d] text-yellow-400 px-6 py-2 rounded-full hover:bg-[#003566]">
            EDITAR PERFIL
          </button>
        </a>
      </div>
    </div>
  );
}
