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
    apellido: '',
    telefono: '',
    email: '',
    ruc: '',
  });

  useEffect(() => {
    if (session?.user) {
      const { nombre, apellido, telefono, email, ruc } = session.user as any;
      setFormData({
        nombre: nombre || '',
        apellido: apellido || '',
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
      apellido: formData.apellido,
      telefono: formData.telefono,
      ruc: formData.ruc,
    });
    router.push('/dashboard/profile');
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-6">Editar Perfil</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Nombre</label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Apellido</label>
          <input
            type="text"
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Teléfono</label>
          <input
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            disabled
            className="w-full bg-gray-100 border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">RUC</label>
          <input
            type="text"
            name="ruc"
            value={formData.ruc}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
}
