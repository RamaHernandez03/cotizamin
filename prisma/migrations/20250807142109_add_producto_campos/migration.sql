/*
  Warnings:

  - You are about to drop the column `nombre` on the `Producto` table. All the data in the column will be lost.
  - Added the required column `codigo_interno` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descripcion` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marca` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `material` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modelo` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moneda` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `norma_tecnica` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tiempo_entrega` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ubicacion_stock` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unidad` to the `Producto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Producto" DROP COLUMN "nombre",
ADD COLUMN     "codigo_interno" TEXT NOT NULL,
ADD COLUMN     "descripcion" TEXT NOT NULL,
ADD COLUMN     "marca" TEXT NOT NULL,
ADD COLUMN     "material" TEXT NOT NULL,
ADD COLUMN     "modelo" TEXT NOT NULL,
ADD COLUMN     "moneda" TEXT NOT NULL,
ADD COLUMN     "norma_tecnica" TEXT NOT NULL,
ADD COLUMN     "tiempo_entrega" TEXT NOT NULL,
ADD COLUMN     "ubicacion_stock" TEXT NOT NULL,
ADD COLUMN     "unidad" TEXT NOT NULL;
