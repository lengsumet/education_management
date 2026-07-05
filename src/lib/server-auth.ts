import "server-only";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

/**
 * Read the logged-in user's role from the auth-token cookie on the server.
 * Used by the role-agnostic page resolvers (e.g. app/dashboard/page.tsx) to
 * decide which role variant to render. Middleware has already guaranteed a
 * valid session by the time these pages run, so a null here is the rare
 * token-expired-mid-request case and the caller redirects to login.
 */
export async function getRole(): Promise<"student" | "teacher" | "admin" | null> {
  const token = (await cookies()).get("auth-token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.role ?? null;
}
