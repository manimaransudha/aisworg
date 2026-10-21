import { objectivesDB } from "../dblayer/objectivesDB.js";
import { supersessionEngine } from "../domain/engine/supersessionEngine.js";
import type { ObjectiveRow } from "../dblayer/seuTypes.js";
import type { ActionInput } from "./index.js";

// Supersedes an Objective (CR-129): the generic supersession check (CR-116), the same-tenant rule, then the link to the successor.
// It runs inside the transition's transaction, before the status changes, and refuses by throwing.
export async function supersedeObjective(input: ActionInput): Promise<void> {
  const objective = input.context.row as ObjectiveRow;
  const supersedingId = input.context.supersedingObjectiveId;
  const comment = input.context.comment;
  const check = await supersessionEngine.check({
    supersededId: input.entityId,
    supersedingId: typeof supersedingId === "string" ? supersedingId : undefined,
    comment: typeof comment === "string" ? comment : undefined,
    actorId: input.actorId,
    authorityBadge: input.authorityBadge,
    findCandidate: async (candidateId) => (await objectivesDB.findById(candidateId)).data ?? null,
  });
  if (!check.ok) throw new Error(check.detail);

  const { data: successor } = await objectivesDB.findById(check.supersedingId);
  const supersededTenantId = objective.sponsoring_authority?.tenant ?? null;
  const supersedingTenantId = successor?.sponsoring_authority?.tenant ?? null;
  if (supersededTenantId === null || supersedingTenantId === null || supersededTenantId !== supersedingTenantId) {
    throw new Error("the superseding Objective belongs to a different tenant");
  }

  const { error } = await objectivesDB.setSupersedingObjectiveId(input.entityId, check.supersedingId);
  if (error) throw error;
}
