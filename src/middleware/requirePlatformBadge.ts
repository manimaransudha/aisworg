// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md §11. A new, separate check backed by
// badge_grants — NOT a repurposing of requireRole()/users.role, which stay
// untouched for whatever the rest of the app already uses them for (§5's
// correction). Used only for genuinely platform-administrative SEU surfaces
// (Pack Registry lifecycle at minimum, Identity Management screens).
//
// Flat match — does the actor hold the specific Platform-layer badge, cached
// in req.session.user.platformBadges at login. No rank comparison (§3/§6
// goal 8: badges are flat by default).
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { effectivePlatformBadges } from "../dev/actAs.js";

export function requirePlatformBadge(badgeCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session?.user as { email?: string; platformBadges?: string[] } | undefined;
    if (!user) {
      if (req.method !== "GET") {
        res.status(401).json({ success: false, message: "Session expired — please log in again." });
        return;
      }
      res.redirect("/aisworg/login");
      return;
    }

    // CR-001: effective badges drop `root` when the god user acts-as a
    // non-root badge (dev switcher only); null otherwise → true session
    // badges, so production behaviour is unchanged.
    const held = effectivePlatformBadges(req) ?? user.platformBadges ?? [];

    // ─── TESTING BYPASS — remove this block to revert ───────────────────────
    // For testing convenience only, not part of the design: root passes any
    // Platform-badge check, not just a literal "root" requirement, the same
    // way §11a already lets root satisfy any Engineering-badge check. Delete
    // this block to go back to a flat, exact badgeCode match.
    if (held.includes("root")) {
      next();
      return;
    }
    // ─── end testing bypass ──────────────────────────────────────────────────

    if (held.includes(badgeCode)) {
      next();
      return;
    }

    logger.warn(`[requirePlatformBadge] ${user.email} tried to access ${req.path} — needs Platform badge "${badgeCode}", holds [${held.join(", ")}]`);
    if (req.method !== "GET") {
      res.status(403).json({ success: false, message: "You don't have the required Platform badge for this action." });
      return;
    }
    // A silent redirect-to-referer here reads as "the link did nothing" —
    // set a flash message the same way requireRole() does, so a denial is
    // always visible, not just logged.
    if (req.session) {
      (req.session as unknown as { flash?: { type: string; message: string } }).flash = {
        type: "error",
        message: `You don't have the required Platform badge ("${badgeCode}") for that.`,
      };
    }
    const back = req.headers.referer || "/aisworg";
    res.redirect(back);
  };
}
