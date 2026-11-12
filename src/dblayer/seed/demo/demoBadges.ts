import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { participantsMasterDB } from "../../participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../transitionDefinitionsDB.js";
import { routeAuthorityDB } from "../../routeAuthorityDB.js";
import { tenantsDB } from "../../tenantsDB.js";
import { DEMO_TENANT_NAME, NO_EXPIRY_DATE } from "../../constants.js";
import { createParticipantMaster } from "../../../routes/seu/core/participantsMaster.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import type { ParticipantMasterRow, TransitionEntityType } from "../../seuTypes.js";

export const DEMO_PARTICIPANT_DISPLAY_NAME = "Demo User";

const demoUserFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "demo", "demoUser.json");

// Leaves the Demo User holding exactly the roles listed in demoUser.json; any other role is removed.
export async function ensureDemoUserRoles(participantId: string): Promise<void> {
  const { data: master, error: findError } = await participantsMasterDB.findById(participantId);
  if (findError) throw findError;
  if (!master) throw new Error(`ensureDemoUserRoles: no participants_master row ${participantId}`);
  const { authorisedRoles } = JSON.parse(readFileSync(demoUserFile, "utf8")) as { authorisedRoles: string[] };
  const held = master.authorised_role.map((entry) => entry.role);
  if (held.length === authorisedRoles.length && authorisedRoles.every((role) => held.includes(role))) return;
  const { error } = await participantsMasterDB.setAuthorisedRole(
    participantId,
    authorisedRoles.map((role) => ({ role, effective_till: NO_EXPIRY_DATE, seu_ids: [] }))
  );
  if (error) throw error;
}

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

// Adds a badge to the Demo User's authorised_badges. Returns true when the badge was not held before.
export async function grantBadge(participantId: string, badge: string): Promise<boolean> {
  const { data: master, error: findError } = await participantsMasterDB.findById(participantId);
  if (findError) throw findError;
  if (!master) throw new Error(`grantBadge: no participants_master row ${participantId}`);
  if (master.authorised_badges.some((b) => b.badge === badge)) return false;
  const { error } = await participantsMasterDB.setAuthorisedBadges(participantId, [
    ...master.authorised_badges,
    { badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] },
  ]);
  if (error) throw error;
  return true;
}

// Grants the badge(s) route_authority declares for this method and path. Returns the badges that were added.
export async function grantRouteBadges(participantId: string, method: string, path: string): Promise<string[]> {
  const found = lookupRouteAuthority(method, path);
  if (!found) throw new Error(`grantRouteBadges: no route_authority row for ${method} ${path}`);
  const added: string[] = [];
  for (const badge of found.badges) if (await grantBadge(participantId, badge)) added.push(badge);
  return added;
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

// Grants every badge with one of the prefixes (for example "seu_") that a transition_definitions verb or a route_authority row declares, in one write.
export async function grantBadgesWithPrefixes(participantId: string, prefixes: string[]): Promise<void> {
  const { data: definitions, error } = await transitionDefinitionsDB.findAllRows();
  if (error) throw error;
  const { data: routes, error: routesError } = await routeAuthorityDB.findAll();
  if (routesError) throw routesError;
  const { data: master, error: findError } = await participantsMasterDB.findById(participantId);
  if (findError) throw findError;
  if (!master) throw new Error(`grantBadgesWithPrefixes: no participants_master row ${participantId}`);
  const wanted = new Set<string>();
  for (const d of definitions ?? []) if (d.verb) wanted.add(`${d.entity_type.toLowerCase()}_${d.verb}`);
  for (const r of routes ?? []) for (const badge of r.badges) wanted.add(badge);
  const held = new Set(master.authorised_badges.map((b) => b.badge));
  const missing = [...wanted].filter((badge) => prefixes.some((prefix) => badge.startsWith(prefix)) && !held.has(badge));
  if (missing.length === 0) return;
  const { error: setError } = await participantsMasterDB.setAuthorisedBadges(participantId, [
    ...master.authorised_badges,
    ...missing.map((badge) => ({ badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] as string[] })),
  ]);
  if (setError) throw setError;
}

// Grants the same badges to every listed participant. A badge is named in `badges`, or is any badge a transition_definitions verb or a
// route_authority row declares whose name starts with one of `prefixes`. Both tables are read once. Each participant is written once.
export async function grantBadgesToMany(participants: ParticipantMasterRow[], wanted: { badges: string[]; prefixes: string[] }): Promise<void> {
  if (participants.length === 0) return;
  const { data: definitions, error } = await transitionDefinitionsDB.findAllRows();
  if (error) throw error;
  const { data: routes, error: routesError } = await routeAuthorityDB.findAll();
  if (routesError) throw routesError;
  const declared = new Set<string>();
  for (const d of definitions ?? []) if (d.verb) declared.add(`${d.entity_type.toLowerCase()}_${d.verb}`);
  for (const r of routes ?? []) for (const badge of r.badges) declared.add(badge);
  const granted = new Set([...wanted.badges, ...[...declared].filter((badge) => wanted.prefixes.some((prefix) => badge.startsWith(prefix)))]);
  for (const participant of participants) {
    const held = new Set(participant.authorised_badges.map((b) => b.badge));
    const missing = [...granted].filter((badge) => !held.has(badge));
    if (missing.length === 0) continue;
    const { error: setError } = await participantsMasterDB.setAuthorisedBadges(participant.id, [
      ...participant.authorised_badges,
      ...missing.map((badge) => ({ badge, effective_till: NO_EXPIRY_DATE, seu_ids: [] as string[] })),
    ]);
    if (setError) throw setError;
  }
}

// Grants every badge any governed transition_definitions row resolves to, in one write. Run before each
// step so no transition, direct or event-driven, can meet a missing badge.
export async function grantAllTransitionBadges(participantId: string): Promise<void> {
  const { data: definitions, error } = await transitionDefinitionsDB.findAllRows();
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
