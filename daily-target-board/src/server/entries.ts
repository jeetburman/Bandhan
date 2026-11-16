import type { Prisma, ProgressEntry } from "@prisma/client";
import { computeCredits } from "../domain/credits/credits";
import {
  checkActivityDate,
  initialStatus,
  nextStatus,
  type EntryStatus,
  type ReviewAction,
  type ReviewLevel,
} from "../domain/entries/workflow";
import { db } from "../lib/db";
import { istBusinessDate } from "../lib/ist";
import { formatRupees } from "../lib/money";
import { qtyFromDb, qtyToDb } from "../lib/qty";
import { writeAudit } from "./audit";
import { loadCatalogProduct, summariseOptions } from "./catalog";
import { canSubmitEntry, handledWhere, queueWhere, reviewLevelFor } from "./entry-policy";
import { UserFacingError } from "./errors";
import type { Actor } from "./permissions";

export interface SubmitSaleInput {
  productCode: string;
  /** Chosen option per group, e.g. { VARIANT: "ELITE" }. */
  selectedOptions: Record<string, string>;
  units: number;
  amountPaise: number;
  activityDate: string;
  reference?: string;
  note?: string;
}

export interface EntryView {
  id: string;
  productName: string;
  optionSummary: string | null;
  units: number;
  amountPaise: number;
  activityDate: string;
  reference: string | null;
  note: string | null;
  status: EntryStatus;
  rejectionReason: string | null;
  submittedAt: Date;
}

export interface QueueItem extends EntryView {
  sellerName: string;
  sellerDesignation: string;
  /** FIRST for a supervisor's provisional approval, FINAL for a branch manager's verification. */
  level: ReviewLevel;
}

/** Turn a domain error (a plain Error with a readable message) into one that is safe to show. */
function userFacing<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    throw new UserFacingError(error instanceof Error ? error.message : "Please check the entry.");
  }
}

function toView(row: ProgressEntry): EntryView {
  return {
    id: row.id,
    productName: row.productName,
    optionSummary: row.optionSummary,
    units: row.units,
    amountPaise: qtyFromDb(row.amountPaise),
    activityDate: row.activityDate,
    reference: row.reference,
    note: row.note,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
  };
}

/** Does this person's sale need approval before it counts? (The ABH's does not.) */
export async function requiresApproval(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { designation: true } });
  return user?.designation.requiresVerification ?? true;
}

