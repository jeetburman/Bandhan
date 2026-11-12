import { PrismaClient } from "@prisma/client";
import { CATEGORIES, METRICS, PRODUCTS, type CreditRuleSeed } from "./catalog-data";

const prisma = new PrismaClient();

// Sort order follows the order in the data file, in steps of 10 so rows can be slotted in later.
const order = (index: number) => (index + 1) * 10;

/**
 * Loads the catalogue. Safe to run repeatedly:
 * - it only ADDS rows that are missing
 * - it never overwrites or deletes anything, so edits made in Prisma Studio or a
 *   future catalogue screen survive a re-run
 */
async function main() {
  const metricIds = new Map<string, string>();
  for (const [i, m] of METRICS.entries()) {
    const row = await prisma.metric.upsert({
      where: { code: m.code },
      update: {},
      create: {
        code: m.code,
        name: m.name,
        unit: m.unit,
        scope: m.scope,
        pacing: m.pacing,
        sortOrder: order(i),
      },
    });
    metricIds.set(m.code, row.id);
  }

  const metricId = (code: string): string => {
    const id = metricIds.get(code);
    if (!id) throw new Error(`Unknown metric code in catalogue data: ${code}`);
    return id;
  };

  const categoryIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.productCategory.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, sortOrder: order(i) },
    });
    categoryIds.set(c.code, row.id);
  }

  let groupCount = 0;
  let optionCount = 0;

  for (const [pi, p] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Unknown category code in catalogue data: ${p.category}`);

    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, categoryId, sortOrder: order(pi) },
    });

    for (const credit of p.credits) {
      await upsertProductCredit(product.id, credit);
    }

    for (const [gi, g] of (p.groups ?? []).entries()) {
      const group = await prisma.productOptionGroup.upsert({
        where: { productId_code: { productId: product.id, code: g.code } },
        update: {},
        create: {
          productId: product.id,
          code: g.code,
          name: g.name,
          isRequired: g.isRequired ?? true,
          sortOrder: order(gi),
        },
      });
      groupCount++;

      for (const [oi, o] of g.options.entries()) {
        const option = await prisma.productOption.upsert({
          where: { groupId_code: { groupId: group.id, code: o.code } },
          update: {},
          create: {
            groupId: group.id,
            code: o.code,
            name: o.name,
            section: o.section,
            sortOrder: order(oi),
          },
        });
        optionCount++;

        for (const credit of o.credits ?? []) {
          await prisma.optionMetric.upsert({
            where: {
              optionId_metricId: { optionId: option.id, metricId: metricId(credit.metricCode) },
            },
            update: {},
            create: {
              optionId: option.id,
              metricId: metricId(credit.metricCode),
              basis: credit.basis,
            },
          });
        }
      }
    }
  }

  async function upsertProductCredit(productId: string, credit: CreditRuleSeed) {
    await prisma.productMetric.upsert({
      where: { productId_metricId: { productId, metricId: metricId(credit.metricCode) } },
      update: {},
      create: { productId, metricId: metricId(credit.metricCode), basis: credit.basis },
    });
  }

  console.log(
    `Catalogue ready: ${METRICS.length} metrics, ${CATEGORIES.length} categories, ` +
      `${PRODUCTS.length} products, ${groupCount} option groups, ${optionCount} options.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });