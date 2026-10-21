import { participantsMasterDB } from "../../participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../transitionDefinitionsDB.js";
import { tenantsDB } from "../../tenantsDB.js";
import { DEMO_TENANT_NAME, NO_EXPIRY_DATE } from "../../constants.js";
import { createParticipantMaster } from "../../../routes/seu/core/participantsMaster.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import type { TransitionEntityType } from "../../seuTypes.js";

export const DEMO_PARTICIPANT_DISPLAY_NAME = "Demo User";

export interface DemoActor {
  tenantId: string;
  participantId: string;
}

// Finds the shared Demo User participant, creating it the same way the
// sign-in path does (middleware/auth.js) when no visitor has signed in yet.
export async function getDemoActor(): Promise<DemoActor> {
  const { data: tenant, error: tenantError } = await tenantsDB.findByName(DEMO_TENANT_NAME);
  if (tenantError) throw tenantError;
  if (!tenant) throw new Error(`${DEMO_TENANT_NAME} tenant not provisioned`);
  const { data: existing, error } = await participantsMasterDB.findByTenantId(tenant.id);
  if (error) throw error;
  const found = (existing ?? []).find((p) => p.display_name === DEMO_PARTICIPANT_DISPLAY_NAME);
  if (found) return { tenantId: tenant.id, participantId: found.id };
  const created = await createParticipantMaster({
    tenantId: tenant.id,
    type: "Human",
    displayName: DEMO_PARTICIPANT_DISPLAY_NAME,
    userId: null,
  });
  return { tenantId: tenant.id, participantId: created.id };
}

// Adds a badge to the Demo User's authorised_badges. Never revokes.
export async function grantBadge(participantId: string, badge: string): Promise<void> {
  const { data: master, error: findError } = await participantsMasterDB.findById(participantId);
  if (findError) throw findError;
  if (!master) throw new Error(`grantBadge: no participants_master row ${participantId}`);
  if (master.authorised_badges.some((b) => b.badge === badge)) return;
  const { error } = await participantsMasterDB.setAuthorisedBadges(participantId, [
    ...master.authorised_badges,
    { badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] },
  ]);
  if (error) throw error;
}

// Grants the badge(s) route_authority declares for this method and path.
export async function grantRouteBadges(participantId: string, method: string, path: string): Promise<void> {
  const found = lookupRouteAuthority(method, path);
  if (!found) throw new Error(`grantRouteBadges: no route_authority row for ${method} ${path}`);
  for (const badge of found.badges) await grantBadge(participantId, badge);
}

// Grants the badge a transition_definitions row's verb resolves to. An
// ungoverned row (verb null) has no badge to grant.
export async function grantTransitionBadge(participantId: string, entityType: TransitionEntityType, fromState: string, toState: string): Promise<void> {
  const { data: definition, error } = await transitionDefinitionsDB.find(entityType, fromState, toState);
  if (error) throw error;
  if (!definition) throw new Error(`grantTransitionBadge: no transition_definitions row for ${entityType} ${fromState} -> ${toState}`);
  if (!definition.verb) return;
  await grantBadge(participantId, `${entityType.toLowerCase()}_${definition.verb}`);
}

// Grants every badge any governed transition_definitions row resolves to, in one write. Run before each
// scenario so no transition, direct or event-driven, can meet a missing badge.
export async function grantAllTransitionBadges(participantId: string): Promise<void> {
  const { data: definitions, error } = await transitionDefinitionsDB.listAll();
  if (error) throw error;
  const { data: master, error: findError } = await participantsMasterDB.findById(participantId);
  if (findError) throw findError;
  if (!master) throw new Error(`grantAllTransitionBadges: no participants_master row ${participantId}`);
  const held = new Set(master.authorised_badges.map((b) => b.badge));
  const missing = new Set<string>();
  for (const d of definitions ?? []) {
    if (!d.verb) continue;
    const badge = `${d.entity_type.toLowerCase()}_${d.verb}`;
    if (!held.has(badge)) missing.add(badge);
  }
  if (missing.size === 0) return;
  const { error: setError } = await participantsMasterDB.setAuthorisedBadges(participantId, [
    ...master.authorised_badges,
    ...[...missing].map((badge) => ({ badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] as string[] })),
  ]);
  if (setError) throw setError;
}
