ALTER TABLE "User"
ADD COLUMN "twoFactorSecretEncrypted" TEXT,
ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN "twoFactorBackupCodesHash" JSONB,
ADD COLUMN "twoFactorLastValidatedAt" TIMESTAMP(3);

CREATE TABLE "TwoFactorChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TwoFactorChallenge"
ADD CONSTRAINT "TwoFactorChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "TwoFactorChallenge_userId_idx" ON "TwoFactorChallenge"("userId");
CREATE INDEX "TwoFactorChallenge_purpose_idx" ON "TwoFactorChallenge"("purpose");
CREATE INDEX "TwoFactorChallenge_expiresAt_idx" ON "TwoFactorChallenge"("expiresAt");
CREATE INDEX "TwoFactorChallenge_usedAt_idx" ON "TwoFactorChallenge"("usedAt");
