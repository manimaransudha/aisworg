// Ambient augmentation for the session shape auth.js's buildSessionUser()
// actually produces — express-session's own SessionData doesn't know about
// `user`. No runtime effect; only makes req.session.user type-check in new
// TS route files.
import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      name: string;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      // Phase 10 (badge model) — cached at login (buildSessionUser +
      // ensureBadgeBootstrap), not re-derived per request.
      platformBadges?: string[];
    };
    flash?: unknown;
    _t?: number;
  }
}
