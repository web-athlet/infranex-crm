CREATE TYPE "AuthAuditEventType" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'LOGOUT_ALL',
  'REFRESH_SUCCESS',
  'REFRESH_REPLAY_DETECTED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'TWO_FACTOR_SETUP_STARTED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_VALIDATE_SUCCESS',
  'TWO_FACTOR_VALIDATE_FAILED',
  'TWO_FACTOR_DISABLED',
  'BACKUP_CODE_USED',
  'OAUTH_LINK_STARTED',
  'OAUTH_LINK_SUCCESS',
  'OAUTH_LINK_FAILED',
  'OAUTH_UNLINKED',
  'ADMIN_2FA_BLOCKED',
  'SECURITY_POLICY_BLOCKED'
);

CREATE TYPE "AuthAuditOutcome" AS ENUM (
  'SUCCESS',
  'FAILURE',
  'BLOCKED'
);

CREATE TABLE "AuthAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "eventType" "AuthAuditEventType" NOT NULL,
  "outcome" "AuthAuditOutcome" NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditLog_userId_createdAt_idx" ON "AuthAuditLog"("userId", "createdAt");
CREATE INDEX "AuthAuditLog_eventType_createdAt_idx" ON "AuthAuditLog"("eventType", "createdAt");
CREATE INDEX "AuthAuditLog_createdAt_idx" ON "AuthAuditLog"("createdAt");
