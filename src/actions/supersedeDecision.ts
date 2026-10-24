import { decisionsDB } from "../dblayer/decisionsDB.js";
import { supersessionEngine } from "../domain/engine/supersessionEngine.js";
import type { ActionInput } from "./index.js";

// Supersedes a Decision (CR-131): the generic supersession check (CR-116), then the link to the replacing Decision.
// It runs inside the transition's transaction, before the status changes, and refuses by throwing.
export async function supersedeDecision(input: ActionInput): Promise<void> {
  const supersedingId = input.context.supersedingDecisionId;
  const comment = input.context.comment;
  const check = await supersessionEngine.check({
    supersededId: input.entityId,
    supersedingId: typeof supersedingId === "string" ? supersedingId : undefined,
    comment: typeof comment === "string" ? comment : undefined,
    actorId: input.actorId,
    authorityBadge: input.authorityBadge,
    findCandidate: async (candidateId) => (await decisionsDB.findById(candidateId)).data ?? null,
  });
  if (!check.ok) throw new Error(check.detail);
  if (check.supersedingId === input.entityId) throw new Error("a Decision cannot supersede itself");

  const { error } = await decisionsDB.setSupersededBy(input.entityId, check.supersedingId);
  if (error) throw error;
}
