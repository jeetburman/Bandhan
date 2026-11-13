import type { Designation, User } from "@prisma/client";
import { db } from "../lib/db";
import type { Actor } from "./permissions";

function toActor(user: User & { designation: Designation }): Actor {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.designation.role,
    clusterId: user.clusterId,
    branchId: user.branchId,
  };
}

/** For scripts: look someone up by email. Throws if they are unknown or inactive. */
export async function loadActor(email: string): Promise<Actor> {
  const user = await db.user.findUnique({ where: { email }, include: { designation: true } });
  if (!user || !user.isActive) throw new Error(`Unknown or inactive user: ${email}`);
  return toActor(user);
}

/** For requests: null when the person is missing or has been deactivated. */
export async function loadActorById(id: string): Promise<Actor | null> {
  const user = await db.user.findUnique({ where: { id }, include: { designation: true } });
  if (!user || !user.isActive) return null;
  return toActor(user);
}