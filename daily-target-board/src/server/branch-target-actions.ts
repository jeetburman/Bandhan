"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { parseTargetText } from "../lib/parse-target";
import { changeBranchTargets, type BranchTargetChangeRequest } from "./branch-targets";
import { getCurrentActor } from "./current-actor";
import { UserFacingError, type ActionState } from "./errors";

const headerSchema = z.object({
  branchCode: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
  note: z.string().trim().max(200),
});

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function saveBranchTargetsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const header = headerSchema.safeParse({
    branchCode: text(formData, "branchCode"),
    note: text(formData, "note"),
  });
  if (!header.success) return { error: "Please check the form and try again." };

  const metrics = await db.metric.findMany({ where: { isActive: true } });
  const changes: BranchTargetChangeRequest[] = [];

  for (const metric of metrics) {
    const raw = formData.get(`t_${metric.code}`);
    const was = formData.get(`was_${metric.code}`);
    if (typeof raw !== "string" || typeof was !== "string") continue;
    if (!/^\d{1,15}$/.test(was)) return { error: "Please reload the page and try again." };

    let value: number;
    try {
      value = parseTargetText(metric.unit, raw);
    } catch (error) {
      return {
        error: `${metric.name}: ${error instanceof Error ? error.message : "enter a valid number."}`,
      };
    }
    if (value !== Number(was)) {
      changes.push({ metricCode: metric.code, expectedCurrent: Number(was), newTotal: value });
    }
  }

  try {
    await changeBranchTargets(actor, {
      branchCode: header.data.branchCode,
      changes,
      note: header.data.note || undefined,
    });
  } catch (error) {
    if (error instanceof UserFacingError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  const code = header.data.branchCode;
  revalidatePath("/cluster");
  revalidatePath(`/cluster/${code}`);
  revalidatePath(`/cluster/targets/${code}`);
  revalidatePath("/branch");
  revalidatePath("/branch/targets");
  redirect(`/cluster/targets/${code}?saved=1`);
}