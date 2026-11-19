-- CreateTable
CREATE TABLE "BranchTargetChange" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "previousQty" BIGINT NOT NULL,
    "newQty" BIGINT NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchTargetChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchTargetChange_branchId_month_at_idx" ON "BranchTargetChange"("branchId", "month", "at");

-- AddForeignKey
ALTER TABLE "BranchTargetChange" ADD CONSTRAINT "BranchTargetChange_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTargetChange" ADD CONSTRAINT "BranchTargetChange_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTargetChange" ADD CONSTRAINT "BranchTargetChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
