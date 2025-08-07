import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH - Actualizar un producto específico
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    // Verificar que el producto pertenece al usuario
    const existingProduct = await prisma.producto.findFirst({
      where: {
        id_producto: id,
        proveedor_id: session.user.id,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Producto no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Actualizar solo los campos permitidos
    const updateData: any = {
      fecha_actualizacion: new Date(),
    };

    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
    if (body.marca !== undefined) updateData.marca = body.marca;
    if (body.modelo !== undefined) updateData.modelo = body.modelo;
    if (body.material !== undefined) updateData.material = body.material;
    if (body.norma_tecnica !== undefined) updateData.norma_tecnica = body.norma_tecnica;
    if (body.unidad !== undefined) updateData.unidad = body.unidad;
    if (body.stock_actual !== undefined) updateData.stock_actual = parseInt(body.stock_actual) || 0;
    if (body.precio_actual !== undefined) updateData.precio_actual = parseFloat(body.precio_actual) || 0;
    if (body.moneda !== undefined) updateData.moneda = body.moneda;
    if (body.tiempo_entrega !== undefined) updateData.tiempo_entrega = body.tiempo_entrega;
    if (body.ubicacion_stock !== undefined) updateData.ubicacion_stock = body.ubicacion_stock;
    if (body.estado !== undefined) updateData.estado = body.estado;

    const updatedProduct = await prisma.producto.update({
      where: { id_producto: id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Producto actualizado correctamente",
      producto: updatedProduct,
    });

  } catch (error) {
    console.error("Error updating product:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un producto específico
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verificar que el producto pertenece al usuario
    const existingProduct = await prisma.producto.findFirst({
      where: {
        id_producto: id,
        proveedor_id: session.user.id,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Producto no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    await prisma.producto.delete({
      where: { id_producto: id },
    });

    return NextResponse.json({
      message: "Producto eliminado correctamente",
    });

  } catch (error) {
    console.error("Error deleting product:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// GET - Obtener un producto específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const producto = await prisma.producto.findFirst({
      where: {
        id_producto: id,
        proveedor_id: session.user.id,
      },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(producto);

  } catch (error) {
    console.error("Error fetching product:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` },
      { status: 500 }
    );
  }
}