import { logger } from '../utils/logger.js';
import { effectivePlatformBadges } from '../dev/actAs.js';
import { safeBack } from './safeBack.js';
import { participantsMasterDB } from '../dblayer/participantsMasterDB.js';
import { createParticipantMaster } from '../routes/seu/core/participantsMaster.js';
import { tenantsDB } from '../dblayer/tenantsDB.js';
import { DEMO_TENANT_NAME } from '../dblayer/constants.js';

// tenant_super sits above power, below the real platform super — a
// tenant_super satisfies requireRole('power') but not requireRole('super')
// (the platform-wide, unscoped screens stay super-exclusive); a real super
// still passes requireRole('tenant_super') too, same "higher rank passes any
// lower gate" ordinal logic as every other level here.
const ROLE_LEVEL = { general: 1, power: 2, tenant_super: 3, super: 4 };

let demoTenantIdCache = null;
async function getDemoTenantId() {
  if (demoTenantIdCache) return demoTenantIdCache;
  const { data, error } = await tenantsDB.findByName(DEMO_TENANT_NAME);
  if (error || !data) throw new Error(`${DEMO_TENANT_NAME} tenant not provisioned`);
  demoTenantIdCache = data.id;
  return demoTenantIdCache;
}

// Every demo-tenant login (any Google identity landing in the frictionless
// 'demo' sandbox — passportConfig.js) shares this ONE participants_master
// row, never a fresh one per signup — the demo tenant is a shared sandbox
// identity, not a per-person one. Found by its fixed display name (nothing
// else is unique here since it deliberately has no owning user_id), created
// once on first demo login.
const DEMO_PARTICIPANT_DISPLAY_NAME = 'Demo User';
let demoParticipantIdCache = null;
async function getOrCreateDemoParticipantId() {
  if (demoParticipantIdCache) return demoParticipantIdCache;
  const tenantId = await getDemoTenantId();
  const { data: existing, error } = await participantsMasterDB.findByTenantId(tenantId);
  if (error) throw error;
  const found = (existing ?? []).find((p) => p.display_name === DEMO_PARTICIPANT_DISPLAY_NAME);
  if (found) {
    demoParticipantIdCache = found.id;
    return demoParticipantIdCache;
  }
  const created = await createParticipantMaster({
    tenantId,
    type: 'Human',
    displayName: DEMO_PARTICIPANT_DISPLAY_NAME,
    userId: null,
  });
  demoParticipantIdCache = created.id;
  return demoParticipantIdCache;
}

// Every other (non-demo) user gets its own participants_master row,
// find-or-create keyed on user_id — same lazy-provisioning pattern
// core/identity.ts's setAuthorisedRoles/setAuthorisedBadges already use.
async function resolveParticipantId(user) {
  const demoTenantId = await getDemoTenantId();
  if (user.tenant_id === demoTenantId) return getOrCreateDemoParticipantId();

  const { data: existing, error } = await participantsMasterDB.findByUserId(user.id);
  if (error) throw error;
  if (existing) return existing.id;

  const created = await createParticipantMaster({
    tenantId: user.tenant_id,
    type: 'Human',
    displayName: user.name || user.email,
    userId: user.id,
  });
  return created.id;
}

/**
 * Builds a session user object from a DB user row. `id` is the
 * participants_master.id behind this user (the demo tenant's shared
 * singleton, or this user's own row) — never the raw users.id, so it never
 * leaks the login-facing identity into governed authority/authorship
 * plumbing that keys off this session id.
 * Always called after role override has been applied.
 */
export async function buildSessionUser(user) {
  const participantId = await resolveParticipantId(user);
  return {
    id:         participantId,
    email:      user.email,
    name:       user.name,
    avatar_url: user.avatar_url || null,
    role:       user.role,
    is_active:  user.is_active !== false,
    // CR-004: the actor's home (Platform | Tenant + tenant_id) travels on the
    // session so later work can scope by tenant. No enforcement here yet.
    type:       user.type || null,
    tenant_id:  user.tenant_id || null,
  };
}

/**
 * requireRole(minRole) — Express middleware factory.
 * Redirects to login if not authenticated, 403 if role insufficient.
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      // Non-GET requests are AJAX/API calls — return JSON 401 so the browser can
      // redirect itself, rather than sending HTML that callers try to JSON.parse.
      if (req.method !== 'GET') {
        return res.status(401).json({ success: false, message: 'Session expired — please log in again.' });
      }
      logger.debug(`[requireRole] Not logged in — redirect to login (path: ${req.path})`);
      return res.redirect('/aisworg/login');
    }
    // ─── TESTING BYPASS — remove this block to revert ───────────────────────
    // For testing convenience only, not part of the design (Phase 10's badge
    // model is deliberately a separate axis from this legacy role check —
    // see the design doc's §5 correction). Holding the root badge passes any
    // requireRole() check too, so "root" really does mean full access to
    // everything while testing, not just badge-gated surfaces. Delete this
    // block to go back to requireRole() reading only users.role, unrelated
    // to badges.
    // CR-001: when the god user is acting-as a non-root badge, effective
    // badges drop `root`, so this bypass no longer fires and the real level
    // check below applies. effectivePlatformBadges() returns null unless the
    // dev switcher is live, leaving the true session badges (prod unchanged).
    const badges = effectivePlatformBadges(req) ?? user.platformBadges ?? [];
    if (badges.includes('root')) return next();
    // ─── end testing bypass ──────────────────────────────────────────────────

    const userLevel = ROLE_LEVEL[user.role] ?? 0;
    const needLevel = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel >= needLevel) return next();

    logger.warn(`[requireRole] ${user.email} (${user.role}) tried to access ${req.path} — needs ${minRole}`);
    req.session.flash = { type: 'error', message: "You don't have permission to access that page." };
    // Never redirect back to the page we're denying — that loops (see safeBack).
    return res.redirect(safeBack(req));
  };
}

/** Convenience: any logged-in user. */
export const requireLogin = requireRole('general');
