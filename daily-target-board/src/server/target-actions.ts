"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../lib/db";
import { parseRupeesToPaise } from "../lib/rupees";
import { getCurrentActor } from "./current-actor";
import { UserFacingError, type ActionState } from "./errors";
import { changeEmployeeTargets, type TargetChangeRequest } from "./target-edits";

const headerSchema = z.object({
  userId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
  note: z.string().trim().max(200),
});

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function parseCount(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "") return 0;
  if (!/^\d{1,6}$/.test(cleaned)) throw new Error("enter a whole number.");
  return Number(cleaned);
}

export async function saveTargetsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const header = headerSchema.safeParse({
    userId: text(formData, "userId"),
    note: text(formData, "note"),
  });
  if (!header.success) return { error: "Please check the form and try again." };

  const metrics = await db.metric.findMany({ where: { scope: "INDIVIDUAL", isActive: true } });
  const changes: TargetChangeRequest[] = [];

  for (const metric of metrics) {
    const raw = formData.get(`t_${metric.code}`);
    const was = formData.get(`was_${metric.code}`);
    if (typeof raw !== "string" || typeof was !== "string") continue;
    if (!/^\d{1,15}$/.test(was)) return { error: "Please reload the page and try again." };

    let value: number;
    try {
      value = metric.unit === "AMOUNT" ? parseRupeesToPaise(raw) : parseCount(raw);
    } catch (error) {
      return { error: `${metric.name}: ${error instanceof Error ? error.message : "enter a valid number."}` };
    }
    if (value !== Number(was)) {
      changes.push({ metricCode: metric.code, expectedCurrent: Number(was), newTotal: value });
    }
  }

  try {
    await changeEmployeeTargets(actor, {
      userId: header.data.userId,
      changes,
      note: header.data.note || undefined,
    });
  } catch (error) {
    if (error instanceof UserFacingError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/branch/targets");
  revalidatePath(`/branch/targets/${header.data.userId}`);
  revalidatePath("/me");
  redirect(`/branch/targets?saved=${header.data.userId}`);
}