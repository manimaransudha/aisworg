import type { Request } from "express";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { resolveAuthorBadge, type HeldBadges } from "../../../domain/identity/heldBadges.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { DEMO_PARTICIPANT_DISPLAY_NAME } from "../../../dblayer/seed/demo/demoBadges.js";
import type { ParticipantMasterRow } from "../../../dblayer/seuTypes.js";
import { listConceptsForType } from "./ontology.js";

// The participants the Demo viewer can show: the Demo tenant's roster without the shared Demo User.
export async function listViewerParticipants(demoTenantId: string): Promise<ParticipantMasterRow[]> {
  const { data, error } = await participantsMasterDB.findByTenantId(demoTenantId);
  if (error) throw error;
  return (data ?? []).filter((p) => p.display_name !== DEMO_PARTICIPANT_DISPLAY_NAME);
}

// The chosen participant, which must belong to the Demo tenant. Any other id is refused, so the viewer cannot act as a participant of another tenant.
export async function getViewerParticipant(participantId: string, demoTenantId: string): Promise<ParticipantMasterRow> {
  const found = (await listViewerParticipants(demoTenantId)).find((p) => p.id === participantId);
  if (!found) throw new Error("That participant is not in the Demo tenant.");
  return found;
}

// The author badge of a request made on behalf of the chosen participant: the route's own route_authority row, resolved against the
// badges that participant holds. It uses the same resolver as every other route; only the actor differs.
export async function resolveViewerAuthorBadge(req: Request, participantId: string): Promise<string> {
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(participantId);
  const has = (badgeType: string): boolean => isRoot || badgeTypes.has(badgeType);
  const held: HeldBadges = { isRoot, badgeTypes, has, hasVerb: (entityType, verb) => !!verb && has(`${entityType.toLowerCase()}_${verb}`) };
  return resolveAuthorBadge(lookupRouteAuthority(req.method, req.baseUrl + req.path), held);
}

// The Obligation category and severity choices of the "My Work" form, read from the Ontology for the Demo tenant.
export async function getViewerObligationOptions(demoTenantId: string): Promise<{ categories: string[]; severities: string[] }> {
  const viewer = { isRoot: false, tenantId: demoTenantId };
  const [categories, severities] = await Promise.all([
    listConceptsForType("category:obligation", viewer, false),
    listConceptsForType("category:obligation-severity", viewer, false),
  ]);
  return {
    categories: [...new Set(categories.map((c) => c.code))].sort(),
    severities: [...new Set(severities.map((c) => c.code))].sort(),
  };
}
