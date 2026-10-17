import type { UserRow } from '../dblayer/userDB.js';
import { logger } from '../utils/logger.js';
import { isGodUser } from '../dev/actAs.js';
import { safeBack } from './safeBack.js';
import { participantsMasterDB } from '../dblayer/participantsMasterDB.js';
import { createParticipantMaster } from '../routes/seu/core/participantsMaster.js';
import { tenantsDB } from '../dblayer/tenantsDB.js';
import { DEMO_TENANT_NAME } from '../dblayer/constants.js';

let demoTenantIdCache: string | null = null;
async function getDemoTenantId() {
  if (demoTenantIdCache) return demoTenantIdCache;
  const { data, error } = await tenantsDB.findByName(DEMO_TENANT_NAME);
  if (error || !data) throw new Error(`${DEMO_TENANT_NAME} tenant not provisioned`);
  demoTenantIdCache = data.id;
  return demoTenantIdCache;
}

const DEMO_PARTICIPANT_DISPLAY_NAME = 'Demo User';
let demoParticipantIdCache: string | null = null;
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

async function resolveParticipantId(user: UserRow) {
  // The env superuser belongs to the Platform tenant. The Demo tenant is only consulted for other sign-ins.
  if (!isGodUser(user)) {
    const demoTenantId = await getDemoTenantId();
    if (user.tenant_id === demoTenantId) return getOrCreateDemoParticipantId();
  }

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

export async function buildSessionUser(user: UserRow) {
  const participantId = await resolveParticipantId(user);
  return {
    id:         participantId,
    email:      user.email,
    name:       user.name,
    avatar_url: user.avatar_url || null,
    is_active:  user.is_active,
    type:       user.type,
    tenant_id:  user.tenant_id,
  };
}
