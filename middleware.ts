import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Server-side auth gate. Runs in the Edge runtime BEFORE any page renders, so a
 * logged-out user never receives protected HTML (no flash / stuck loader / back
 * button leak) and a logged-in user never sees the login form.
 *
 * URLs are role-agnostic (/dashboard, /courses, /users, ...). Because the role
 * is no longer in the path, per-route access is enforced by ROUTE_ROLES below
 * instead of comparing a URL segment to the token role.
 *
 * NOTE: do not import from "@/lib/auth" here — it pulls in bcryptjs/crypto which
 * are not available in the Edge runtime. jose is edge-safe; verify the JWT inline
 * with the same secret used to sign it (must stay in sync with src/lib/auth.ts).
 */
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-insecure-secret-change-me"
);

const PUBLIC_PATHS = ["/", "/register", "/forgot-password", "/reset-password"];

// Which roles may open each protected top-level route.
const ROUTE_ROLES: Record<string, string[]> = {
  "/dashboard": ["student", "teacher", "admin"],
  "/courses": ["student", "teacher", "admin"],
  "/profile": ["student", "teacher"],
  "/registration": ["student", "admin"],
  "/catalog": ["student"],
  "/course-planner": ["student"],
  "/graduation-check": ["student"],
  "/schedule-submit": ["student"],
  "/schedule": ["teacher"],
  "/makeup-class": ["teacher", "student"],
  "/students": ["teacher"],
  "/curriculum": ["admin"],
  "/import": ["admin"],
  "/announcements": ["admin"],
  "/users": ["admin"],
};

async function readSession(token?: string): Promise<{ role: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const role = (payload as { role?: string }).role;
    return role ? { role } : null;
  } catch {
    return null; // invalid / expired token
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req.cookies.get("auth-token")?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Not logged in on a protected page -> login
  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Logged in but sitting on the login page -> dashboard
  if (pathname === "/" && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Logged in but not allowed on this route -> dashboard
  if (!isPublic && session) {
    const base = "/" + pathname.split("/")[1];
    const allowed = ROUTE_ROLES[base];
    if (allowed && !allowed.includes(session.role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // no-store keeps auth-sensitive pages out of the browser's bfcache/disk cache.
  // The default `no-cache` still lets Chrome restore a page from the bfcache on
  // Back WITHOUT re-running middleware — which showed a logged-out login form to
  // a logged-in user (and vice-versa). With no-store, Back forces a fresh request
  // so this middleware always re-decides. This is the reliable fix; the client
  // pageshow reload is only a secondary backstop.
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  // Run on all pages except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
