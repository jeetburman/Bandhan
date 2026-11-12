import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Synthetic data only. Never reuse a real password here.
const DEMO_PASSWORD = "Demo@12345";

const DESIGNATIONS = [
  { code: "CLUSTER_HEAD", name: "Cluster Head", role: Role.CLUSTER_HEAD, requiresVerification: false },
  { code: "BRANCH_HEAD", name: "Branch Head", role: Role.BRANCH_MANAGER, requiresVerification: false },
  { code: "ASSISTANT_BRANCH_HEAD", name: "Assistant Branch Head", role: Role.BRANCH_MANAGER, requiresVerification: false },
  { code: "SALES_MANAGER", name: "Sales Manager", role: Role.SUPERVISOR, requiresVerification: true },
  { code: "SALES_EXECUTIVE", name: "Sales Executive", role: Role.STAFF, requiresVerification: true },
  { code: "CUSTOMER_RELATION_OFFICER", name: "Customer Relation Officer", role: Role.STAFF, requiresVerification: true },
  { code: "TRANSACTION_OFFICER", name: "Transaction Officer", role: Role.STAFF, requiresVerification: true },
  { code: "AFFLUENT_RELATIONSHIP_MANAGER", name: "Affluent Relationship Manager", role: Role.STAFF, requiresVerification: true },
];

// Headcount varies by branch, like a real cluster.
const BRANCHES = [
  { code: "B01", name: "Demo Branch 1", abh: 2, se: 4, cro: 4, arm: 2 },
  { code: "B02", name: "Demo Branch 2", abh: 1, se: 3, cro: 3, arm: 1 },
  { code: "B03", name: "Demo Branch 3", abh: 2, se: 3, cro: 4, arm: 2 },
];

const designationIds = new Map<string, string>();

function idOf(code: string): string {
  const id = designationIds.get(code);
  if (!id) throw new Error(`Unknown designation: ${code}`);
  return id;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const cluster = await prisma.cluster.upsert({
    where: { name: "Demo Cluster" },
    update: {},
    create: { name: "Demo Cluster" },
  });

  for (const d of DESIGNATIONS) {
    const row = await prisma.designation.upsert({
      where: { code: d.code },
      update: { name: d.name, role: d.role, requiresVerification: d.requiresVerification },
      create: d,
    });
    designationIds.set(d.code, row.id);
  }

  async function upsertUser(input: {
    name: string;
    email: string;
    designation: string;
    branchId: string | null;
    reportsToId: string | null;
    isBranchContact?: boolean;
  }) {
    const data = {
      name: input.name,
      designationId: idOf(input.designation),
      clusterId: cluster.id,
      branchId: input.branchId,
      reportsToId: input.reportsToId,
      isBranchContact: input.isBranchContact ?? false,
      passwordHash,
    };
    return prisma.user.upsert({
      where: { email: input.email },
      update: data,
      create: { email: input.email, ...data },
    });
  }

  const clusterHead = await upsertUser({
    name: "Demo Cluster Head",
    email: "ch@demo.local",
    designation: "CLUSTER_HEAD",
    branchId: null,
    reportsToId: null,
  });

  for (const b of BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: { name: b.name, clusterId: cluster.id },
      create: { code: b.code, name: b.name, clusterId: cluster.id },
    });
    const tag = b.code.toLowerCase();

    const branchHead = await upsertUser({
      name: `Demo Branch Head (${b.code})`,
      email: `bh.${tag}@demo.local`,
      designation: "BRANCH_HEAD",
      branchId: branch.id,
      reportsToId: clusterHead.id,
      isBranchContact: true,
    });

    const salesManager = await upsertUser({
      name: `Demo Sales Manager (${b.code})`,
      email: `sm.${tag}@demo.local`,
      designation: "SALES_MANAGER",
      branchId: branch.id,
      reportsToId: branchHead.id,
    });

    const roster = [
      { designation: "ASSISTANT_BRANCH_HEAD", slug: "abh", label: "Assistant Branch Head", count: b.abh, managerId: branchHead.id },
      { designation: "SALES_EXECUTIVE", slug: "se", label: "Sales Executive", count: b.se, managerId: salesManager.id },
      { designation: "CUSTOMER_RELATION_OFFICER", slug: "cro", label: "CRO", count: b.cro, managerId: branchHead.id },
      { designation: "TRANSACTION_OFFICER", slug: "to", label: "Transaction Officer", count: 1, managerId: branchHead.id },
      { designation: "AFFLUENT_RELATIONSHIP_MANAGER", slug: "arm", label: "Affluent RM", count: b.arm, managerId: branchHead.id },
    ];

    for (const r of roster) {
      for (let i = 1; i <= r.count; i++) {
        await upsertUser({
          name: `Demo ${r.label} ${i} (${b.code})`,
          email: `${r.slug}${i}.${tag}@demo.local`,
          designation: r.designation,
          branchId: branch.id,
          reportsToId: r.managerId,
        });
      }
    }
  }

  // Invariant: a user's cluster must match their branch's cluster.
  const users = await prisma.user.findMany({ include: { branch: true } });
  const mismatched = users.filter((u) => u.branch && u.branch.clusterId !== u.clusterId);
  if (mismatched.length > 0) {
    throw new Error(`Cluster/branch mismatch for ${mismatched.length} user(s)`);
  }

  console.log(`Seeded: ${users.length} users, ${BRANCHES.length} branches, ${DESIGNATIONS.length} designations.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });