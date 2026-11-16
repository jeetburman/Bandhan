import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { addDays, monthRange, workingDaysInRange } from "../src/domain/calendar/calendar";
import { computeCredits } from "../src/domain/credits/credits";
import { distribute } from "../src/domain/distribution/distribute";
import type { EntryStatus } from "../src/domain/entries/workflow";
import { db } from "../src/lib/db";
import { istBusinessDate } from "../src/lib/ist";
import { qtyFromDb, qtyToDb } from "../src/lib/qty";
import { loadCalendar } from "../src/server/calendar-config";
import { loadCatalogProduct, summariseOptions, type LoadedProduct } from "../src/server/catalog";

// ---------- deterministic randomness ----------
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const istInstant = (date: string, hour: number, minute: number) =>
  new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
const notFuture = (moment: Date) => new Date(Math.min(moment.getTime(), Date.now()));

// ---------- what gets sold ----------
const PRODUCT_CODES = [
  "SAVINGS", "CURRENT", "FIXED_DEPOSIT", "HOME_LOAN", "PERSONAL_LOAN", "BUSINESS_LOAN",
  "VEHICLE_LOAN", "CREDIT_CARD", "LIFE_INSURANCE", "GENERAL_INSURANCE", "MUTUAL_FUND", "SIP", "DEMAT",
];
const SAVINGS_VARIANTS = ["ELITE", "ELITE_PLUS", "PREMIUM", "CLASSIC", "STANDARD", "DIGI_REGULAR", "SANCHAY", "SHAURYA", "PREMIUM_SALARY"];
const CURRENT_VARIANTS = ["BIZ_ELITE", "BIZ_PREMIUM", "BIZ_ADVANTAGE", "BIZ_STANDARD", "BIZ_DELUXE", "STARTUP_CA"];
const FD_TYPES = ["CUMULATIVE", "MONTHLY", "QUARTERLY", "SHORT_TERM", "TAX_SAVING"];
const FD_SOURCES = ["FRESH", "FRESH", "FRESH", "RENEWAL", "EXISTING"];
const LOANS = ["HOME_LOAN", "PERSONAL_LOAN", "BUSINESS_LOAN", "VEHICLE_LOAN"];
const CARD_TYPES = ["SPARK", "IGNITE", "FLARE", "LUMINIA"];
const LIFE_PLANS = ["UNIT_LINKED", "PENSION_PLAN", "TRADITIONAL_PARTICIPATING", "TRADITIONAL_NON_PARTICIPATING", "PROTECTION_TERM"];
const REJECTION_REASONS = ["Reference number missing", "Amount does not match the records", "Duplicate of an earlier entry"];

interface Spec {
  userId: string;
  designationCode: string;
  productCode: string;
  options: Record<string, string>;
  units: number;
  rupees: number;
  date: string;
}

