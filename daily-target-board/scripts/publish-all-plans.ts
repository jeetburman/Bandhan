import { db } from "../src/lib/db";
import { istBusinessDate } from "../src/lib/ist";
import { publishPlan } from "../src/server/publish-plan";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const month = arg("month") ?? istBusinessDate(new Date()).slice(0, 7);
  const branches = await db.branch.findMany({ orderBy: { code: "asc" } });

  for (const branch of branches) {
    const existing = await db.targetPlan.count({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
    });
    if (existing > 0) {
      console.log(`${branch.code}  already has a published plan, skipped`);
      continue;
    }
    try {
      const result = await publishPlan({
        branchCode: branch.code,
        month,
        actorEmail: `bh.${branch.code.toLowerCase()}@demo.local`,
      });
      console.log(
        `${branch.code}  published v${result.version}, effective ${result.effectiveFrom}, ${result.lineCount} target lines`,
      );
    } catch (error) {
      console.log(`${branch.code}  FAILED: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());