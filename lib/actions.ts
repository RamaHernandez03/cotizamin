// lib/actions.ts
'use server';

import prisma from './prisma';


export async function updateUserProfile(
    id_cliente: string,
    data: { nombre: string; telefono: string; ruc: string }
  ) {
    try {
      const updatedUser = await prisma.cliente.update({
        where: { id_cliente },
        data,
      });
      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }
  
