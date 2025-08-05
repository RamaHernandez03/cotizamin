'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', ruc: '', name: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(form),
    })

    if (res.ok) router.push('/login')
    else alert('Error al registrar')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-4">Registro de Proveedor</h1>
      <input name="name" type="text" placeholder="Nombre" onChange={handleChange} className="input mb-2 w-full" />
      <input name="email" type="email" placeholder="Email" onChange={handleChange} className="input mb-2 w-full" />
      <input name="ruc" type="text" placeholder="RUC" onChange={handleChange} className="input mb-2 w-full" />
      <input name="password" type="password" placeholder="Contraseña" onChange={handleChange} className="input mb-4 w-full" />
      <button type="submit" className="btn w-full bg-blue-600 text-white py-2 rounded">Registrarse</button>
    </form>
  )
}
