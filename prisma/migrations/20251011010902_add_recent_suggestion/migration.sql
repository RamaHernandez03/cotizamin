-- AlterTable
ALTER TABLE "public"."CotizacionParticipacion" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- CreateTable
CREATE TABLE "public"."RecentSuggestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proveedor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyecto" TEXT,
    "comentario" TEXT,
    "sugerencia" TEXT NOT NULL,

    CONSTRAINT "RecentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentSuggestion_proveedor_id_created_at_idx" ON "public"."RecentSuggestion"("proveedor_id", "created_at");
