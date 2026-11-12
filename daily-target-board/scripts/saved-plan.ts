import { db } from "../src/lib/db";
import { formatQty } from "../src/lib/money";
import { qtyFromDb } from "../src/lib/qty";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

interface Row {
  kind: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  plannedQty: bigint;
  planId: string | null;
}

async function main() {
  const branchCode = arg("branch") ?? "B01";
  const month = arg("month") ?? "2026-11";
  const email = arg("user") ?? `cro1.${branchCode.toLowerCase()}@demo.local`;
  const metricCode = arg("metric") ?? "FD_VALUE";

  const branch = await db.branch.findUnique({ where: { code: branchCode } });
  if (!branch) throw new Error(`Unknown branch: ${branchCode}`);
  const metric = await db.metric.findUnique({ where: { code: metricCode } });
  if (!metric) throw new Error(`Unknown metric: ${metricCode}`);

  const plans = await db.targetPlan.findMany({
    where: { branchId: branch.id, month },
    orderBy: { version: "asc" },
    include: {
      publishedBy: true,
      _count: { select: { lines: true, slices: true, branchSlices: true } },
    },
  });

  console.log(`${branch.name} (${branch.code}) | ${month}`);
  if (plans.length === 0) {
    console.log("No plans saved yet. Run: npm run plan:publish");
  }
  for (const plan of plans) {
    console.log(
      `  v${plan.version}  ${plan.status.padEnd(10)} effective ${plan.effectiveFrom}` +
        `  lines ${plan._count.lines}  slices still attached ${plan._count.slices + plan._count.branchSlices}` +
        `  by ${plan.publishedBy?.name ?? "?"}`,
    );
  }

  const versionOf = new Map(plans.map((p) => [p.id, p.version]));
  const versionLabel = (planId: string | null) =>
    planId ? `v${versionOf.get(planId) ?? "?"}` : "carry";

  let rows: Row[];
  let target: number | null;
  let who: string;

  if (metric.scope === "BRANCH") {
    who = "the whole branch";
    rows = await db.branchSlice.findMany({
      where: { branchId: branch.id, metricId: metric.id, month },
      orderBy: [{ dueDate: "asc" }, { periodStart: "asc" }],
    });
    const snapshot = await db.planBranchTarget.findFirst({
      where: { metricId: metric.id, plan: { branchId: branch.id, month, status: "PUBLISHED" } },
    });
    target = snapshot ? qtyFromDb(snapshot.quantity) : null;
  } else {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Unknown user: ${email}`);
    who = user.name;
    rows = await db.targetSlice.findMany({
      where: { userId: user.id, metricId: metric.id, month },
      orderBy: [{ dueDate: "asc" }, { periodStart: "asc" }],
    });
    const line = await db.targetLine.findFirst({
      where: { userId: user.id, metricId: metric.id, plan: { month, status: "PUBLISHED" } },
    });
    target = line ? qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty) : null;
  }

  console.log(`\nSaved slices for ${who} / ${metric.name}`);
  let total = 0;
  for (const row of rows) {
    const qty = qtyFromDb(row.plannedQty);
    total += qty;
    console.log(
      `  ${row.kind.padEnd(5)} ${row.periodStart} to ${row.periodEnd}  due ${row.dueDate}` +
        `  ${formatQty(metric.unit, qty).padStart(14)}  ${versionLabel(row.planId)}`,
    );
  }
  const targetText = target === null ? "not set" : formatQty(metric.unit, target);
  console.log(`  Slices add up to ${formatQty(metric.unit, total)}; the published target is ${targetText}`);

  const audit = await db.auditLog.findMany({
    where: { branchId: branch.id },
    orderBy: { at: "desc" },
    take: 5,
    include: { actor: true },
  });
  console.log("\nLatest audit entries");
  for (const entry of audit) {
    console.log(`  ${entry.at.toISOString()}  ${entry.action.padEnd(15)} ${entry.summary}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());