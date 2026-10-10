import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { flashError } from "../utils/flash.js";
import { resolveHeldBadges } from "../domain/identity/heldBadges.js";

const NONE = "None";

export function requireBadge(badges: string[], opts: { mode?: "web" | "api"; redirectTo?: string | ((req: Request) => string); denyMessage?: string; match?: "all" | "any" } = {}) {
  if (badges.length === 0) {
    throw new Error("requireBadge(): pass ['None'] to declare no badge is required — an empty array is not a valid, reviewable declaration.");
  }
  const required = badges[0] === NONE ? [] : badges;
  const mode = opts.mode ?? "web";
  const match = opts.match ?? "all";
  const rootBypassAllowed = process.env.NODE_ENV !== "production";
  if (mode === "web" && required.length > 0 && !opts.redirectTo) {
    throw new Error("requireBadge(): redirectTo is required in web mode when a real badge is listed — pass mode: 'api' for a JSON-only router instead.");
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (required.length === 0) return next();

    const user = req.session?.user;
    if (!user) {
      if (mode === "api") {
        res.status(401).json({ success: false, message: "Session expired — please log in again." });
        return;
      }
      res.redirect("/aisworg/login");
      return;
    }

    const held = await resolveHeldBadges(req);
    const satisfied = match === "any" ? required.some((b) => held.badgeTypes.has(b)) : required.every((b) => held.badgeTypes.has(b));
    if ((held.isRoot && rootBypassAllowed) || satisfied) {
      next();
      return;
    }

    logger.warn(`[requireBadge] ${user.email} tried ${req.method} ${req.path} — needs [${match === "any" ? "any of " : ""}${required.join(", ")}], held none of it`);
    const message = opts.denyMessage ?? (match === "any"
      ? `You don't hold any of the required badge(s) for this action: ${required.join(", ")}.`
      : `You don't hold the required badge(s) for this action: ${required.filter((b) => !held.badgeTypes.has(b)).join(", ")}.`);
    if (mode === "api") {
      res.status(403).json({ success: false, message });
      return;
    }
    flashError(req, res, typeof opts.redirectTo === "function" ? opts.redirectTo(req) : (opts.redirectTo as string), message);
  };
}