async function main() {
  const today = argValue("today") ?? istBusinessDate(new Date());
  const month = today.slice(0, 7);
  const range = monthRange(month);
  const yesterday = addDays(today, -1);

  const cluster = await db.cluster.findUnique({ where: { name: "Park Street Cluster" } });
  if (!cluster) throw new Error("Cluster not found. Run: npm run db:seed:users");
  const branches = await db.branch.findMany({ where: { clusterId: cluster.id }, orderBy: { code: "asc" } });

  const metrics = await db.metric.findMany();
  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const metricIdByCode = new Map(metrics.map((m) => [m.code, m.id]));

  const products = new Map<string, LoadedProduct>();
  for (const code of PRODUCT_CODES) {
    const loaded = await loadCatalogProduct(code);
    if (!loaded) throw new Error(`Product ${code} not found. Run: npm run db:seed:catalog`);
    products.set(code, loaded);
  }

  const removed = await db.progressEntry.deleteMany({ where: { isDemo: true } });

  const entries: Prisma.ProgressEntryCreateManyInput[] = [];
  const credits: Prisma.EntryCreditCreateManyInput[] = [];
  const approvals: Prisma.ApprovalCreateManyInput[] = [];
  const skipped: string[] = [];
  let counter = 0;

  for (const branch of branches) {
    const plan = await db.targetPlan.findFirst({
      where: { branchId: branch.id, month, status: "PUBLISHED" },
      orderBy: { version: "desc" },
      include: { lines: true, branchTargets: true },
    });
    const { calendar } = await loadCalendar(branch.clusterId, branch.id, month);
    const closed = workingDaysInRange(range.start, yesterday, calendar);
    const monthDays = workingDaysInRange(range.start, range.end, calendar).length;
    if (!plan || closed.length === 0) {
      skipped.push(branch.code);
      continue;
    }
    const share = closed.length / monthDays;
    const todayIsWorking = workingDaysInRange(today, today, calendar).length === 1;

    const staff = await db.user.findMany({
      where: { branchId: branch.id, isActive: true },
      include: { designation: true },
    });
    const byId = new Map(staff.map((u) => [u.id, u]));
    const reviewers = staff.filter((u) => u.designation.role === "BRANCH_MANAGER");
    const supervisorId = staff.find((u) => u.designation.code === "SALES_MANAGER")?.id ?? null;

    const targetsByUser = new Map<string, Map<string, number>>();
    for (const line of plan.lines) {
      const code = metricById.get(line.metricId)?.code;
      if (!code) continue;
      const byMetric = targetsByUser.get(line.userId) ?? new Map<string, number>();
      byMetric.set(code, qtyFromDb(line.baseQty) + qtyFromDb(line.extraQty));
      targetsByUser.set(line.userId, byMetric);
    }

    const specs: Spec[] = [];
    for (const [userId, targets] of targetsByUser) {
      const user = byId.get(userId);
      if (!user) continue;

      // Some people are ahead of pace and some are behind, the same way on every run.
      const base = 0.5 + rng(user.email)() * 0.8;
      const factor = (code: string) =>
        Math.min(1.4, Math.max(0.3, base + (rng(`${user.email}|${code}`)() - 0.5) * 0.3));
      const rand = rng(`${user.email}|${today}|entries`);
      const day = () => closed[Math.floor(rand() * closed.length)];

      const countFor = (code: string) => {
        const target = targets.get(code) ?? 0;
        return Math.min(target, Math.round(target * share * factor(code)));
      };
      const rupeesFor = (code: string) => {
        const target = targets.get(code) ?? 0;
        return Math.min(Math.floor(target / 100), Math.floor((target * share * factor(code)) / 100));
      };
      const splitRupees = (rupees: number, averageTicket: number) => {
        if (rupees <= 0) return [] as number[];
        const parts = Math.max(1, Math.min(closed.length * 2, Math.round(rupees / averageTicket)));
        const weights = Array.from({ length: parts }, () => 1 + Math.floor(rand() * 5));
        return distribute(rupees, weights).filter((amount) => amount > 0);
      };
      const add = (productCode: string, options: Record<string, string>, rupees: number, date = day()) =>
        specs.push({ userId, designationCode: user.designation.code, productCode, options, units: 1, rupees, date });

      // Accounts carry the opening balance, which is what feeds the CASA target.
      const savings = countFor("SA_COUNT");
      const current = countFor("CA_COUNT");
      const casaWeights = [
        ...Array.from({ length: savings }, () => 1 + Math.floor(rand() * 3)),
        ...Array.from({ length: current }, () => 3 + Math.floor(rand() * 4)),
      ];
      const casaParts = casaWeights.length > 0 ? distribute(rupeesFor("CASA_VALUE"), casaWeights) : [];
      const balance = (i: number) => Math.max(1000, casaParts[i] ?? 25_000);
      for (let i = 0; i < savings; i++) add("SAVINGS", { VARIANT: pick(rand, SAVINGS_VARIANTS) }, balance(i));
      for (let i = 0; i < current; i++) add("CURRENT", { VARIANT: pick(rand, CURRENT_VARIANTS) }, balance(savings + i));

      for (const r of splitRupees(rupeesFor("FD_VALUE"), 800_000)) {
        add("FIXED_DEPOSIT", { SIZE: "RETAIL", TYPE: pick(rand, FD_TYPES), SOURCE: pick(rand, FD_SOURCES) }, r);
      }
      for (const r of splitRupees(rupeesFor("LOAN_VALUE"), 1_500_000)) {
        const code = pick(rand, LOANS);
        add(code, code === "VEHICLE_LOAN" ? { VEHICLE_TYPE: pick(rand, ["FOUR_WHEELER", "TWO_WHEELER"]) } : {}, r);
      }
      for (const r of splitRupees(rupeesFor("LIFE_INSURANCE_VALUE"), 100_000)) add("LIFE_INSURANCE", { PLAN_TYPE: pick(rand, LIFE_PLANS) }, r);
      for (const r of splitRupees(rupeesFor("GENERAL_INSURANCE_VALUE"), 10_000)) add("GENERAL_INSURANCE", {}, r);
      for (const r of splitRupees(rupeesFor("MF_VALUE"), 200_000)) add("MUTUAL_FUND", {}, r);
      for (let i = 0; i < countFor("SIP_COUNT"); i++) add("SIP", {}, 0);
      for (let i = 0; i < countFor("CARD_COUNT"); i++) add("CREDIT_CARD", { CARD_TYPE: pick(rand, CARD_TYPES) }, 0);
      for (let i = 0; i < countFor("DEMAT_COUNT"); i++) add("DEMAT", {}, 0);

      // Some people have already sold something today, waiting for approval.
      if (todayIsWorking && rand() < 0.5) {
        const todays = ["SIP_COUNT", "CARD_COUNT", "DEMAT_COUNT"].filter((code) => (targets.get(code) ?? 0) > 0);
        if (todays.length > 0) {
          const code = pick(rand, todays);
          if (code === "SIP_COUNT") add("SIP", {}, 0, today);
          else if (code === "CARD_COUNT") add("CREDIT_CARD", { CARD_TYPE: pick(rand, CARD_TYPES) }, 0, today);
          else add("DEMAT", {}, 0, today);
        }
      }
    }

    // The branch-wide Affluent Legacy target: some savings accounts are Legacy variants.
    const legacy = plan.branchTargets.find((t) => metricById.get(t.metricId)?.code === "AFFLUENT_LEGACY_COUNT");
    if (legacy) {
      const target = qtyFromDb(legacy.quantity);
      const wanted = Math.min(target, Math.round(target * share * (0.6 + rng(`${branch.code}|legacy`)() * 0.6)));
      specs
        .filter((s) => s.productCode === "SAVINGS" && s.rupees >= 50_000 &&
          (s.designationCode === "AFFLUENT_RELATIONSHIP_MANAGER" || s.designationCode === "CUSTOMER_RELATION_OFFICER"))
        .slice(0, wanted)
        .forEach((s) => { s.options = { VARIANT: "SB_LEGACY" }; });
    }

    specs.forEach((spec, index) => {
      const user = byId.get(spec.userId);
      const loaded = products.get(spec.productCode);
      if (!user || !loaded || reviewers.length === 0) return;

      const rand = rng(`${user.email}|${spec.date}|${index}|status`);
      const position = closed.indexOf(spec.date);
      const recent = position !== -1 && closed.length - 1 - position < 2;

      let status: EntryStatus;
      let autoVerified = false;
      if (!user.designation.requiresVerification) {
        status = "VERIFIED";
        autoVerified = true;
      } else if (spec.date === today) {
        status = "SUBMITTED";
      } else if (recent) {
        const r = rand();
        status = r < 0.4 ? "VERIFIED" : r < 0.8 || !supervisorId || user.reportsToId !== supervisorId ? "SUBMITTED" : "L1_APPROVED";
      } else {
        status = rand() < 0.05 ? "REJECTED" : "VERIFIED";
      }

      const id = randomUUID();
      counter++;
      const submittedAt = notFuture(istInstant(spec.date, 11 + Math.floor(rand() * 6), Math.floor(rand() * 60)));
      const finished = status === "VERIFIED" || status === "REJECTED";
      const decidedAt = autoVerified
        ? submittedAt
        : finished
          ? notFuture(istInstant(addDays(spec.date, 1), 10, Math.floor(rand() * 60)))
          : null;
      const reviewer = reviewers[index % reviewers.length];

      entries.push({
        id,
        branchId: branch.id,
        userId: user.id,
        productId: loaded.productId,
        productName: loaded.productName,
        optionSummary: summariseOptions(loaded, spec.options) || null,
        selectedOptions: spec.options,
        activityDate: spec.date,
        units: spec.units,
        amountPaise: qtyToDb(spec.rupees * 100),
        reference: `DEMO-${String(counter).padStart(5, "0")}`,
        status,
        autoVerified,
        submittedAt,
        decidedAt,
        rejectionReason: status === "REJECTED" ? pick(rand, REJECTION_REASONS) : null,
        isDemo: true,
      });

      for (const credit of computeCredits(loaded.product, {
        selectedOptions: spec.options,
        units: spec.units,
        amountPaise: spec.rupees * 100,
      })) {
        const metricId = metricIdByCode.get(credit.metricCode);
        if (!metricId) throw new Error(`Metric ${credit.metricCode} not found`);
        credits.push({ entryId: id, metricId, quantity: qtyToDb(credit.quantity) });
      }

      const underSupervisor = supervisorId !== null && user.reportsToId === supervisorId;
      if (status === "L1_APPROVED" || (status === "VERIFIED" && !autoVerified && underSupervisor && rand() < 0.5)) {
        approvals.push({ entryId: id, level: "FIRST", decision: "APPROVED", byId: supervisorId as string, at: submittedAt });
      }
      if (status === "VERIFIED" && !autoVerified && decidedAt) {
        approvals.push({ entryId: id, level: "FINAL", decision: "APPROVED", byId: reviewer.id, at: decidedAt });
      }
      if (status === "REJECTED" && decidedAt) {
        approvals.push({
          entryId: id, level: "FINAL", decision: "REJECTED", byId: reviewer.id, at: decidedAt,
          reason: pick(rand, REJECTION_REASONS),
        });
      }
    });
  }

  const insertInChunks = async <T,>(items: T[], insert: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < items.length; i += 1000) await insert(items.slice(i, i + 1000));
  };
  await insertInChunks(entries, (data) => db.progressEntry.createMany({ data }));
  await insertInChunks(credits, (data) => db.entryCredit.createMany({ data }));
  await insertInChunks(approvals, (data) => db.approval.createMany({ data }));

  const byStatus = await db.progressEntry.groupBy({
    by: ["status"],
    where: { isDemo: true },
    _count: { _all: true },
  });
  console.log(`Replaced ${removed.count} earlier demo entries with ${entries.length} new ones (${month}, up to ${today}).`);
  for (const row of byStatus) console.log(`  ${row.status.padEnd(12)} ${row._count._all}`);
  if (skipped.length > 0) console.log(`Skipped (no published plan or no closed working day yet): ${skipped.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());