import type { AllocationWarning } from "../src/domain/allocation/allocate";
import { dayOfWeek } from "../src/domain/calendar/calendar";
import type { PlannedSlice } from "../src/domain/distribution/plan-slices";
import { db } from "../src/lib/db";
import { formatQty } from "../src/lib/money";
import { loadPlanPreview } from "../src/server/plan-preview";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

const dayLabel = (date: string) => `${DAY_NAMES[dayOfWeek(date)]} ${date}`;

function sliceLabel(slice: PlannedSlice, formatted: string): string {
  if (slice.kind === "DAY") return `${dayLabel(slice.dueDate)}   ${formatted}`;
  return (
    `${slice.periodStart} to ${slice.periodEnd}   due ${dayLabel(slice.dueDate)}` +
    `   (${slice.workingDays} working days)   ${formatted}`
  );
}

async function main() {
  const branchCode = arg("branch") ?? "B01";
  const month = arg("month") ?? "2026-11";
  const email = arg("user") ?? `cro1.${branchCode.toLowerCase()}@demo.local`;
  const metricFilter = arg("metric");
  const extraHolidays = (arg("holiday") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const preview = await loadPlanPreview({ branchCode, month, extraHolidays });

  const metricById = new Map(preview.metrics.map((m) => [m.id, m]));
  const metricName = (id: string) => metricById.get(id)?.name ?? id;
  const fmt = (metricId: string, quantity: number) => {
    const metric = metricById.get(metricId);
    return metric ? formatQty(metric.unit, quantity) : String(quantity);
  };

  const describeWarning = (w: AllocationWarning): string => {
    const name = metricName(w.metricId);
    switch (w.code) {
      case "ALLOCATED_ABOVE_TARGET":
        return `${name}: employees total ${fmt(w.metricId, w.allocatedQty)}, above the branch target of ${fmt(w.metricId, w.targetQty)}`;
      case "ALLOCATED_BELOW_TARGET":
        return `${name}: employees total ${fmt(w.metricId, w.allocatedQty)}, below the branch target of ${fmt(w.metricId, w.targetQty)}`;
      case "NO_BRANCH_TARGET":
        return `${name}: employees total ${fmt(w.metricId, w.allocatedQty)} but the Cluster Head has set no branch target`;
      case "QUOTA_ON_BRANCH_METRIC":
        return `${name}: a quota exists for a branch-wide target and was ignored`;
    }
  };

  const trial = extraHolidays.length > 0 ? `   (trial holidays, not saved: ${extraHolidays.join(", ")})` : "";
  console.log(`${preview.branch.name} (${preview.branch.code}) | ${preview.month} | ${preview.workingDays} working days`);
  console.log(`Holidays: ${preview.holidays.length > 0 ? preview.holidays.join(", ") : "none"}${trial}`);

  console.log("\nBranch totals: employee targets added up, against the Cluster Head's target");
  for (const total of preview.allocation.totals) {
    const target = total.branchTargetQty === null ? "not set" : fmt(total.metricId, total.branchTargetQty);
    console.log(
      `  ${metricName(total.metricId).padEnd(28)} allocated ${fmt(total.metricId, total.allocatedQty).padStart(16)}   target ${target}`,
    );
  }

  if (preview.allocation.warnings.length > 0) {
    console.log("\nWarnings");
    for (const warning of preview.allocation.warnings) console.log(`  - ${describeWarning(warning)}`);
  }

  for (const branchMetric of preview.plan.branchMetrics) {
    console.log(`\nBranch-wide target: ${metricName(branchMetric.metricId)} = ${fmt(branchMetric.metricId, branchMetric.totalQty)}`);
    for (const slice of branchMetric.slices) {
      console.log(`  ${sliceLabel(slice, fmt(branchMetric.metricId, slice.plannedQty))}`);
    }
  }

  const employee = preview.employees.find((e) => e.email === email);
  if (!employee) {
    console.log(`\nNo employee with email ${email} in ${branchCode}. Try one of:`);
    for (const e of preview.employees) console.log(`  ${e.email}  (${e.designationCode})`);
    return;
  }

  console.log(`\nTargets for ${employee.name} (${employee.designationCode})`);
  const lines = preview.plan.employeeLines.filter(
    (line) =>
      line.userId === employee.userId &&
      (metricFilter === undefined || metricById.get(line.metricId)?.code === metricFilter),
  );
  if (lines.length === 0) console.log("  No targets found for this selection.");

  for (const line of lines) {
    const metric = metricById.get(line.metricId);
    const pacing = metric ? metric.pacing.toLowerCase() : "?";
    const extra = line.extraQty > 0 ? `  (base ${fmt(line.metricId, line.baseQty)} + extra ${fmt(line.metricId, line.extraQty)})` : "";
    console.log(`\n${metricName(line.metricId)}: ${fmt(line.metricId, line.totalQty)}  [${pacing}]${extra}`);
    for (const slice of line.slices) {
      console.log(`  ${sliceLabel(slice, fmt(line.metricId, slice.plannedQty))}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());