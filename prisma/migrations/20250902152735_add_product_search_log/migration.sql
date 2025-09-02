-- CreateTable
CREATE TABLE "public"."ProductSearchLog" (
    "id" TEXT NOT NULL,
    "user_email" TEXT,
    "user_id" TEXT,
    "q" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "material" TEXT,
    "key_norm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_key_time" ON "public"."ProductSearchLog"("key_norm", "createdAt");
