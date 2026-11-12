import { db } from "../src/lib/db";
import { loadCalendar } from "../src/server/calendar-config";

/**
 * One-off: plans published before holiday tracking have no recorded holiday list.
 * This records each branch's current holidays on them, so they start out "up to date".
 */
async function main() {
  const plans = await db.targetPlan.findMany({
    where: { status: "PUBLISHED" },
    include: { branch: true },
  });

  let updated = 0;
  for (const plan of plans) {
    if (plan.holidayDates.length > 0) continue;
    const { holidays } = await loadCalendar(plan.branch.clusterId, plan.branchId, plan.month);
    if (holidays.length === 0) continue;
    await db.targetPlan.update({ where: { id: plan.id }, data: { holidayDates: holidays } });
    updated++;
  }
  console.log(`Recorded the holiday list on ${updated} published plan(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());