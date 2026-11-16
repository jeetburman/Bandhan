import Link from "next/link";
import { countQueue } from "@/server/entries";
import type { Actor } from "@/server/permissions";

/** Shown only to people who have an approval list. The Cluster Head never sees it. */
export async function ApprovalsLink({ actor }: { actor: Actor }) {
  const count = await countQueue(actor);
  if (count === null) return null;

  return (
    <Link href="/approvals" className="font-medium">
      Approvals{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}