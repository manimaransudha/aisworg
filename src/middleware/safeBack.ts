import type { Request } from "express";

// A denial that redirects back to Referer loops forever when Referer IS the
// page being denied (e.g. an admin page whose navbar hosts the dev Act-As
// switcher: assuming a lesser badge denies that same page, whose Referer is
// itself). Return the Referer only when it points somewhere OTHER than the
// current request path; otherwise fall back to a page the caller can still
// reach. Used by requireRole and requirePlatformBadge.
export function safeBack(req: Request, fallback = "/aisworg"): string {
  const ref = req.headers.referer;
  if (!ref) return fallback;
  try {
    const base = `${req.protocol}://${req.headers.host ?? "localhost"}`;
    const refPath = new URL(ref, base).pathname;
    const curPath = new URL(req.originalUrl, base).pathname;
    return refPath === curPath ? fallback : ref;
  } catch {
    return fallback;
  }
}
