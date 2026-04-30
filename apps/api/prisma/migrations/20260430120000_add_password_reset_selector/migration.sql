ALTER TABLE "PasswordReset"
ADD COLUMN "selector" TEXT;

CREATE UNIQUE INDEX "PasswordReset_selector_key" ON "PasswordReset"("selector");
