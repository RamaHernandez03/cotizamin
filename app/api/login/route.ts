// app/api/login/route.ts
import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({ where: { email } })

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const passwordMatch = await compare(password, cliente.password)

  if (!passwordMatch) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  // Login exitoso
  return NextResponse.json({
    success: true,
    cliente: {
      id: cliente.id_cliente,
      nombre: cliente.nombre,
      email: cliente.email,
      ruc: cliente.ruc,
    }
  })
}
