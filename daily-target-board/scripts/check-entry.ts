import { db } from "../src/lib/db";
import { loadActor } from "../src/server/actor";
import { queueWhere } from "../src/server/entry-policy";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const sellerEmail = arg("seller") ?? "cro1.b01@demo.local";
  const reviewerEmails = (arg("reviewers") ?? "bh.b01@demo.local,abh1.b01@demo.local,sm.b01@demo.local")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seller = await db.user.findUnique({ where: { email: sellerEmail }, include: { branch: true } });
  if (!seller) throw new Error(`Unknown seller: ${sellerEmail}`);

  const latest = await db.progressEntry.findMany({
    where: { userId: seller.id },
    orderBy: { submittedAt: "desc" },
    take: 3,
    include: { branch: true },
  });

  console.log(`Latest sales by ${seller.name} (works in ${seller.branch?.code ?? "no branch"})`);
  for (const e of latest) {
    console.log(
      `  ${e.submittedAt.toISOString()}  ${e.status.padEnd(11)}  ${e.productName}  ` +
        `recorded in ${e.branch.code}  ${e.isDemo ? "[demo]" : "[real]"}`,
    );
  }
  const newest = latest[0];
  if (!newest) return;

  for (const email of reviewerEmails) {
    const reviewer = await loadActor(email);
    const where = queueWhere(reviewer);
    if (!where) {
      console.log(`\n${email}: has no approvals list`);
      continue;
    }
    const total = await db.progressEntry.count({ where });
    const found = await db.progressEntry.findFirst({ where: { AND: [where, { id: newest.id }] } });
    if (!found) {
      console.log(`\n${email}: queue has ${total} entries and the newest sale is NOT in it`);
      continue;
    }
    const older = await db.progressEntry.count({
      where: { AND: [where, { submittedAt: { lt: found.submittedAt } }] },
    });
    console.log(
      `\n${email}: queue has ${total} entries. The newest sale IS in it, ` +
        `number ${older + 1} when listed oldest first`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());