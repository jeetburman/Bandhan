import { db } from "../lib/db";
import type { Actor } from "./permissions";

/** Development stand-in for "who is signed in". Real login replaces this. */
export async function loadActor(email: string): Promise<Actor> {
  const user = await db.user.findUnique({ where: { email }, include: { designation: true } });
  if (!user || !user.isActive) throw new Error(`Unknown or inactive user: ${email}`);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.designation.role,
    clusterId: user.clusterId,
    branchId: user.branchId,
  };
}