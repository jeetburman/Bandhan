"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { getCurrentActor } from "./current-actor";
import type { ActionState } from "./errors";
import { publishPlan } from "./publish-plan";
import { loadEditWindow } from "./target-grid";

/**
 * Publish this month's plan for the signed-in branch manager's branch: the first publish if there
 * is none, otherwise a republish from the next open working day. Employee targets carry over.
 */
export async function publishPlanAction(): Promise<ActionState> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.role !== "BRANCH_MANAGER" || !actor.branchId) {
    return { error: "Only a branch manager can publish the plan." };
  }

  const branch = await db.branch.findUnique({ where: { id: actor.branchId } });
  if (!branch) return { error: "Your branch could not be found." };

  const { today, month, effectiveFrom } = await loadEditWindow(actor.clusterId, branch.id, new Date());
  const existing = await db.targetPlan.count({
    where: { branchId: branch.id, month, status: "PUBLISHED" },
  });
  if (existing > 0 && effectiveFrom === null) {
    return { error: "No working days are left this month, so the plan can't be republished." };
  }

  try {
    await publishPlan({
      branchCode: branch.code,
      month,
      actorEmail: actor.email,
      today,
      effectiveFrom: existing > 0 ? (effectiveFrom ?? undefined) : undefined,
    });
  } catch (error) {
    // Our own checks throw readable messages. Anything from the database is kept out of sight.
    if (error instanceof Error && !error.constructor.name.startsWith("Prisma")) {
      return { error: error.message };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/branch");
  revalidatePath("/branch/targets");
  revalidatePath("/me");
  revalidatePath("/cluster");
  return { error: null };
}