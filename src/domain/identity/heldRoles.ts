// Mirrors heldBadges.ts's own consolidation reasoning (CR-076), for roles:
// one shared "which authorised_role entries does this holder currently
// hold" primitive, instead of requireRole.ts and the navbar's own
// route_authority-driven link-visibility check (CR-110) each re-deriving the
// same participants_master.authorised_role query + expiry/scope filter
// independently.
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";

export interface HeldRoles {
  // Owner: "superuser will have access to everything. atleast for now" — an
  // unscoped-or-not, unexpired `superuser` grant bypasses every requireRole
  // check, production included. `has()` short-circuits on it first, so no
  // caller needs `roles` to include it separately.
  isSuperuser: boolean;
  roles: Set<string>;
  has: (role: string) => boolean;
}

function isExpired(effectiveTill: string, now: Date): boolean {
  const till = new Date(effectiveTill);
  return !Number.isNaN(till.getTime()) && till.getTime() < now.getTime();
}

export async function resolveHeldRoles(userId: number | string, opts: { seuId?: string | null } = {}): Promise<HeldRoles> {
  const { data: master } = await participantsMasterDB.findByUserId(Number(userId));
  const now = new Date();
  const activeGrants = (master?.authorised_role ?? []).filter((entry) => !isExpired(entry.effective_till, now));
  const isSuperuser = activeGrants.some((entry) => entry.role === "superuser");
  const seuId = opts.seuId ?? null;
  const roles = new Set(
    activeGrants
      .filter((entry) => entry.seu_ids.length === 0 || (seuId !== null && entry.seu_ids.includes(seuId)))
      .map((entry) => entry.role)
  );
  return { isSuperuser, roles, has: (role: string) => isSuperuser || roles.has(role) };
}
