import { logger } from '../utils/logger.js';
import { effectivePlatformBadges } from '../dev/actAs.js';
import { safeBack } from './safeBack.js';
import { participantsMasterDB } from '../dblayer/participantsMasterDB.js';
import { createParticipantMaster } from '../routes/seu/core/participantsMaster.js';
import { tenantsDB } from '../dblayer/tenantsDB.js';
import { DEMO_TENANT_NAME } from '../dblayer/constants.js';

const ROLE_LEVEL = { general: 1, power: 2, tenant_super: 3, super: 4 };

let demoTenantIdCache = null;
async function getDemoTenantId() {
  if (demoTenantIdCache) return demoTenantIdCache;
  const { data, error } = await tenantsDB.findByName(DEMO_TENANT_NAME);
  if (error || !data) throw new Error(`${DEMO_TENANT_NAME} tenant not provisioned`);
  demoTenantIdCache = data.id;
  return demoTenantIdCache;
}

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

export async function buildSessionUser(user) {
  const participantId = await resolveParticipantId(user);
  return {
    id:         participantId,
    email:      user.email,
    name:       user.name,
    avatar_url: user.avatar_url || null,
    role:       user.role,
    is_active:  user.is_active !== false,
    type:       user.type || null,
    tenant_id:  user.tenant_id || null,
  };
}

export function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      if (req.method !== 'GET') {
        return res.status(401).json({ success: false, message: 'Session expired — please log in again.' });
      }
      logger.debug(`[requireRole] Not logged in — redirect to login (path: ${req.path})`);
      return res.redirect('/aisworg/login');
    }
    const badges = effectivePlatformBadges(req) ?? user.platformBadges ?? [];
    if (badges.includes('root')) return next();

    const userLevel = ROLE_LEVEL[user.role] ?? 0;
    const needLevel = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel >= needLevel) return next();

    logger.warn(`[requireRole] ${user.email} (${user.role}) tried to access ${req.path} — needs ${minRole}`);
    req.session.flash = { type: 'error', message: "You don't have permission to access that page." };
    return res.redirect(safeBack(req));
  };
}

export const requireLogin = requireRole('general');
