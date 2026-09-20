// CR-098 (Ch.13 §8) — creates a participants_master resource, validating
// every Ontology-backed field the same way core/packs.ts validates its own
// Ontology-checked fields: assertCanonicalCategory, not a DB CHECK.
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { OntologyViewer } from "../../../dblayer/ontologyDB.js";
import type { ParticipantMasterRow, ParticipantType } from "../../../dblayer/seuTypes.js";

export async function createParticipantMaster(input: {
  tenantId: string;
  type: ParticipantType;
  displayName: string;
  capabilities?: string[];
  competency?: Record<string, Array<{ code: string; proficiency: string }>>;
  cost?: number | null;
  behaviourContext?: Array<{ policy: string; payload: Record<string, unknown> }>;
  isActive?: boolean;
  userId?: number | null;
}): Promise<ParticipantMasterRow> {
  const viewer: OntologyViewer = { isRoot: false, tenantId: input.tenantId };

  await assertCanonicalCategory("participant-types", input.type, viewer);

  for (const code of input.capabilities ?? []) {
    await assertCanonicalCategory("capability-name", code, viewer);
  }

  // CR-099 — competency dimension keys ARE category:pack's own codes
  // (Domain/Technology/...), not a separate competency-dimension concept
  // type; a concept_type's own name must be lowercase-hyphenated, so the
  // dimension's real value vocabulary is looked up under its lower-cased
  // form (e.g. dimension "Technology" -> concept_type "technology").
  // Dispatch Strategy input (Ch.33 §7/§9) — each entry's own proficiency is
  // Ontology-backed (proficiency-level: Novice/Intermediate/Expert).
  for (const [dimension, entries] of Object.entries(input.competency ?? {})) {
    await assertCanonicalCategory("category:pack", dimension, viewer);
    for (const entry of entries) {
      await assertCanonicalCategory(dimension.toLowerCase(), entry.code, viewer);
      await assertCanonicalCategory("proficiency-level", entry.proficiency, viewer);
    }
  }

  for (const entry of input.behaviourContext ?? []) {
    await assertCanonicalCategory("behaviour-context-policy", entry.policy, viewer);
  }

  const { data, error } = await participantsMasterDB.create(input);
  if (error || !data) throw error ?? new Error("failed to create participants_master row");
  return data;
}
