-- CreateTable
CREATE TABLE "public"."QuoteMetricsDaily" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total_participaciones" INTEGER NOT NULL,
    "pct_respuesta_tiempo" INTEGER NOT NULL,
    "pct_aceptacion" INTEGER NOT NULL,
    "promedio_calificacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tiempo_prom_entrega_dias" INTEGER NOT NULL DEFAULT 0,
    "pendientes_evaluacion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteMetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteSuggestion" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT NOT NULL,
    "fuente" TEXT,
    "ref_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DemandAlert" (
    "id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "filtro" TEXT NOT NULL,
    "comentario" TEXT,
    "sugerencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "owner_id" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteMetricsDaily_proveedor_id_fecha_idx" ON "public"."QuoteMetricsDaily"("proveedor_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteMetricsDaily_proveedor_id_fecha_key" ON "public"."QuoteMetricsDaily"("proveedor_id", "fecha");

-- CreateIndex
CREATE INDEX "QuoteSuggestion_proveedor_id_fecha_idx" ON "public"."QuoteSuggestion"("proveedor_id", "fecha");

-- CreateIndex
CREATE INDEX "DemandAlert_proveedor_id_fecha_idx" ON "public"."DemandAlert"("proveedor_id", "fecha");

-- CreateIndex
CREATE INDEX "cotip_part_idx_prov_fecha" ON "public"."CotizacionParticipacion"("proveedor_id", "fecha");
