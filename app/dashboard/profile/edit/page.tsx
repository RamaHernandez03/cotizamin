'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserProfile } from '@/lib/actions';
import {
  ArrowLeft, Save, Loader2, User, Phone, Mail, IdCard, ShieldAlert, CheckCircle2
} from 'lucide-react';

type FormState = {
  nombre: string;
  telefono: string;
  email: string;
  ruc: string;
};

export default function EditProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [formData, setFormData] = useState<FormState>({
    nombre: '',
    telefono: '',
    email: '',
    ruc: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      const { nombre, telefono, email, ruc } = session.user as any;
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

    // Evitar edición de RUC explícitamente
    if (name === 'ruc') return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    if (!formData.nombre.trim()) return 'El nombre es obligatorio.';
    if (formData.telefono && formData.telefono.length < 6) return 'El teléfono parece demasiado corto.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    const validation = validate();
    if (validation) {
      setErrorMsg(validation);
      setSuccessMsg(null);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // Solo actualizamos campos editables
      await updateUserProfile(session.user.id, {
        nombre: formData.nombre,
        telefono: formData.telefono,
        ruc: formData.ruc,
      });

      setSuccessMsg('¡Perfil actualizado correctamente!');
      // Pequeño delay para que el usuario vea el estado y luego volver
      setTimeout(() => router.push('/dashboard/profile'), 700);
    } catch (err: any) {
      setErrorMsg('No se pudieron guardar los cambios. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFBD00]" />
          <p className="text-[#00152F] font-medium">Cargando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb / Back */}
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[#00152F] hover:opacity-80 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>

        {/* Header */}
        <div className="rounded-3xl overflow-hidden shadow-xl border border-slate-200/60">
          <div className="bg-gradient-to-r from-[#00152F] to-[#001d3d] p-6 lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Editar Perfil</h1>
            <p className="text-slate-300 mt-1">Actualiza tus datos de contacto y nombre.</p>
          </div>

          {/* Alerts */}
          {(errorMsg || successMsg) && (
            <div className="px-6 lg:px-8 pt-6">
              {errorMsg && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <div className="mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Hubo un problema</p>
                    <p className="text-sm">{errorMsg}</p>
                  </div>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
                  <div className="mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Cambios guardados</p>
                    <p className="text-sm">{successMsg}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 lg:p-8">
            <div className="grid gap-6">
              {/* Nombre */}
              <div>
                <label className="block mb-2 text-sm font-medium text-[#00152F]">Nombre</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-12 text-[#00152F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-200/60 focus:border-amber-300 transition"
                    placeholder="Nombre o Razón Social"
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block mb-2 text-sm font-medium text-[#00152F]">Teléfono</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Phone className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-12 text-[#00152F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-200/60 focus:border-amber-300 transition"
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Incluí código de país si es posible.</p>
              </div>

              {/* Email (bloqueado) */}
              <div>
                <label className="block mb-2 text-sm font-medium text-[#00152F]">Email (no editable)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-3 pr-4 pl-12 text-slate-500"
                  />
                </div>
              </div>

              {/* RUC (bloqueado) */}
              <div>
                <label className="block mb-2 text-sm font-medium text-[#00152F]">RUC (no editable)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <IdCard className="w-5 h-5 text-slate-400" />
                  </div>
<input
  name="ruc"
  value={formData.ruc}
  readOnly
  className="w-full rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
/>
                </div>
                <p className="text-xs text-slate-500 mt-1">
  El RUC no puede modificarse. Si necesitás corregirlo, contactá soporte.
</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard/profile')}
                className="w-full sm:w-auto rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-[#00152F] hover:bg-slate-50 transition"
                disabled={submitting}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00152F] to-[#001d3d] px-6 py-3 font-bold text-[#FFBD00] hover:shadow-lg hover:scale-[1.02] active:scale-[0.99] transition disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
