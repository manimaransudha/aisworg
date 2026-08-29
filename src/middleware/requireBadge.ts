// CR-076 (owner: "every route has to be gated with a requireBadge... a view
// router can be requireBadge['None'] which should mean No badge is required
// to get to this route execution. requireBadge['Active','Reject'] implies
// the router needs someone to have Active and Reject badges") — the generic
// gate for the noun_verb vocabulary (CR-006), parallel to (not a replacement
// for) requirePlatformBadge's own fixed, 3-code Platform vocabulary.
//
// AND semantics (owner, settled): every badge listed is required, no
// built-in "any one of" shape. A route that would need a DIFFERENT badge
// depending on the request is a design smell, not a case for this to
// accommodate (owner: "One function cannot do multiple things requiring
// different badges. They have to be split") — split it into one route per
// badge instead.
//
// requireBadge(['None']) is a real, positive declaration, not merely the
// absence of one — every route writes SOMETHING here, so "no badge needed"
// is a decision a reviewer can see was made on purpose, not an omission.
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { flashError } from "../utils/flash.js";
import { resolveHeldBadges } from "../domain/identity/heldBadges.js";

const NONE = "None";

// mode is explicit, never inferred from req.method — "non-GET means AJAX"
// (requirePlatformBadge's own heuristic) is wrong for a router built entirely
// of plain <form method="POST"> submissions (every route in web/objectives.ts,
// confirmed: no fetch/AJAX anywhere in its POSTs), where even a POST denial
// must redirect + flash, never return raw JSON to a full-page form submit.
// "web" (default): always redirect + flash, regardless of method — matches
// every current caller. "api": always JSON, regardless of method — for a
// real JSON API router (routes/seu/api/*), where even a GET denial must
// never redirect (there's no page to redirect to).
//
// redirectTo is a REQUIRED, explicit target in web mode (string, or a
// function of the request for a per-:id page) — found the hard way that
// requirePlatformBadge's own Referer-based safeBack() fallback is exactly
// the wrong mechanism for a "mandatory, predictable, reviewable" gate: with
// no Referer header (any direct request — curl, a bookmark, an HTTP test),
// it silently falls through to the generic /aisworg homepage instead of
// somewhere sensible, same failure mode requireTenantScope's own explicit
// notFoundRedirect was already built to avoid. Missing it is a config error,
// not a silent default — same fail-fast discipline as requireTenantScope's
// own notFoundRedirect check.
//
// denyMessage is optional — several routes converted to this middleware had
// their own bespoke pre-existing wording (e.g. "...to add Objectives.",
// "...to edit Objectives.") from their old inline flashError calls; the
// generic default only applies where no route ever had bespoke wording to
// begin with (every newly-added check this CR introduced).
export function requireBadge(badges: string[], opts: { mode?: "web" | "api"; redirectTo?: string | ((req: Request) => string); denyMessage?: string } = {}) {
  if (badges.length === 0) {
    throw new Error("requireBadge(): pass ['None'] to declare no badge is required — an empty array is not a valid, reviewable declaration.");
  }
  const required = badges[0] === NONE ? [] : badges;
  const mode = opts.mode ?? "web";
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
    if (held.isRoot || required.every((b) => held.badgeTypes.has(b))) {
      next();
      return;
    }

    const missing = required.filter((b) => !held.badgeTypes.has(b));
    logger.warn(`[requireBadge] ${user.email} tried ${req.method} ${req.path} — needs [${required.join(", ")}], missing [${missing.join(", ")}]`);
    const message = opts.denyMessage ?? `You don't hold the required badge(s) for this action: ${missing.join(", ")}.`;
    if (mode === "api") {
      res.status(403).json({ success: false, message });
      return;
    }
    flashError(req, res, typeof opts.redirectTo === "function" ? opts.redirectTo(req) : (opts.redirectTo as string), message);
  };
}
