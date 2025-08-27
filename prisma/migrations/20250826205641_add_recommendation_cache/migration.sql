-- CreateTable
CREATE TABLE "public"."RecommendationBatch" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "fecha_analisis" TIMESTAMP(3),
    "nota_general" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecommendationItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "producto" TEXT,
    "prioridad" TEXT NOT NULL,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationBatch_cliente_id_createdAt_idx" ON "public"."RecommendationBatch"("cliente_id", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationItem_batchId_idx" ON "public"."RecommendationItem"("batchId");

-- AddForeignKey
ALTER TABLE "public"."RecommendationItem" ADD CONSTRAINT "RecommendationItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."RecommendationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
