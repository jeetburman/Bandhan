import { dayOfWeek } from "../src/domain/calendar/calendar";
import { db } from "../src/lib/db";
import { addHoliday, planFreshness, removeHoliday } from "../src/server/holidays";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const label = (date: string) => `${DAY_NAMES[dayOfWeek(date)]} ${date}`;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const command = process.argv[2];
  const actorEmail = arg("as");
  if (!actorEmail) throw new Error("Pass --as=<email>, for example --as=bh.b01@demo.local");

  if (command === "add" || command === "remove") {
    const date = arg("date");
    if (!date) throw new Error("Pass --date=YYYY-MM-DD");
    const branchCode = arg("branch");
    const where = branchCode ?? "cluster-wide";

    if (command === "add") {
      const rawName = arg("name");
      if (!rawName) throw new Error("Pass --name=Holiday_name (underscores become spaces)");
      const name = rawName.replace(/_/g, " ");
      const result = await addHoliday({ date, name, actorEmail, branchCode, today: arg("today") });

      console.log(`Added ${where} holiday "${name}" on ${label(date)}`);
      console.log("Working days left from that date to month end, before -> after:");
      for (const row of result.impact) {
        const note = row.hasPublishedPlan
          ? "published plan now needs re-publishing"
          : "no published plan yet";
        console.log(`  ${row.branchCode}   ${row.workingDaysBefore} -> ${row.workingDaysAfter}   (${note})`);
      }
    } else {
      const result = await removeHoliday({ date, actorEmail, branchCode, today: arg("today") });
      console.log(`Removed ${where} holiday "${result.name}" on ${label(date)}`);
      console.log("Published plans that were built with it now need re-publishing.");
    }
    return;
  }

  if (command === "status") {
    const month = arg("month") ?? "2026-11";
    const rows = await planFreshness({ actorEmail, month });
    console.log(`Plan status for ${month}`);
    for (const row of rows) {
      if (row.version === null) {
        console.log(`  ${row.branchCode}  no published plan`);
      } else if (!row.stale) {
        console.log(`  ${row.branchCode}  v${row.version}  up to date`);
      } else {
        const changes = [
          row.added.length > 0 ? `added ${row.added.join(", ")}` : "",
          row.removed.length > 0 ? `removed ${row.removed.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("; ");
        console.log(`  ${row.branchCode}  v${row.version}  NEEDS RE-PUBLISH  (${changes})`);
      }
    }

    const audit = await db.auditLog.findMany({
      where: { action: { in: ["HOLIDAY_ADDED", "HOLIDAY_REMOVED"] } },
      orderBy: { at: "desc" },
      take: 5,
    });
    console.log("\nLatest holiday audit entries");
    if (audit.length === 0) console.log("  none yet");
    for (const entry of audit) {
      console.log(`  ${entry.at.toISOString()}  ${entry.action.padEnd(15)} ${entry.summary}`);
    }
    return;
  }

  throw new Error("Use one of: add, remove, status");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());