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

function isSelfCrud(path: string): boolean {
  return path === "/aisworg/seu/route-authority" || path.startsWith("/aisworg/seu/route-authority/")
    || path === "/aisworg/seu/data-migrations" || path.startsWith("/aisworg/seu/data-migrations/");
}

export function routeAuthorityGate() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isSelfCrud(req.path) || isPublic(req.path)) {
      next();
      return;
    }
    const api = apiMode(req.path);
    const found = lookupRouteAuthority(req.method, req.path);

    const rootBypassAllowedNoRow = process.env.NODE_ENV !== "production" && (req.session?.user?.platformBadges ?? []).includes("root");

    if (!found) {
      if (rootBypassAllowedNoRow) {
        next();
        return;
      }
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