export async function submitSale(
  actor: Actor,
  input: SubmitSaleInput,
  now: Date = new Date(),
): Promise<{ entryId: string; status: EntryStatus; autoVerified: boolean }> {
  if (!canSubmitEntry(actor) || actor.branchId === null) {
    throw new UserFacingError("Your role does not record sales.");
  }
  const branchId = actor.branchId;

  userFacing(() => checkActivityDate(input.activityDate, istBusinessDate(now)));

  const loaded = await loadCatalogProduct(input.productCode);
  if (!loaded) throw new UserFacingError("That product does not exist.");

  // What each metric is credited is fixed now and stored with the entry.
  const credits = userFacing(() =>
    computeCredits(loaded.product, {
      selectedOptions: input.selectedOptions,
      units: input.units,
      amountPaise: input.amountPaise,
    }),
  );

  const [metrics, user] = await Promise.all([
    db.metric.findMany({ where: { code: { in: credits.map((c) => c.metricCode) } } }),
    db.user.findUnique({ where: { id: actor.id }, include: { designation: true } }),
  ]);
  if (!user) throw new UserFacingError("Your account could not be found.");
  const metricIdByCode = new Map(metrics.map((m) => [m.code, m.id]));

  const { status, autoVerified } = initialStatus(user.designation.requiresVerification);
  const optionSummary = summariseOptions(loaded, input.selectedOptions);

  const entry = await db.$transaction(async (tx) => {
    const created = await tx.progressEntry.create({
      data: {
        branchId,
        userId: actor.id,
        productId: loaded.productId,
        productName: loaded.productName,
        optionSummary: optionSummary || null,
        selectedOptions: input.selectedOptions as Prisma.InputJsonValue,
        activityDate: input.activityDate,
        units: input.units,
        amountPaise: qtyToDb(input.amountPaise),
        reference: input.reference || null,
        note: input.note || null,
        status,
        autoVerified,
        submittedAt: now,
        decidedAt: autoVerified ? now : null,
        credits: {
          create: credits.map((credit) => {
            const metricId = metricIdByCode.get(credit.metricCode);
            if (!metricId) throw new Error(`Metric ${credit.metricCode} is missing`);
            return { metricId, quantity: qtyToDb(credit.quantity) };
          }),
        },
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      branchId,
      action: autoVerified ? "ENTRY_AUTO_VERIFIED" : "ENTRY_SUBMITTED",
      entityType: "ProgressEntry",
      entityId: created.id,
      summary:
        `${actor.name} recorded ${loaded.productName}${optionSummary ? ` (${optionSummary})` : ""}` +
        ` for ${input.activityDate}`,
      metadata: {
        productCode: input.productCode,
        units: input.units,
        amountPaise: input.amountPaise,
        status,
      },
    });
    return created;
  });

  return { entryId: entry.id, status, autoVerified };
}

export interface ReviewInput {
  entryId: string;
  action: ReviewAction;
  reason?: string;
}

export async function reviewEntry(
  actor: Actor,
  input: ReviewInput,
  now: Date = new Date(),
): Promise<{ status: EntryStatus }> {
  // The same answer whether the entry is missing or belongs to another branch,
  // so nobody can probe for entries outside their own branch.
  const notFound = () => new UserFacingError("That entry was not found.");

  const entry = await db.progressEntry.findUnique({
    where: { id: input.entryId },
    include: { user: true },
  });
  if (!entry) throw notFound();

  const level = reviewLevelFor(actor, {
    branchId: entry.branchId,
    sellerId: entry.userId,
    sellerReportsToId: entry.user.reportsToId,
  });
  if (level === null) throw notFound();

  const reason = input.reason?.trim() ?? "";
  if (input.action === "REJECT" && (reason.length < 3 || reason.length > 200)) {
    throw new UserFacingError("Please give a reason for rejecting (3 to 200 characters).");
  }

  let next: EntryStatus;
  try {
    next = nextStatus(entry.status, level, input.action);
  } catch {
    throw new UserFacingError("This entry has already been handled.");
  }
  const finished = next === "VERIFIED" || next === "REJECTED";

  await db.$transaction(async (tx) => {
    // Only moves the entry if nobody else has changed it since we looked.
    const moved = await tx.progressEntry.updateMany({
      where: { id: entry.id, status: entry.status },
      data: {
        status: next,
        decidedAt: finished ? now : null,
        rejectionReason: next === "REJECTED" ? reason : null,
      },
    });
    if (moved.count !== 1) throw new UserFacingError("Someone else has just handled this entry.");

    await tx.approval.create({
      data: {
        entryId: entry.id,
        level,
        decision: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
        byId: actor.id,
        reason: input.action === "REJECT" ? reason : null,
        at: now,
      },
    });

    const outcome =
      next === "VERIFIED" ? "verified" : next === "REJECTED" ? "rejected" : "approved (first level)";
    await writeAudit(tx, {
      actorId: actor.id,
      branchId: entry.branchId,
      action: next === "VERIFIED" ? "ENTRY_VERIFIED" : next === "REJECTED" ? "ENTRY_REJECTED" : "ENTRY_APPROVED",
      entityType: "ProgressEntry",
      entityId: entry.id,
      summary: `${actor.name} ${outcome} ${entry.productName} recorded by ${entry.user.name}`,
      metadata: { level, from: entry.status, to: next, reason: reason || undefined },
    });
  });

  return { status: next };
}

/** A person's own sales, newest first. */
export async function listMyEntries(actor: Actor, limit = 30): Promise<EntryView[]> {
  const rows = await db.progressEntry.findMany({
    where: { userId: actor.id },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });
  return rows.map(toView);
}

/** Entries waiting for this person to review, oldest first. Empty for roles with no queue. */
export async function listQueue(actor: Actor): Promise<QueueItem[]> {
  const where = queueWhere(actor);
  if (!where) return [];

  const rows = await db.progressEntry.findMany({
    where,
    orderBy: { submittedAt: "asc" },
    take: 100,
    include: { user: { include: { designation: true } } },
  });

  const items: QueueItem[] = [];
  for (const row of rows) {
    // The query already filtered. This checks again with the same rule as the review itself.
    const level = reviewLevelFor(actor, {
      branchId: row.branchId,
      sellerId: row.userId,
      sellerReportsToId: row.user.reportsToId,
    });
    if (level === null) continue;
    items.push({
      ...toView(row),
      sellerName: row.user.name,
      sellerDesignation: row.user.designation.name,
      level,
    });
  }
  return items;
}

/** How many entries are waiting for this person, or null if their role has no queue. */
export async function countQueue(actor: Actor): Promise<number | null> {
  const where = queueWhere(actor);
  return where ? db.progressEntry.count({ where }) : null;
}

export { formatRupees };

export interface HandledItem {
  approvalId: string;
  entry: EntryView;
  sellerName: string;
  sellerDesignation: string;
  level: ReviewLevel;
  decision: "APPROVED" | "REJECTED";
  reviewerName: string;
  at: Date;
  reason: string | null;
}

/** Recent approve and reject decisions this person is allowed to look back on. */
export async function listHandled(actor: Actor, limit = 15): Promise<HandledItem[]> {
  const where = handledWhere(actor);
  if (!where) return [];

  const rows = await db.approval.findMany({
    where,
    orderBy: { at: "desc" },
    take: limit,
    include: { by: true, entry: { include: { user: { include: { designation: true } } } } },
  });

  return rows.map((row) => ({
    approvalId: row.id,
    entry: toView(row.entry),
    sellerName: row.entry.user.name,
    sellerDesignation: row.entry.user.designation.name,
    level: row.level,
    decision: row.decision,
    reviewerName: row.by.name,
    at: row.at,
    reason: row.reason,
  }));
}