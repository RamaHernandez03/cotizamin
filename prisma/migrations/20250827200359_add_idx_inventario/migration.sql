-- DropForeignKey
ALTER TABLE "public"."Producto" DROP CONSTRAINT "Producto_proveedor_id_fkey";

-- AlterTable
ALTER TABLE "public"."Producto" ALTER COLUMN "precio_actual" SET DEFAULT 0,
ALTER COLUMN "stock_actual" SET DEFAULT 0,
ALTER COLUMN "estado" SET DEFAULT 'Activo',
ALTER COLUMN "fecha_actualizacion" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "marca" DROP NOT NULL,
ALTER COLUMN "material" DROP NOT NULL,
ALTER COLUMN "modelo" DROP NOT NULL,
ALTER COLUMN "moneda" SET DEFAULT 'USD',
ALTER COLUMN "norma_tecnica" DROP NOT NULL,
ALTER COLUMN "tiempo_entrega" DROP NOT NULL,
ALTER COLUMN "ubicacion_stock" DROP NOT NULL,
ALTER COLUMN "unidad" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_proveedor_fecha" ON "public"."Producto"("proveedor_id", "fecha_actualizacion");

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."Cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;
