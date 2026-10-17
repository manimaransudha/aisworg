import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { redirectsFor } from "./redirects.js";
import { resolveHeldRoles } from "../domain/identity/heldRoles.js";

const NONE = "None";

export function requireRole(
  roles: string[],
  opts: {
    mode?: "web" | "api";
    denyMessage?: string;
    match?: "all" | "any";
    getSeuId?: (req: Request) => string | null;
  } = {}
) {
  if (roles.length === 0) {
    throw new Error("requireRole(): pass ['None'] to declare no role is required — an empty array is not a valid, reviewable declaration.");
  }
  const required = roles[0] === NONE ? [] : roles;
  const mode = opts.mode ?? "web";
  const match = opts.match ?? "all";
  const rootBypassAllowed = process.env.NODE_ENV !== "production";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (required.length === 0) {
      next();
      return;
    }

    const user = req.session?.user;
    if (!user) {
      if (mode === "api") {
        res.status(401).json({ success: false, message: "Session expired — please log in again." });
        return;
      }
      redirectsFor(req).authfail(req, res, "Session expired — please log in again.");
      return;
    }

    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    if (isRoot && rootBypassAllowed) {
      next();
      return;
    }

    const seuId = opts.getSeuId?.(req) ?? null;
    const heldRoles = await resolveHeldRoles(user.id, { seuId });

    if (heldRoles.isSuperuser) {
      next();
      return;
    }

    const held = heldRoles.roles;
    const satisfied = match === "any" ? required.some((r) => held.has(r)) : required.every((r) => held.has(r));
    if (satisfied) {
      next();
      return;
    }

    logger.warn(`[requireRole] ${user.email} tried ${req.method} ${req.path} — needs [${match === "any" ? "any of " : ""}${required.join(", ")}], held none of it`);
    const message = opts.denyMessage ?? (match === "any"
      ? `You don't hold any of the required role(s) for this action: ${required.join(", ")}.`
      : `You don't hold the required role(s) for this action: ${required.filter((r) => !held.has(r)).join(", ")}.`);
    if (mode === "api") {
      res.status(403).json({ success: false, message });
      return;
    }
    redirectsFor(req).rolefail(req, res, message);
  };
}
