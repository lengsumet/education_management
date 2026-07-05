/** @type {import('next').NextConfig} */

// Auth-sensitive page routes. no-store keeps them out of the browser's bfcache
// and disk cache, so pressing Back always issues a fresh request that re-runs
// middleware.ts (which re-decides auth). The default `no-cache` does NOT prevent
// bfcache — Chrome could restore a logged-out login form for a logged-in user
// (and vice-versa) on Back. Static assets under /_next are untouched (still
// cacheable) because they are not listed here.
const PAGE_ROUTES = [
  "/",
  "/dashboard",
  "/courses",
  "/profile",
  "/registration",
  "/catalog",
  "/course-planner",
  "/graduation-check",
  "/schedule-submit",
  "/makeup-class",
  "/students",
  "/curriculum",
  "/import",
  "/announcements",
  "/users",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const nextConfig = {
  // Don't keep dynamic (auth-gated) routes in the client Router Cache, so a
  // Back/Forward navigation re-fetches from the server and re-runs middleware
  // instead of restoring a stale authed/unauthed page.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
  async headers() {
    return PAGE_ROUTES.map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
    }));
  },
};

export default nextConfig;
