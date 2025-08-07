import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Productos");

  // Agregar encabezados para productos
  worksheet.columns = [
    { header: "Código interno", key: "codigo_interno", width: 20 },
    { header: "Descripción técnica completa", key: "descripcion", width: 40 },
    { header: "Marca", key: "marca", width: 20 },
    { header: "Modelo", key: "modelo", width: 20 },
    { header: "Material", key: "material", width: 20 },
    { header: "Norma técnica", key: "norma_tecnica", width: 20 },
    { header: "Unidad", key: "unidad", width: 15 },
    { header: "Stock", key: "stock", width: 15 },
    { header: "Precio (USD)", key: "precio", width: 15 },
    { header: "Moneda", key: "moneda", width: 10 },
    { header: "Tiempo entrega (días)", key: "tiempo_entrega", width: 20 },
    { header: "Ubicación de stock", key: "ubicacion_stock", width: 25 },
    { header: "Estado", key: "estado", width: 15 },
  ];

  // Agregar filas de ejemplo
  worksheet.addRow({
    codigo_interno: "PROD001",
    descripcion: "Tornillo hexagonal acero inoxidable",
    marca: "ACME",
    modelo: "HEX-001",
    material: "Acero Inoxidable 316",
    norma_tecnica: "ISO 4762",
    unidad: "Unidad",
    stock: 100,
    precio: 2.50,
    moneda: "USD",
    tiempo_entrega: "5-7",
    ubicacion_stock: "Estante A1",
    estado: "Activo"
  });

  worksheet.addRow({
    codigo_interno: "PROD002",
    descripcion: "Arandela plana de acero",
    marca: "STANDARD",
    modelo: "WAS-001",
    material: "Acero al carbono",
    norma_tecnica: "DIN 125",
    unidad: "Unidad",
    stock: 500,
    precio: 0.15,
    moneda: "USD",
    tiempo_entrega: "3-5",
    ubicacion_stock: "Estante B2",
    estado: "Activo"
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=productos-template.xlsx",
    },
  });
}