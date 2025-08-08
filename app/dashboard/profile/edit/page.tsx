'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserProfile } from '@/lib/actions';

export default function EditProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    ruc: '',
  });

  useEffect(() => {
    if (session?.user) {
      const { nombre, apellido, telefono, email, ruc } = session.user as any;
      setFormData({
        nombre: nombre || '',
        telefono: telefono || '',
        email: email || '',
        ruc: ruc || '',
      });
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) return;

    await updateUserProfile(session.user.id, {
      nombre: formData.nombre,
      telefono: formData.telefono,
      ruc: formData.ruc,
    });
    router.push('/dashboard/profile');
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6" style={{color: '#00152F'}}>Editar Perfil</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium" style={{color: '#00152F'}}>Nombre</label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            style={{color: '#00152F'}}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium" style={{color: '#00152F'}}>Teléfono</label>
          <input
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            style={{color: '#00152F'}}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium" style={{color: '#00152F'}}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            style={{color: '#00152F'}}
            disabled
            className="w-full bg-gray-100 border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium" style={{color: '#00152F'}}>RUC</label>
          <input
            type="text"
            name="ruc"
            value={formData.ruc}
            onChange={handleChange}
            style={{color: '#00152F'}}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          style={{background: '#00152F'}}
          className="text-white px-4 py-2 mt-4 rounded hover:bg-blue-700"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
}
