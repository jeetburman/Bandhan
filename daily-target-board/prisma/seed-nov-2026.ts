import { PrismaClient } from "@prisma/client";
import { qtyToDb } from "../src/lib/qty";

const prisma = new PrismaClient();

const MONTH = "2026-11";

// Amounts are stored in paise.
const rupees = (n: number) => n * 100;
const lakh = (n: number) => rupees(n * 100_000);

type Quotas = Record<string, number>;

// The CRO row is from your example. Everything else is synthetic.
// BH and CH are left out on purpose: they have no personal targets.
const QUOTAS: Record<string, Quotas> = {
  CUSTOMER_RELATION_OFFICER: {
    FD_VALUE: lakh(50),
    SA_COUNT: 7,
    CA_COUNT: 2,
    CASA_VALUE: lakh(13),
    LIFE_INSURANCE_VALUE: lakh(4),
    GENERAL_INSURANCE_VALUE: rupees(40_000),
    SIP_COUNT: 5,
  },
  SALES_EXECUTIVE: {
    FD_VALUE: lakh(20),
    SA_COUNT: 10,
    CA_COUNT: 2,
    CASA_VALUE: lakh(8),
    CARD_COUNT: 3,
    SIP_COUNT: 3,
  },
  AFFLUENT_RELATIONSHIP_MANAGER: {
    FD_VALUE: lakh(100),
    SA_COUNT: 3,
    CASA_VALUE: lakh(40),
    LIFE_INSURANCE_VALUE: lakh(10),
    GENERAL_INSURANCE_VALUE: lakh(1),
    MF_VALUE: lakh(15),
    SIP_COUNT: 4,
    DEMAT_COUNT: 2,
  },
  ASSISTANT_BRANCH_HEAD: {
    FD_VALUE: lakh(30),
    SA_COUNT: 3,
    CA_COUNT: 1,
    CASA_VALUE: lakh(10),
    LOAN_VALUE: lakh(25),
    LIFE_INSURANCE_VALUE: lakh(2),
    CARD_COUNT: 2,
  },
  SALES_MANAGER: {
    FD_VALUE: lakh(25),
    SA_COUNT: 6,
    CA_COUNT: 2,
    CASA_VALUE: lakh(10),
    LOAN_VALUE: lakh(20),
    CARD_COUNT: 4,
    SIP_COUNT: 3,
  },
  TRANSACTION_OFFICER: {
    SA_COUNT: 4,
    CASA_VALUE: lakh(4),
    GENERAL_INSURANCE_VALUE: rupees(25_000),
    SIP_COUNT: 2,
    CARD_COUNT: 2,
    DEMAT_COUNT: 2,
  },
};

// The Cluster Head's Affluent Legacy target is per branch, not per person.
const LEGACY_TARGETS: Record<string, number | undefined> = { B01: 8, B02: 4, B03: 6 };

// Branch targets start as the sum of the quotas. These nudges make one branch
// deliberately disagree, so the mismatch warning has something to show.
const ADJUSTMENTS: Record<string, Quotas | undefined> = { B03: { SA_COUNT: 2 } };

