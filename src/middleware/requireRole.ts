// Owner request (2026-09-22): a new requireRole, replacing the MEANING of
// the legacy requireRole (middleware/auth.js, users.role rank) going
// forward — that file's export is left untouched, still imported by every
// existing call site, per explicit instruction not to delete it. New call
// sites use this one.
//
// Backed by participants_master.authorised_role (migration 254) — an array
// of {role, effective_till, seu_ids} grants, orthogonal to the noun_verb
// badge model (requireBadge.ts governs TRANSITION authority; this governs
// standing role-scoped access). role is Ontology-backed (authorised-role).
//
// A role entry is "held" iff: not expired (effective_till >= now) AND
// either its seu_ids is empty (the role applies across every SEU) or, when
// this check is scoped to one SEU (getSeuId given), that SEU's id is
// present in seu_ids. Same AND-by-default / opt-in "any" semantics as
// requireBadge — one function checks one requirement, no per-request branch
// on which role applies (requireBadge's own "split it into one route per
// badge" discipline, reused here for roles).
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
    // Scopes the check to one SEU — an entry whose seu_ids is non-empty
    // only counts when this SEU's id is among them. Omitted: only entries
    // with an empty seu_ids (platform/tenant-wide) count.
    getSeuId?: (req: Request) => string | null;
  } = {}
) {
  if (roles.length === 0) {
    throw new Error("requireRole(): pass ['None'] to declare no role is required — an empty array is not a valid, reviewable declaration.");
  }
  const required = roles[0] === NONE ? [] : roles;
  const mode = opts.mode ?? "web";
  const match = opts.match ?? "all";
  // Dev/test convenience only, same NODE_ENV gate requireBadge/requireRole
  // (legacy) already use — not a production access path.
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

    // Owner: "superuser will have access to everything. atleast for now" —
    // an unscoped-or-not, unexpired `superuser` grant bypasses every
    // requireRole check, production included (unlike the `root` badge
    // bypass above, which is dev/test only).
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
