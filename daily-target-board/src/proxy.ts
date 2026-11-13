import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Built from the light config only. Importing auth.ts here would drag the database into the proxy.
const { auth } = NextAuth(authConfig);

// Next.js 16 wants a plain function as the default export (or a named `proxy`).
export default auth;

export const config = {
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico).*)"],
};