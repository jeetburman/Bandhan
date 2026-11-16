import type { Prisma } from "@prisma/client";
import type { CatalogProduct } from "../domain/credits/credits";
import { db } from "../lib/db";

const productInclude = {
  metricLinks: { include: { metric: true } },
  optionGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: { metricLinks: { include: { metric: true } } },
      },
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface LoadedProduct {
  productId: string;
  productName: string;
  /** The shape the credit calculator needs. */
  product: CatalogProduct;
  /** Names for building a readable summary of the chosen options. */
  groups: { code: string; name: string; options: { code: string; name: string }[] }[];
}

function toLoaded(row: ProductRow): LoadedProduct {
  return {
    productId: row.id,
    productName: row.name,
    product: {
      code: row.code,
      isActive: row.isActive,
      credits: row.metricLinks.map((link) => ({ metricCode: link.metric.code, basis: link.basis })),
      optionGroups: row.optionGroups.map((group) => ({
        code: group.code,
        isRequired: group.isRequired,
        isActive: group.isActive,
        options: group.options.map((option) => ({
          code: option.code,
          isActive: option.isActive,
          credits: option.metricLinks.map((link) => ({
            metricCode: link.metric.code,
            basis: link.basis,
          })),
        })),
      })),
    },
    groups: row.optionGroups.map((group) => ({
      code: group.code,
      name: group.name,
      options: group.options.map((option) => ({ code: option.code, name: option.name })),
    })),
  };
}

export async function loadCatalogProduct(code: string): Promise<LoadedProduct | null> {
  const row = await db.product.findUnique({ where: { code }, include: productInclude });
  return row ? toLoaded(row) : null;
}

/** "Variant: Elite · Source: Renewal" */
export function summariseOptions(
  loaded: Pick<LoadedProduct, "groups">,
  selected: Readonly<Record<string, string>>,
): string {
  const parts: string[] = [];
  for (const group of loaded.groups) {
    const code = selected[group.code];
    if (code === undefined) continue;
    const option = group.options.find((candidate) => candidate.code === code);
    parts.push(`${group.name}: ${option?.name ?? code}`);
  }
  return parts.join(" · ");
}

// ---------- The catalogue as the entry form needs it ----------

export interface FormOption {
  code: string;
  name: string;
  section: string | null;
}
export interface FormGroup {
  code: string;
  name: string;
  isRequired: boolean;
  options: FormOption[];
}
export interface FormProduct {
  code: string;
  name: string;
  needsUnits: boolean;
  needsAmount: boolean;
  groups: FormGroup[];
}
export interface FormCategory {
  code: string;
  name: string;
  products: FormProduct[];
}

export async function listCatalogForForm(): Promise<FormCategory[]> {
  const categories = await db.productCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: productInclude,
      },
    },
  });

  return categories
    .map((category): FormCategory => ({
      code: category.code,
      name: category.name,
      products: category.products.map((row): FormProduct => {
        const links = [
          ...row.metricLinks,
          ...row.optionGroups.flatMap((g) => g.options.flatMap((o) => o.metricLinks)),
        ];
        return {
          code: row.code,
          name: row.name,
          needsUnits: links.some((link) => link.basis === "UNITS"),
          needsAmount: links.some((link) => link.basis === "AMOUNT"),
          groups: row.optionGroups
            .filter((group) => group.isActive)
            .map((group) => ({
              code: group.code,
              name: group.name,
              isRequired: group.isRequired,
              options: group.options
                .filter((option) => option.isActive)
                .map((option) => ({ code: option.code, name: option.name, section: option.section })),
            })),
        };
      }),
    }))
    .filter((category) => category.products.length > 0);
}