const HOLIDAYS = [
  { date: "2026-11-11", name: "Bhai Phota" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
];

async function main() {
  const cluster = await prisma.cluster.findUnique({ where: { name: "Demo Cluster" } });
  if (!cluster) throw new Error("Demo Cluster not found. Run: npm run db:seed:users");

  const clusterHead = await prisma.user.findUnique({ where: { email: "ch@demo.local" } });
  if (!clusterHead) throw new Error("Cluster Head not found. Run: npm run db:seed:users");

  const metrics = await prisma.metric.findMany();
  if (metrics.length === 0) throw new Error("No metrics found. Run: npm run db:seed:catalog");
  const metricByCode = new Map(metrics.map((m) => [m.code, m]));
  const designationByCode = new Map((await prisma.designation.findMany()).map((d) => [d.code, d]));

  const metricOf = (code: string) => {
    const metric = metricByCode.get(code);
    if (!metric) throw new Error(`Unknown metric code: ${code}`);
    return metric;
  };
  const designationOf = (code: string) => {
    const designation = designationByCode.get(code);
    if (!designation) throw new Error(`Unknown designation code: ${code}`);
    return designation;
  };

  // Holidays for the whole cluster. Checked by hand because the unique index ignores NULL branches.
  for (const holiday of HOLIDAYS) {
    const existing = await prisma.holiday.findFirst({
      where: { clusterId: cluster.id, branchId: null, date: holiday.date },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: { date: holiday.date, name: holiday.name, clusterId: cluster.id, addedById: clusterHead.id },
      });
    }
  }

  // Quotas for the whole cluster. Unlike the catalogue seed, re-running this
  // overwrites quantities, because this file is the source of truth for the demo month.
  let quotaCount = 0;
  for (const [designationCode, byMetric] of Object.entries(QUOTAS)) {
    const designation = designationOf(designationCode);
    for (const [metricCode, quantity] of Object.entries(byMetric)) {
      const metric = metricOf(metricCode);
      if (metric.scope === "BRANCH") {
        throw new Error(`${metricCode} is a branch-wide metric and cannot have a quota`);
      }
      await prisma.designationQuota.upsert({
        where: {
          clusterId_designationId_metricId_month: {
            clusterId: cluster.id,
            designationId: designation.id,
            metricId: metric.id,
            month: MONTH,
          },
        },
        update: { quantity: qtyToDb(quantity) },
        create: {
          clusterId: cluster.id,
          designationId: designation.id,
          metricId: metric.id,
          month: MONTH,
          quantity: qtyToDb(quantity),
        },
      });
      quotaCount++;
    }
  }

  // Branch targets: the sum of each branch's quotas, plus the Legacy target.
  const branches = await prisma.branch.findMany({
    where: { clusterId: cluster.id },
    orderBy: { code: "asc" },
  });
  let branchTargetCount = 0;

  for (const branch of branches) {
    const staff = await prisma.user.findMany({
      where: { branchId: branch.id, isActive: true },
      include: { designation: true },
    });
    const headcount = new Map<string, number>();
    for (const person of staff) {
      const code = person.designation.code;
      headcount.set(code, (headcount.get(code) ?? 0) + 1);
    }

    const totals = new Map<string, number>();
    for (const [designationCode, byMetric] of Object.entries(QUOTAS)) {
      const people = headcount.get(designationCode) ?? 0;
      for (const [metricCode, quantity] of Object.entries(byMetric)) {
        totals.set(metricCode, (totals.get(metricCode) ?? 0) + people * quantity);
      }
    }
    for (const [metricCode, extra] of Object.entries(ADJUSTMENTS[branch.code] ?? {})) {
      totals.set(metricCode, (totals.get(metricCode) ?? 0) + extra);
    }
    const legacy = LEGACY_TARGETS[branch.code];
    if (legacy !== undefined) totals.set("AFFLUENT_LEGACY_COUNT", legacy);

    for (const [metricCode, quantity] of totals) {
      if (quantity === 0) continue;
      const metric = metricOf(metricCode);
      await prisma.branchTarget.upsert({
        where: {
          branchId_metricId_month: { branchId: branch.id, metricId: metric.id, month: MONTH },
        },
        update: { quantity: qtyToDb(quantity), setById: clusterHead.id },
        create: {
          branchId: branch.id,
          metricId: metric.id,
          month: MONTH,
          quantity: qtyToDb(quantity),
          setById: clusterHead.id,
        },
      });
      branchTargetCount++;
    }
  }

  console.log(
    `November 2026 ready: ${HOLIDAYS.length} holidays, ${quotaCount} quotas, ` +
      `${branchTargetCount} branch targets across ${branches.length} branches.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });