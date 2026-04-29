-- CreateTable
CREATE TABLE "RefreshTokenFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compromisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

-- Backfill one family row per existing refresh-token family.
INSERT INTO "RefreshTokenFamily" ("id", "userId", "createdAt", "updatedAt")
SELECT
    "familyId",
    MIN("userId"),
    MIN("createdAt"),
    CURRENT_TIMESTAMP
FROM "RefreshToken"
GROUP BY "familyId"
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_userId_idx" ON "RefreshTokenFamily"("userId");

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_compromisedAt_idx" ON "RefreshTokenFamily"("compromisedAt");

-- AddForeignKey
ALTER TABLE "RefreshTokenFamily" ADD CONSTRAINT "RefreshTokenFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RefreshTokenFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
