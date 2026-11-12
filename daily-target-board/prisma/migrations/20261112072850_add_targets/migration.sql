-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SliceKind" AS ENUM ('DAY', 'WEEK', 'MONTH', 'CARRY');

-- CreateTable
CREATE TABLE "BranchTarget" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "quantity" BIGINT NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignationQuota" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "quantity" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignationQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetPlan" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" VARCHAR(10) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "TargetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBranchTarget" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,

    CONSTRAINT "PlanBranchTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "baseQty" BIGINT NOT NULL,
    "extraQty" BIGINT NOT NULL DEFAULT 0,
    "extraNote" TEXT,

    CONSTRAINT "TargetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetSlice" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "userId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "kind" "SliceKind" NOT NULL,
    "periodStart" VARCHAR(10) NOT NULL,
    "periodEnd" VARCHAR(10) NOT NULL,
    "dueDate" VARCHAR(10) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "plannedQty" BIGINT NOT NULL,
    "carriedFromMonth" VARCHAR(7),
    "closedAt" TIMESTAMP(3),
    "shortfallAtClose" BIGINT,

    CONSTRAINT "TargetSlice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchSlice" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "branchId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "kind" "SliceKind" NOT NULL,
    "periodStart" VARCHAR(10) NOT NULL,
    "periodEnd" VARCHAR(10) NOT NULL,
    "dueDate" VARCHAR(10) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "plannedQty" BIGINT NOT NULL,
    "carriedFromMonth" VARCHAR(7),
    "closedAt" TIMESTAMP(3),
    "shortfallAtClose" BIGINT,

    CONSTRAINT "BranchSlice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchTarget_month_idx" ON "BranchTarget"("month");

-- CreateIndex
CREATE UNIQUE INDEX "BranchTarget_branchId_metricId_month_key" ON "BranchTarget"("branchId", "metricId", "month");

-- CreateIndex
CREATE INDEX "DesignationQuota_month_idx" ON "DesignationQuota"("month");

-- CreateIndex
CREATE UNIQUE INDEX "DesignationQuota_clusterId_designationId_metricId_month_key" ON "DesignationQuota"("clusterId", "designationId", "metricId", "month");

-- CreateIndex
CREATE INDEX "TargetPlan_branchId_month_status_idx" ON "TargetPlan"("branchId", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TargetPlan_branchId_month_version_key" ON "TargetPlan"("branchId", "month", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlanBranchTarget_planId_metricId_key" ON "PlanBranchTarget"("planId", "metricId");

-- CreateIndex
CREATE INDEX "TargetLine_userId_idx" ON "TargetLine"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetLine_planId_userId_metricId_key" ON "TargetLine"("planId", "userId", "metricId");

-- CreateIndex
CREATE INDEX "TargetSlice_userId_month_idx" ON "TargetSlice"("userId", "month");

-- CreateIndex
CREATE INDEX "TargetSlice_dueDate_idx" ON "TargetSlice"("dueDate");

-- CreateIndex
CREATE INDEX "TargetSlice_planId_idx" ON "TargetSlice"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetSlice_userId_metricId_month_kind_periodStart_key" ON "TargetSlice"("userId", "metricId", "month", "kind", "periodStart");

-- CreateIndex
CREATE INDEX "BranchSlice_branchId_month_idx" ON "BranchSlice"("branchId", "month");

-- CreateIndex
CREATE INDEX "BranchSlice_dueDate_idx" ON "BranchSlice"("dueDate");

-- CreateIndex
CREATE INDEX "BranchSlice_planId_idx" ON "BranchSlice"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSlice_branchId_metricId_month_kind_periodStart_key" ON "BranchSlice"("branchId", "metricId", "month", "kind", "periodStart");

-- AddForeignKey
ALTER TABLE "BranchTarget" ADD CONSTRAINT "BranchTarget_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTarget" ADD CONSTRAINT "BranchTarget_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTarget" ADD CONSTRAINT "BranchTarget_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationQuota" ADD CONSTRAINT "DesignationQuota_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationQuota" ADD CONSTRAINT "DesignationQuota_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationQuota" ADD CONSTRAINT "DesignationQuota_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetPlan" ADD CONSTRAINT "TargetPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetPlan" ADD CONSTRAINT "TargetPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetPlan" ADD CONSTRAINT "TargetPlan_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBranchTarget" ADD CONSTRAINT "PlanBranchTarget_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TargetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBranchTarget" ADD CONSTRAINT "PlanBranchTarget_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetLine" ADD CONSTRAINT "TargetLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TargetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetLine" ADD CONSTRAINT "TargetLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetLine" ADD CONSTRAINT "TargetLine_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetSlice" ADD CONSTRAINT "TargetSlice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TargetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetSlice" ADD CONSTRAINT "TargetSlice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetSlice" ADD CONSTRAINT "TargetSlice_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSlice" ADD CONSTRAINT "BranchSlice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TargetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSlice" ADD CONSTRAINT "BranchSlice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSlice" ADD CONSTRAINT "BranchSlice_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
