// api/products/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client"; // 👈 importa Prisma para los tipos
import { getInventoryTag } from "@/lib/inventoryTag";
// REDIS OPCIONAL
// import { redis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const proveedorId = (session.user as any).id ?? (session.user as any).id_cliente ?? session.user.id;
    const { searchParams } = new URL(req.url);
    const take = Math.min(parseInt(searchParams.get("take") || "50"), 200);
    const cursor = searchParams.get("cursor"); // id_producto

    // ETag del estado global del inventario del usuario
    const etag = await getInventoryTag(proveedorId);
    const ifNoneMatch = req.headers.get("if-none-match");
    // REDIS OPCIONAL: devolvé 304 si el tag coincide
    // if (ifNoneMatch === etag) {
    //   return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    // }

    // REDIS OPCIONAL: intentá servir cache por página
    // const cacheKey = `inv:${proveedorId}:take=${take}:cursor=${cursor ?? "0"}`;
    // if (ifNoneMatch === etag) {
    //   const cached = await redis.get<string>(cacheKey);
    //   if (cached) return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    // }
    // const cached = await redis.get<string>(cacheKey);
    // if (cached) {
    //   return new NextResponse(cached, { status: 200, headers: { "Content-Type": "application/json", ETag: etag } });
    // }

    const args: Prisma.ProductoFindManyArgs = {
      where: { proveedor_id: proveedorId },
      orderBy: { fecha_actualizacion: "desc" },
      select: {
        id_producto: true,
        codigo_interno: true,
        descripcion: true,
        marca: true,
        modelo: true,
        material: true,
        unidad: true,
        stock_actual: true,
        precio_actual: true,
        moneda: true,
        tiempo_entrega: true,
        estado: true,
        fecha_actualizacion: true,
      },
      take: take + 1,
    };

    if (cursor) {
      args.cursor = { id_producto: cursor };
      args.skip = 1;
    }

    const productos = await prisma.producto.findMany(args);

    const hasMore = productos.length > take;
    const items = hasMore ? productos.slice(0, take) : productos;
    const nextCursor = hasMore ? items[items.length - 1].id_producto : null;

    const body = JSON.stringify({ items, nextCursor });

    // REDIS OPCIONAL:
    // await redis.set(cacheKey, body, { ex: 60 });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag, // el cliente puede mandar If-None-Match la próxima
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}



// POST - Subir productos desde Excel
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

    // Leer el archivo directamente sin guardarlo en disco
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Procesar el Excel
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
    let errores = [];

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row: any = rows[i];
      
      try {
        // Validar campos requeridos
        if (!row["Código interno"] || !row["Descripción técnica completa"]) {
          errores.push(`Fila ${i + 2}: Código interno y Descripción son requeridos`);
          continue;
        }

        const producto = {
          where: {
            codigo_interno_proveedor_id: {
              codigo_interno: row["Código interno"],
              proveedor_id: clienteId,
            },
          },
          create: {
            codigo_interno: row["Código interno"],
            descripcion: row["Descripción técnica completa"],
            marca: row["Marca"] || "",
            modelo: row["Modelo"] || "",
            material: row["Material"] || "",
            norma_tecnica: row["Norma técnica"] || "",
            unidad: row["Unidad"] || "Unidad",
            stock_actual: parseInt(row["Stock"]) || 0,
            precio_actual: parseFloat(row["Precio (USD)"]) || 0,
            moneda: row["Moneda"] || "USD",
            tiempo_entrega: row["Tiempo entrega (días)"] || "",
            ubicacion_stock: row["Ubicación de stock"] || "",
            estado: row["Estado"] || "Activo",
            proveedor_id: clienteId,
            fecha_actualizacion: now,
          },
          update: {
            descripcion: row["Descripción técnica completa"],
            marca: row["Marca"] || "",
            modelo: row["Modelo"] || "",
            material: row["Material"] || "",
            norma_tecnica: row["Norma técnica"] || "",
            unidad: row["Unidad"] || "Unidad",
            stock_actual: parseInt(row["Stock"]) || 0,
            precio_actual: parseFloat(row["Precio (USD)"]) || 0,
            moneda: row["Moneda"] || "USD",
            tiempo_entrega: row["Tiempo entrega (días)"] || "",
            ubicacion_stock: row["Ubicación de stock"] || "",
            estado: row["Estado"] || "Activo",
            fecha_actualizacion: now,
          },
        };

        await prisma.producto.upsert(producto);
        procesados++;
      } catch (productError) {
        const errorMessage = productError instanceof Error ? productError.message : 'Error desconocido';
        errores.push(`Fila ${i + 2}: Error al procesar - ${errorMessage}`);
      }
    }

    return NextResponse.json({
      message: `Procesamiento completado. ${procesados} productos actualizados.`,
      procesados,
      errores: errores.length > 0 ? errores : undefined,
    });

  } catch (error) {
    console.error("Error processing file:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` }, 
      { status: 500 }
    );
  }
}