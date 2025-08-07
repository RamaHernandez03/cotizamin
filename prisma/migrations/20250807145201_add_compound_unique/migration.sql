/*
  Warnings:

  - A unique constraint covering the columns `[codigo_interno,proveedor_id]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_interno_proveedor_id_key" ON "public"."Producto"("codigo_interno", "proveedor_id");
