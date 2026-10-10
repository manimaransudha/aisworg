import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { flashError } from "../utils/flash.js";
import { resolveHeldRoles } from "../domain/identity/heldRoles.js";

const NONE = "None";

export function requireRole(
  roles: string[],
  opts: {
    mode?: "web" | "api";
    redirectTo?: string | ((req: Request) => string);
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
  if (mode === "web" && required.length > 0 && !opts.redirectTo) {
    throw new Error("requireRole(): redirectTo is required in web mode when a real role is listed — pass mode: 'api' for a JSON-only router instead.");
  }

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
      res.redirect("/aisworg/login");
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
    flashError(req, res, typeof opts.redirectTo === "function" ? opts.redirectTo(req) : (opts.redirectTo as string), message);
  };
}
