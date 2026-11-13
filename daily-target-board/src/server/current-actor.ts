import { cache } from "react";
import { auth } from "@/auth";
import { loadActorById } from "./actor";
import type { Actor } from "./permissions";

/**
 * Who is signed in right now, re-read from the database on every request.
 * The login token only carries the user id, so a deactivated user or a changed
 * role takes effect immediately. Every page and every server action starts here.
 */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ? loadActorById(id) : null;
});