ALTER TABLE "RefreshTokenFamily"
ADD COLUMN "secondFactorSatisfiedAt" TIMESTAMP(3);

CREATE INDEX "RefreshTokenFamily_secondFactorSatisfiedAt_idx"
ON "RefreshTokenFamily"("secondFactorSatisfiedAt");

UPDATE "User"
SET "passwordChangedAt" = CURRENT_TIMESTAMP
WHERE "twoFactorEnabled" = TRUE;

WITH legacy_2fa_families AS (
  UPDATE "RefreshTokenFamily" AS family
  SET "invalidatedAt" = CURRENT_TIMESTAMP
  FROM "User" AS account
  WHERE family."userId" = account."id"
    AND account."twoFactorEnabled" = TRUE
    AND family."invalidatedAt" IS NULL
    AND family."compromisedAt" IS NULL
  RETURNING family."id", family."invalidatedAt"
)
UPDATE "RefreshToken" AS token
SET
  "revokedAt" = legacy_2fa_families."invalidatedAt",
  "revocationReason" = 'LOGOUT'
FROM legacy_2fa_families
WHERE token."familyId" = legacy_2fa_families."id"
  AND token."revokedAt" IS NULL;
