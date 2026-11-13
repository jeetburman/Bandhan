import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  // A working day, then sign in again.
  session: { strategy: "jwt", maxAge: 60 * 60 * 10 },
  providers: [],
  callbacks: {
    // Runs in the proxy. This is only a convenience redirect, because the real
    // authorisation happens in server code on every request.
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === "/login") return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;