-- CreateEnum
CREATE TYPE "MetricScope" AS ENUM ('INDIVIDUAL', 'BRANCH');

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "scope" "MetricScope" NOT NULL DEFAULT 'INDIVIDUAL';
