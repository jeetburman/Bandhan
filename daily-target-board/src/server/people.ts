import { db } from "../lib/db";
import type { Actor } from "./permissions";
import { userWhere, visibilityScope } from "./policy";

export interface VisiblePerson {
  id: string;
  name: string;
  designation: string;
  branchCode: string | null;
}

/** Everyone this person is allowed to see. The filter comes from the policy module. */
export async function listVisiblePeople(actor: Actor): Promise<VisiblePerson[]> {
  const rows = await db.user.findMany({
    where: { AND: [{ isActive: true }, userWhere(visibilityScope(actor))] },
    include: { designation: true, branch: true },
    orderBy: [{ branch: { code: "asc" } }, { designation: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    designation: row.designation.name,
    branchCode: row.branch?.code ?? null,
  }));
}