-- CreateTable
CREATE TABLE "public"."CotizacionParticipacion" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyecto" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "comentario" TEXT,
    "sugerencia" TEXT,

    CONSTRAINT "CotizacionParticipacion_pkey" PRIMARY KEY ("id")
);
