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
  authorisedRole?: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
  isActive?: boolean;
  userId: string | null;
}): Promise<ParticipantMasterRow> {
  const viewer: OntologyViewer = { isRoot: false, tenantId: input.tenantId };

  await assertCanonicalCategory("participant-types", input.type, viewer);

  for (const code of input.capabilities ?? []) {
    await assertCanonicalCategory("capability-name", code, viewer);
  }

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

  for (const entry of input.authorisedRole ?? []) {
    await assertCanonicalCategory("authorised-role", entry.role, viewer);
  }

  const { data, error } = await participantsMasterDB.create(input);
  if (error || !data) throw error ?? new Error("failed to create participants_master row");
  return data;
}
