-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SALES_REP', 'MEMBER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'TOKEN_REFRESH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('TENANT', 'USER', 'MEMBERSHIP', 'AUTH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TokenRevocationReason" AS ENUM ('LOGOUT', 'ROTATED', 'EXPIRED', 'COMPROMISED', 'ADMIN_REVOKED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIInsightType" AS ENUM ('SUMMARY', 'NEXT_ACTION', 'RISK', 'OPPORTUNITY', 'ENRICHMENT');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" "TokenRevocationReason",
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "riskFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "domain" TEXT,
    "industry" TEXT,
    "notes" TEXT,
    "enrichmentEmbedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "optIn" BOOLEAN NOT NULL DEFAULT false,
    "optInSource" TEXT,
    "optInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "probability" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "expectedCloseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "ghostingSnoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "dealId" TEXT,
    "ownerId" TEXT,
    "type" "ActivityType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "dealId" TEXT,
    "direction" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "subject" TEXT,
    "bodyEncrypted" TEXT NOT NULL,
    "bodyPreview" VARCHAR(500),
    "gmailMessageId" TEXT,
    "outlookMessageId" TEXT,
    "gmailHistoryId" TEXT,
    "gmailWatchExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unitPrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT,
    "organizationId" TEXT,
    "personId" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "bodyEncrypted" TEXT NOT NULL,
    "bodyPreview" VARCHAR(500),
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "dealId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "dealId" TEXT,
    "type" "AIInsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "confidence" DECIMAL(65,30),
    "validatedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Membership_tenantId_deletedAt_idx" ON "Membership"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_role_idx" ON "Membership"("tenantId", "role");

-- CreateIndex
CREATE INDEX "Membership_tenantId_isActive_idx" ON "Membership"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_id_key" ON "Membership"("tenantId", "id");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_tokenHash_idx" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordReset_usedAt_idx" ON "PasswordReset"("usedAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Organization_tenantId_deletedAt_idx" ON "Organization"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Organization_tenantId_name_idx" ON "Organization"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_tenantId_id_key" ON "Organization"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_tenantId_domain_key" ON "Organization"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "Person_tenantId_deletedAt_idx" ON "Person"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Person_tenantId_organizationId_idx" ON "Person"("tenantId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_tenantId_id_key" ON "Person"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Person_tenantId_email_key" ON "Person"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Pipeline_tenantId_deletedAt_idx" ON "Pipeline"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_tenantId_name_key" ON "Pipeline"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_tenantId_id_key" ON "Pipeline"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Stage_tenantId_deletedAt_idx" ON "Stage"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Stage_tenantId_pipelineId_idx" ON "Stage"("tenantId", "pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_tenantId_pipelineId_id_key" ON "Stage"("tenantId", "pipelineId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_tenantId_pipelineId_name_key" ON "Stage"("tenantId", "pipelineId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_tenantId_pipelineId_position_key" ON "Stage"("tenantId", "pipelineId", "position");

