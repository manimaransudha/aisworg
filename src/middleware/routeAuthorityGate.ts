// CR-110 — the global route-authority gate. Mounted once in app.js, after
// the session/auth gatekeeper and before every router: replaces the ~237
// individual requireBadge/requireRole call sites (and the hand-rolled
// requireAuthorityAdmin/requireOntologyAdmin gates) with one lookup into
// route_authority (routeAuthorityCache.ts), keyed by the incoming request's
// own method + path matched against each row's path-to-regexp pattern.
//
// Settled design (design/route-authority-decisions.md):
// - Generic denial message for everyone, no more per-route wording —
//   "You are not authorised for this action."
// - Web mode: safeBack() (Referer-based back-redirect) + flash. API mode
//   (/aisworg/api/... prefix): plain JSON 403, same message.
// - A request whose method+path matches no row at all fails closed (deny +
//   loud log) — safe now that migration 261's backfill covers every live
//   route; a genuinely new route with no row is a config gap, not a route
//   this gate should let through unchecked.
// - Root bypasses everything outside production (dev/test convenience,
//   same NODE_ENV gate requireBadge/requireRole always used). Superuser
//   (participants_master.authorised_role) bypasses role checks in
//   production too, same as requireRole always did.
// - A row with empty badges[] and empty roles[] is a real, explicit "no
//   requirement" declaration — passes without even needing a session user
//   (gatekeeper has already handled authentication for anything not on its
//   own public list; a route with a real requirement here is guaranteed to
//   have a session user by the time it reaches this gate).
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { flashError } from "../utils/flash.js";
import { safeBack } from "./safeBack.js";
import { resolveHeldBadges } from "../domain/identity/heldBadges.js";
import { resolveHeldRoles } from "../domain/identity/heldRoles.js";
import { lookupRouteAuthority } from "../domain/identity/routeAuthorityCache.js";
import { isPublic } from "./gatekeeper.js";

const DENY_MESSAGE = "You are not authorised for this action.";

function apiMode(path: string): boolean {
  return path.startsWith("/aisworg/api/");
}

function deny(req: Request, res: Response, api: boolean, reason: string): void {
  logger.warn(`[routeAuthorityGate] ${req.session?.user?.email ?? "(no session)"} denied ${req.method} ${req.path} — ${reason}`);
  if (api) {
    res.status(403).json({ success: false, message: DENY_MESSAGE });
    return;
  }
  flashError(req, res, safeBack(req), DENY_MESSAGE);
}

// The table's own CRUD screen keeps its own literal env-var badge check
// (routeAuthorityRegistry.ts's `gate`) as the sole authority over itself —
// the one deliberate exception (design decision #4). This global gate skips
// these paths entirely rather than also enforcing whatever row happens to
// exist for them, so changing ROUTE_AUTHORITY_ADMIN_BADGE away from its
// `root` default isn't silently overridden by a stale table row.
//
// gatekeeper.js's own isPublic() (favicon/css/js/images/fonts/auth) is
// reused here too: those paths were never meant to be authority-gated
// "actions", and denying them here (fail-closed, no route_authority row)
// planted a stray flash message that then surfaced on the user's next,
// unrelated page render.
function isSelfCrud(path: string): boolean {
  return path === "/aisworg/seu/route-authority" || path.startsWith("/aisworg/seu/route-authority/");
}

export function routeAuthorityGate() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isSelfCrud(req.path) || isPublic(req.path)) {
      next();
      return;
    }
    const api = apiMode(req.path);
    const found = lookupRouteAuthority(req.method, req.path);

    if (!found) {
      deny(req, res, api, "no route_authority row for this method+path");
      return;
    }

    const { badges, roles, matchMode } = found;
    if (badges.length === 0 && roles.length === 0) {
      next();
      return;
    }

    const user = req.session?.user;
    if (!user) {
      // Defensive only — gatekeeper already requires a session for any
      // route not on its own public list, so a real requirement here
      // should never see an anonymous request.
      if (api) {
        res.status(401).json({ success: false, message: "Session expired — please log in again." });
        return;
      }
      res.redirect("/aisworg/login");
      return;
    }

    const rootBypassAllowed = process.env.NODE_ENV !== "production";
    const isRootBadge = (user.platformBadges ?? []).includes("root");

    if (badges.length > 0 && !(isRootBadge && rootBypassAllowed)) {
      const held = await resolveHeldBadges(req);
      const satisfied = matchMode === "any" ? badges.some((b) => held.has(b)) : badges.every((b) => held.has(b));
      if (!(satisfied || (held.isRoot && rootBypassAllowed))) {
        deny(req, res, api, `missing badge(s) [${badges.join(", ")}]`);
        return;
      }
    }

    if (roles.length > 0 && !(isRootBadge && rootBypassAllowed)) {
      const heldRoles = await resolveHeldRoles(user.id, {});
      const satisfied = matchMode === "any" ? roles.some((r) => heldRoles.has(r)) : roles.every((r) => heldRoles.has(r));
      if (!(satisfied || heldRoles.isSuperuser)) {
        deny(req, res, api, `missing role(s) [${roles.join(", ")}]`);
        return;
      }
    }

    next();
  };
}
