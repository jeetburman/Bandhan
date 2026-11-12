import { db } from "../src/lib/db";
import { formatQty } from "../src/lib/money";
import { describeWarning } from "../src/lib/warnings";
import { publishPlan, type ExtraInput } from "../src/server/publish-plan";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function args(name: string): string[] {
  const prefix = `--${name}=`;
  return process.argv.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length));
}

async function main() {
  const branchCode = arg("branch") ?? "B01";
  const month = arg("month") ?? "2026-11";
  const actorEmail = arg("as") ?? `bh.${branchCode.toLowerCase()}@demo.local`;

  const metrics = await db.metric.findMany();
  const metricByCode = new Map(metrics.map((m) => [m.code, m]));
  const metricById = new Map(metrics.map((m) => [m.id, m]));

  // --extra=email:METRIC_CODE:whole-number[:note]. Amounts are in rupees here.
  const parseExtra = (spec: string): ExtraInput => {
    const [email, metricCode, rawQty, ...noteParts] = spec.split(":");
    if (!email || !metricCode || !rawQty || !/^\d+$/.test(rawQty)) {
      throw new Error(`Bad --extra "${spec}". Use email:METRIC_CODE:whole-number[:note]`);
    }
    const metric = metricByCode.get(metricCode);
    if (!metric) throw new Error(`Unknown metric code: ${metricCode}`);
    const quantity = metric.unit === "AMOUNT" ? Number(rawQty) * 100 : Number(rawQty);
    return { email, metricCode, quantity, note: noteParts.join(":") || undefined };
  };

  const extraSpecs = args("extra");
  const clearExtras = process.argv.includes("--clear-extras");
  const extras = clearExtras ? [] : extraSpecs.length > 0 ? extraSpecs.map(parseExtra) : undefined;

  const result = await publishPlan({
    branchCode,
    month,
    actorEmail,
    effectiveFrom: arg("effective"),
    today: arg("today"),
    extras,
  });

  const replaced = result.supersededVersion === null ? "" : `, replacing v${result.supersededVersion}`;
  console.log(
    `Published plan v${result.version} for ${branchCode} / ${month}, effective from ${result.effectiveFrom}${replaced}`,
  );
  console.log(
    `  target lines: ${result.lineCount} | new slices: ${result.newSliceCount} | ` +
      `kept (already due): ${result.keptSliceCount} | replaced (still open): ${result.removedSliceCount}`,
  );

  if (extras !== undefined) {
    console.log(`  extras in this version: ${extras.length}`);
    for (const extra of extras) {
      const metric = metricByCode.get(extra.metricCode);
      const shown = metric ? formatQty(metric.unit, extra.quantity) : String(extra.quantity);
      console.log(`    ${extra.email}  ${extra.metricCode}  +${shown}${extra.note ? `  (${extra.note})` : ""}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings (publishing was still allowed)");
    for (const warning of result.warnings) {
      console.log(`  - ${describeWarning(warning, metricById)}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());