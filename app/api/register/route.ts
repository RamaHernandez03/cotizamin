// app/api/register/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hash } from 'bcrypt'

export async function POST(req: Request) {
  const { email, password, ruc, name } = await req.json()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Usuario ya existe' }, { status: 400 })

  const hashed = await hash(password, 10)

  const user = await prisma.user.create({
    data: { email, password: hashed, ruc, name },
  })

  return NextResponse.json({ user })
}
