"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function loginAction(
  _previous: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
    return { error: null };
  } catch (error) {
    // The same message for a wrong password, an unknown email and an inactive account.
    if (error instanceof AuthError) return { error: "Wrong email or password." };
    // A successful sign-in redirects by throwing, and that must pass through.
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}