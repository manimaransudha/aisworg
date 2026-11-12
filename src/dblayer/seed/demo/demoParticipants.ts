import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../../utils/logger.js";
import { ontologyDB, type OntologyViewer } from "../../ontologyDB.js";
import { participantsMasterDB } from "../../participantsMasterDB.js";
import { capabilityDefinitionsDB } from "../../capabilityDefinitionsDB.js";
import { COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_WORK_TYPE } from "../../constants.js";
import type { ParticipantType } from "../../seuTypes.js";
import { grantBadgesToMany, type DemoActor } from "./demoBadges.js";

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "demo", "participants.json");
const badgesFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "demo", "participantBadges.json");

interface DemoParticipantSeed {
  type: ParticipantType;
  displayName: string;
  capabilities: string[];
  competency: Record<string, Array<{ code: string; proficiency: string }>>;
  // The proficiency the participant holds in the Roles and Work types of its Capabilities.
  capabilityProficiency: string;
  cost: number | null;
  behaviourContext: Array<{ policy: string; payload: Record<string, unknown> }>;
  authorisedRole: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
}

async function codesOf(conceptType: string, viewer: OntologyViewer): Promise<Set<string>> {
  const { data, error } = await ontologyDB.findConceptsByType(conceptType, viewer);
  if (error) throw error;
  return new Set((data ?? []).map((c) => c.code));
}

function assertCanonical(conceptType: string, value: string, allowed: Set<string>, who: string): string | null {
  return allowed.has(value) ? null : `${who}: "${value}" is not a canonical ${conceptType} concept`;
}

// Seeds the Demo tenant's participants_master roster in one batch. Each Ontology
// concept set is read once and every row is checked in memory. Participants that
// already exist by display name are updated from the JSON, so a reset stays repeatable.
export async function seedDemoParticipants(actor: DemoActor): Promise<void> {
  const roster = JSON.parse(readFileSync(dataFile, "utf8")) as DemoParticipantSeed[];
  const viewer: OntologyViewer = { isRoot: false, tenantId: actor.tenantId };
  const [participantTypes, capabilities, dimensions, proficiencies, policies, roles] = await Promise.all([
    codesOf("participant-types", viewer), codesOf("capability-name", viewer), codesOf("participant-eligibility-dimension", viewer),
    codesOf("proficiency-level", viewer), codesOf("behaviour-context-policy", viewer), codesOf("authorised-role", viewer),
  ]);
  const dimensionNames = [...new Set(roster.flatMap((r) => Object.keys(r.competency)))];
  const dimensionValues = new Map<string, Set<string>>();
  await Promise.all(dimensionNames.map(async (d) => dimensionValues.set(d, await codesOf(d.toLowerCase(), viewer))));

  const errors: string[] = [];
  const note = (e: string | null): void => { if (e) errors.push(e); };
  for (const r of roster) {
    note(assertCanonical("participant-types", r.type, participantTypes, r.displayName));
    for (const c of r.capabilities) note(assertCanonical("capability-name", c, capabilities, r.displayName));
    for (const [dimension, entries] of Object.entries(r.competency)) {
      note(assertCanonical("participant-eligibility-dimension", dimension, dimensions, r.displayName));
      for (const e of entries) {
        note(assertCanonical(dimension.toLowerCase(), e.code, dimensionValues.get(dimension) ?? new Set(), r.displayName));
        note(assertCanonical("proficiency-level", e.proficiency, proficiencies, r.displayName));
      }
    }
    for (const b of r.behaviourContext) note(assertCanonical("behaviour-context-policy", b.policy, policies, r.displayName));
    for (const a of r.authorisedRole) note(assertCanonical("authorised-role", a.role, roles, r.displayName));
  }
  for (const r of roster) {
    note(assertCanonical("proficiency-level", r.capabilityProficiency, proficiencies, r.displayName));
    for (const dimension of [COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_WORK_TYPE]) note(assertCanonical("participant-eligibility-dimension", dimension, dimensions, r.displayName));
  }
  if (errors.length > 0) throw new Error(`[seed:demo] participant roster invalid: ${errors.join("; ")}`);

  // A participant holds the Roles of its Capabilities, and under them the Work types. Both come from the
  // Capability Definitions, which are read once for the whole roster.
  const capabilityCodes = [...new Set(roster.flatMap((r) => r.capabilities))];
  const { data: definitions, error: definitionsError } = await capabilityDefinitionsDB.findActiveByCodesVisibleTo(capabilityCodes, actor.tenantId);
  if (definitionsError) throw definitionsError;
  const rolesByCapability = new Map((definitions ?? []).map((d) => [d.code, d.roles ?? []]));
  const competencyOf = (r: DemoParticipantSeed): DemoParticipantSeed["competency"] => {
    const roles = new Set<string>();
    const worktypes = new Set<string>();
    for (const capability of r.capabilities) {
      for (const role of rolesByCapability.get(capability) ?? []) {
        roles.add(role.name);
        for (const worktype of role.worktypes) worktypes.add(worktype);
      }
    }
    const entries = (codes: Set<string>) => [...codes].map((code) => ({ code, proficiency: r.capabilityProficiency }));
    return { ...r.competency, [COMPETENCY_DIMENSION_ROLE]: entries(roles), [COMPETENCY_DIMENSION_WORK_TYPE]: entries(worktypes) };
  };
  const { data: existing, error: findError } = await participantsMasterDB.findByTenantId(actor.tenantId);
  if (findError) throw findError;
  const idByName = new Map((existing ?? []).map((p) => [p.display_name, p.id]));
  const withId = roster.map(({ capabilityProficiency: _p, ...r }, i) => ({ ...r, competency: competencyOf(roster[i]), id: idByName.get(r.displayName) }));
  const fresh = withId.filter((r) => !r.id);
  const changed = withId.filter((r): r is typeof r & { id: string } => Boolean(r.id));
  const created = await participantsMasterDB.createMany(
    fresh.map((r) => ({ tenantId: actor.tenantId, ...r, isActive: true, userId: null }))
  );
  if (created.error) throw created.error;
  const updated = await participantsMasterDB.updateProfiles(changed.map((r) => ({ ...r, isActive: true })));
  if (updated.error) throw updated.error;
  // The badges the "My Work" forms need, so the Demo viewer can act as a chosen participant under that participant's own badges.
  const wanted = JSON.parse(readFileSync(badgesFile, "utf8")) as { badges: string[]; prefixes: string[] };
  await grantBadgesToMany([...(created.data ?? []), ...(updated.data ?? [])], wanted);
  logger.info(`[seed:demo] participants: ${fresh.length} created, ${changed.length} updated from participants.json.`);
}
