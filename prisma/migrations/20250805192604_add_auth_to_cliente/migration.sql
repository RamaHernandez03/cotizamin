-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id_cliente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "public"."Producto" (
    "id_producto" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "precio_actual" DOUBLE PRECISION NOT NULL,
    "stock_actual" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_ruc_key" ON "public"."Cliente"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_email_key" ON "public"."Cliente"("email");

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."Cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
