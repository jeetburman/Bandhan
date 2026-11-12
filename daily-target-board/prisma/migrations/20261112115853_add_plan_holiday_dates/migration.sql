-- AlterTable
ALTER TABLE "TargetPlan" ADD COLUMN     "holidayDates" TEXT[] DEFAULT ARRAY[]::TEXT[];
