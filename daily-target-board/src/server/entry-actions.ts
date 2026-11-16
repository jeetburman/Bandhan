"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseRupeesToPaise } from "../lib/rupees";
import { getCurrentActor } from "./current-actor";
import { reviewEntry, submitSale } from "./entries";
import { UserFacingError, type ActionState } from "./errors";

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const saleSchema = z.object({
  productCode: z.string().min(1).max(60),
  units: z.coerce.number().int().min(1).max(999),
  amount: z.string().max(25),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(40),
  note: z.string().trim().max(200),
});

export async function submitSaleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const parsed = saleSchema.safeParse({
    productCode: text(formData, "productCode"),
    units: text(formData, "units") || "1",
    amount: text(formData, "amount"),
    activityDate: text(formData, "activityDate"),
    reference: text(formData, "reference"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { error: "Please check the form and try again." };

  let amountPaise: number;
  try {
    amountPaise = parseRupeesToPaise(parsed.data.amount);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount." };
  }

  const selectedOptions: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("opt_") && typeof value === "string" && value !== "") {
      selectedOptions[key.slice(4)] = value;
    }
  }

  try {
    await submitSale(actor, {
      productCode: parsed.data.productCode,
      selectedOptions,
      units: parsed.data.units,
      amountPaise,
      activityDate: parsed.data.activityDate,
      reference: parsed.data.reference || undefined,
      note: parsed.data.note || undefined,
    });
  } catch (error) {
    if (error instanceof UserFacingError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/me");
  revalidatePath("/me/sales");
  revalidatePath("/approvals");
  redirect("/me/sales");
}

const reviewSchema = z.object({
  entryId: z.string().min(1).max(40),
  intent: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(200),
});

export async function reviewEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const parsed = reviewSchema.safeParse({
    entryId: text(formData, "entryId"),
    intent: text(formData, "intent"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { error: "Please check the form and try again." };

  try {
    await reviewEntry(actor, {
      entryId: parsed.data.entryId,
      action: parsed.data.intent === "approve" ? "APPROVE" : "REJECT",
      reason: parsed.data.reason || undefined,
    });
  } catch (error) {
    if (error instanceof UserFacingError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

    revalidatePath("/approvals");
    revalidatePath("/me");
    revalidatePath("/me/sales");
    return { error: null };
}