-- CreateIndex
CREATE INDEX "Deal_tenantId_deletedAt_idx" ON "Deal"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Deal_tenantId_pipelineId_idx" ON "Deal"("tenantId", "pipelineId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_stageId_idx" ON "Deal"("tenantId", "stageId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_ownerId_idx" ON "Deal"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_status_idx" ON "Deal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Deal_tenantId_expectedCloseAt_idx" ON "Deal"("tenantId", "expectedCloseAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_tenantId_id_key" ON "Deal"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Activity_tenantId_deletedAt_idx" ON "Activity"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Activity_tenantId_organizationId_idx" ON "Activity"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_personId_idx" ON "Activity"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_dealId_idx" ON "Activity"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_ownerId_idx" ON "Activity"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_dueAt_idx" ON "Activity"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "Activity_tenantId_completedAt_idx" ON "Activity"("tenantId", "completedAt");

-- CreateIndex
CREATE INDEX "Email_tenantId_deletedAt_idx" ON "Email"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Email_tenantId_organizationId_idx" ON "Email"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "Email_tenantId_personId_idx" ON "Email"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "Email_tenantId_dealId_idx" ON "Email"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "Email_tenantId_sentAt_idx" ON "Email"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "Email_tenantId_receivedAt_idx" ON "Email"("tenantId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Email_tenantId_gmailMessageId_key" ON "Email"("tenantId", "gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_tenantId_outlookMessageId_key" ON "Email"("tenantId", "outlookMessageId");

-- CreateIndex
CREATE INDEX "Product_tenantId_deletedAt_idx" ON "Product"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_tenantId_isActive_idx" ON "Product"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_name_key" ON "Product"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_id_key" ON "Product"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "DealProduct_tenantId_dealId_idx" ON "DealProduct"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "DealProduct_tenantId_productId_idx" ON "DealProduct"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "DealProduct_tenantId_dealId_productId_key" ON "DealProduct"("tenantId", "dealId", "productId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_deletedAt_idx" ON "Lead"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Lead_tenantId_formId_idx" ON "Lead"("tenantId", "formId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Lead_tenantId_enrichmentStatus_idx" ON "Lead"("tenantId", "enrichmentStatus");

-- CreateIndex
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Form_tenantId_deletedAt_idx" ON "Form"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Form_tenantId_isActive_idx" ON "Form"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Form_tenantId_id_key" ON "Form"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Form_tenantId_slug_key" ON "Form"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_deletedAt_idx" ON "Campaign"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_scheduledAt_idx" ON "Campaign"("tenantId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_tenantId_id_key" ON "Campaign"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_tenantId_name_key" ON "Campaign"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_trackingToken_key" ON "CampaignContact"("trackingToken");

-- CreateIndex
CREATE INDEX "CampaignContact_tenantId_campaignId_idx" ON "CampaignContact"("tenantId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignContact_tenantId_personId_idx" ON "CampaignContact"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "CampaignContact_tenantId_sentAt_idx" ON "CampaignContact"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "CampaignContact_tenantId_openedAt_idx" ON "CampaignContact"("tenantId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_tenantId_campaignId_personId_key" ON "CampaignContact"("tenantId", "campaignId", "personId");

-- CreateIndex
CREATE INDEX "Project_tenantId_deletedAt_idx" ON "Project"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_tenantId_organizationId_idx" ON "Project"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "Project_tenantId_dealId_idx" ON "Project"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_id_key" ON "Project"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Task_tenantId_deletedAt_idx" ON "Task"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Task_tenantId_projectId_idx" ON "Task"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Task_tenantId_ownerId_idx" ON "Task"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_dueAt_idx" ON "Task"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "ProjectTemplate_tenantId_deletedAt_idx" ON "ProjectTemplate"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProjectTemplate_tenantId_isActive_idx" ON "ProjectTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_tenantId_name_key" ON "ProjectTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_deletedAt_idx" ON "AIInsight"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_organizationId_idx" ON "AIInsight"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_personId_idx" ON "AIInsight"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_dealId_idx" ON "AIInsight"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_type_idx" ON "AIInsight"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AIInsight_tenantId_validatedAt_idx" ON "AIInsight"("tenantId", "validatedAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tenantId_pipelineId_fkey" FOREIGN KEY ("tenantId", "pipelineId") REFERENCES "Pipeline"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_pipelineId_fkey" FOREIGN KEY ("tenantId", "pipelineId") REFERENCES "Pipeline"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_pipelineId_stageId_fkey" FOREIGN KEY ("tenantId", "pipelineId", "stageId") REFERENCES "Stage"("tenantId", "pipelineId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId", "ownerId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId", "ownerId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealProduct" ADD CONSTRAINT "DealProduct_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_formId_fkey" FOREIGN KEY ("tenantId", "formId") REFERENCES "Form"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_tenantId_campaignId_fkey" FOREIGN KEY ("tenantId", "campaignId") REFERENCES "Campaign"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_projectId_fkey" FOREIGN KEY ("tenantId", "projectId") REFERENCES "Project"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId", "ownerId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
