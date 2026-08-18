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
      // CR-004 — the actor's home (Platform | Tenant + tenant_id), set by
      // buildSessionUser() but missing from this ambient type until now (Pack
      // ownership visibility, owner: "Packs will have ownership... platform
      // or the tenant" — the first real consumer).
      type?: "Platform" | "Tenant" | null;
      tenant_id?: string | null;
    };
    flash?: unknown;
    _t?: number;
  }
}
