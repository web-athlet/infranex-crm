-- AlterTable
ALTER TABLE "RefreshTokenFamily"
ADD COLUMN "invalidatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_invalidatedAt_idx" ON "RefreshTokenFamily"("invalidatedAt");
