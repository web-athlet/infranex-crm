-- CreateIndex
CREATE UNIQUE INDEX "Activity_tenantId_id_key" ON "Activity"("tenantId", "id");

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "dealId" TEXT,
    "activityId" TEXT,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Note_tenantId_id_key" ON "Note"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Note_tenantId_deletedAt_idx" ON "Note"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Note_tenantId_organizationId_idx" ON "Note"("tenantId", "organizationId");

-- CreateIndex
CREATE INDEX "Note_tenantId_personId_idx" ON "Note"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "Note_tenantId_dealId_idx" ON "Note"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "Note_tenantId_activityId_idx" ON "Note"("tenantId", "activityId");

-- CreateIndex
CREATE INDEX "Note_tenantId_authorId_idx" ON "Note"("tenantId", "authorId");

-- CreateIndex
CREATE INDEX "Note_tenantId_type_idx" ON "Note"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Note_tenantId_updatedAt_idx" ON "Note"("tenantId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Organization"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_personId_fkey" FOREIGN KEY ("tenantId", "personId") REFERENCES "Person"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_dealId_fkey" FOREIGN KEY ("tenantId", "dealId") REFERENCES "Deal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_activityId_fkey" FOREIGN KEY ("tenantId", "activityId") REFERENCES "Activity"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_authorId_fkey" FOREIGN KEY ("tenantId", "authorId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
