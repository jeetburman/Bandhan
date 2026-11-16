-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('SUBMITTED', 'L1_APPROVED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalLevel" AS ENUM ('FIRST', 'FINAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProgressEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "optionSummary" TEXT,
    "selectedOptions" JSONB,
    "activityDate" VARCHAR(10) NOT NULL,
    "units" INTEGER NOT NULL,
    "amountPaise" BIGINT NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,
    "status" "EntryStatus" NOT NULL,
    "autoVerified" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryCredit" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,

    CONSTRAINT "EntryCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "level" "ApprovalLevel" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "byId" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressEntry_branchId_status_idx" ON "ProgressEntry"("branchId", "status");

-- CreateIndex
CREATE INDEX "ProgressEntry_userId_activityDate_idx" ON "ProgressEntry"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "ProgressEntry_activityDate_idx" ON "ProgressEntry"("activityDate");

-- CreateIndex
CREATE INDEX "EntryCredit_metricId_idx" ON "EntryCredit"("metricId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryCredit_entryId_metricId_key" ON "EntryCredit"("entryId", "metricId");

-- CreateIndex
CREATE INDEX "Approval_entryId_idx" ON "Approval"("entryId");

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryCredit" ADD CONSTRAINT "EntryCredit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ProgressEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryCredit" ADD CONSTRAINT "EntryCredit_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ProgressEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
