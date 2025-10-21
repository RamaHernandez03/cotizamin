'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { User, Mail, Phone, FileText, Edit3, Loader2, AlertCircle } from 'lucide-react';

type Cliente = {
  nombre: string;
  ruc: string;
  email: string;
  telefono?: string | null;
  avatarUrl?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return { data: null };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { data: null, raw: text };
  }
}

export default function ProfileCard() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const { data } = await safeJson(res);
        if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
        setCliente(data as Cliente);
      } catch {
        setErrorMsg('No se pudo cargar el perfil. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // Limpia el preview para no filtrar memoria
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('El archivo debe ser una imagen.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB.');
      e.target.value = '';
      return;
    }

    // Preview optimista
    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return nextPreview;
    });

    const fd = new FormData();
    fd.append('file', file);

    try {
      setUploading(true);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
      const { data, raw } = await safeJson(res);
      if (!res.ok) {
        const msg = (data as any)?.error || raw || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      // Actualiza estado sin recargar
      setCliente((prev) => (prev ? { ...prev, avatarUrl: (data as any)?.url } : prev));
    } catch (err: any) {
      alert(err?.message || 'No se pudo subir la imagen.');
      // revertir preview si falló
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFBD00]" />
          <p className="text-[#00152F] font-medium">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[#00152F] font-semibold">Ups…</p>
          <p className="text-slate-600">{errorMsg}</p>
          <button
            onClick={() => location.reload()}
            className="bg-gradient-to-r from-[#00152F] to-[#001d3d] text-[#FFBD00] px-6 py-3 rounded-2xl font-bold hover:shadow-lg hover:scale-105 transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  const profileFields = [
    { icon: User, label: 'Nombre / Razón Social', value: cliente.nombre },
    { icon: FileText, label: 'RUC / Nº Documento', value: cliente.ruc },
    { icon: Mail, label: 'Correo Electrónico', value: cliente.email },
    { icon: Phone, label: 'Teléfono De Contacto', value: cliente.telefono || '—' },
  ] as const;

  const firstTwoNames = (() => {
    const parts = (cliente.nombre || '').trim().split(/\s+/);
    return parts.slice(0, 2).join(' ') || cliente.nombre || 'Cliente';
  })();

  const isEmpresa = /SRL|S\.A\.|SA|SAS|LLC|INC/i.test(cliente.nombre || '');
  const avatarSrc = previewUrl || cliente.avatarUrl || '/images/avatar-default.png';

  return (
    <div className="min-h-screen bg-white p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center lg:text-left">
          <h1 className="text-2xl lg:text-3xl font-bold text-[#00152F] mb-2">Mi Perfil</h1>
          <div className="flex items-center justify-center lg:justify-start space-x-2">
            <div className="w-2 h-2 bg-[#FFBD00] rounded-full" />
            <p className="text-[#FFBD00] font-semibold tracking-wide text-sm uppercase">
              Actividad Reciente
            </p>
          </div>
        </div>

        {/* Main Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-[#00152F] to-[#001d3d] p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar + icono editar + anillo animado */}
              <div className="relative group">
                {/* Anillo animado (aparece al hover o subiendo) */}
                <div
                  className={`
                    pointer-events-none absolute -inset-1 rounded-full border-2 border-amber-400/80 border-dashed
                    transition-opacity ${uploading ? 'opacity-100 animate-spin' : 'opacity-0 group-hover:opacity-100'}
                  `}
                  style={{ animationDuration: '6s' }}
                />
                {/* Imagen */}
                <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-full overflow-hidden shadow-xl ring-2 ring-white/30">
                  <Image
                    src={avatarSrc}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    priority
                  />
                  {/* overlay sutil */}
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Botón flotante (lápiz) */}
                <button
                  type="button"
                  onClick={pickFile}
                  title="Editar foto de perfil"
                  aria-label="Editar foto de perfil"
                  className="
                    absolute -bottom-1 -right-1 h-8 w-8 grid place-items-center
                    rounded-full bg-white text-[#00152F] shadow-lg
                    ring-1 ring-black/5 hover:shadow-xl transition
                  "
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                </button>

                {/* input oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">{firstTwoNames}</h2>
                <p className="text-slate-300 text-sm lg:text-base">
                  {isEmpresa ? 'Empresa' : 'Cliente Premium'}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 lg:p-8">
            <div className="grid gap-6">
              {profileFields.map((field, idx) => {
                const Icon = field.icon;
                return (
                  <div key={idx} className="group">
                    <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all duration-300">
                      <div className="w-12 h-12 rounded-xl bg-[#FFBD00]/10 flex items-center justify-center group-hover:bg-[#FFBD00]/20 transition-colors">
                        <Icon className="w-5 h-5 text-[#00152F]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-500 mb-1">{field.label}</p>
                        <p className="text-base lg:text-lg font-semibold text-[#00152F] break-all">
                          {field.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón Editar */}
            <div className="mt-8 flex justify-center sm:justify-end">
              <a href="/dashboard/profile/edit" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto bg-gradient-to-r from-[#00152F] to-[#001d3d] text-[#FFBD00] px-8 py-4 rounded-2xl font-bold text-sm lg:text-base hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 group">
                  <Edit3 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span>EDITAR PERFIL</span>
                </button>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
