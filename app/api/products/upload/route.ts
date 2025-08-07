import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

// Esta ruta es redundante si ya tienes POST en /api/products
// Puedes mantenerla si prefieres separar las funcionalidades
// o eliminarla y usar solo /api/products para subida

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validar tipo de archivo
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos Excel (.xlsx, .xls)" }, 
        { status: 400 }
      );
    }

    // Leer el archivo directamente
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "El archivo Excel está vacío" }, 
        { status: 400 }
      );
    }

    const now = new Date();
    const clienteId = session.user.id;
    let procesados = 0;

    for (const row of rows) {
      try {
        const producto = {
          where: {
            codigo_interno_proveedor_id: {
              codigo_interno: (row as any)["Código interno"],
              proveedor_id: clienteId,
            },
          },
          create: {
            codigo_interno: (row as any)["Código interno"],
            descripcion: (row as any)["Descripción técnica completa"],
            marca: (row as any)["Marca"] || "",
            modelo: (row as any)["Modelo"] || "",
            material: (row as any)["Material"] || "",
            norma_tecnica: (row as any)["Norma técnica"] || "",
            unidad: (row as any)["Unidad"] || "Unidad",
            stock_actual: parseInt((row as any)["Stock"]) || 0,
            precio_actual: parseFloat((row as any)["Precio (USD)"]) || 0,
            moneda: (row as any)["Moneda"] || "USD",
            tiempo_entrega: (row as any)["Tiempo entrega (días)"] || "",
            ubicacion_stock: (row as any)["Ubicación de stock"] || "",
            estado: (row as any)["Estado"] || "Activo",
            proveedor_id: clienteId,
            fecha_actualizacion: now,
          },
          update: {
            descripcion: (row as any)["Descripción técnica completa"],
            marca: (row as any)["Marca"] || "",
            modelo: (row as any)["Modelo"] || "",
            material: (row as any)["Material"] || "",
            norma_tecnica: (row as any)["Norma técnica"] || "",
            unidad: (row as any)["Unidad"] || "Unidad",
            stock_actual: parseInt((row as any)["Stock"]) || 0,
            precio_actual: parseFloat((row as any)["Precio (USD)"]) || 0,
            moneda: (row as any)["Moneda"] || "USD",
            tiempo_entrega: (row as any)["Tiempo entrega (días)"] || "",
            ubicacion_stock: (row as any)["Ubicación de stock"] || "",
            estado: (row as any)["Estado"] || "Activo",
            fecha_actualizacion: now,
          },
        };

        await prisma.producto.upsert(producto);
        procesados++;
      } catch (productError) {
        console.error("Error processing row:", productError);
      }
    }

    return NextResponse.json({ 
      message: `${procesados} productos procesados correctamente` 
    });

  } catch (error) {
    console.error("Error processing upload:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` }, 
      { status: 500 }
    );
  }
}