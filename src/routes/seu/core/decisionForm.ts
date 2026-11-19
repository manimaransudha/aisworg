import { DECISION_ALTERNATIVE_DEFAULT_STATUS, PARTICIPANT_TITLE_MAX_LENGTH } from "../../../dblayer/constants.js";
import { createDecision } from "./decisions.js";
import type { DecisionAlternative, DecisionRow } from "../../../dblayer/seuTypes.js";

const asList = (value: unknown): string[] => (Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value]).map(String);

// Raises a Decision from the Create Decision form: a Deliverable, a category, a title, a list of alternatives, and the Knowledge and Evidence that support it.
// The risk of an alternative is kept in its consequences. The caller names the acting participant.
export async function createDecisionFromForm(input: { seuId: string; actorId: string; body: Record<string, unknown> }): Promise<DecisionRow> {
  const { deliverableId, category, title, engineeringQuestion } = input.body;
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    throw new Error("Deliverable, category and title are required.");
  }
  if (title.length > PARTICIPANT_TITLE_MAX_LENGTH) throw new Error(`The title is at most ${PARTICIPANT_TITLE_MAX_LENGTH} characters.`);
  const knowledgeIds = [...new Set(asList(input.body.knowledgeId))];
  const evidenceIds = [...new Set(asList(input.body.evidenceId))];
  if (knowledgeIds.length === 0 && evidenceIds.length === 0) throw new Error("Select supporting Knowledge or Evidence, or both.");

  const statements = asList(input.body.alternativeStatement);
  const rationales = asList(input.body.alternativeRationale);
  const risks = asList(input.body.alternativeRisk);
  const statuses = asList(input.body.alternativeStatus);
  const alternatives: DecisionAlternative[] = statements
    .map((statement, n) => ({
      statement: statement.trim(),
      assumptions: [],
      consequences: risks[n]?.trim() ? [risks[n]!.trim()] : [],
      status: statuses[n] || DECISION_ALTERNATIVE_DEFAULT_STATUS,
      rationale: rationales[n]?.trim() || null,
    }))
    .filter((a) => a.statement !== "");

  return createDecision({
    seuId: input.seuId,
    actorId: input.actorId,
    relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }],
    knowledgeIds,
    evidenceIds,
    category,
    title,
    engineeringQuestion: typeof engineeringQuestion === "string" && engineeringQuestion.trim() ? engineeringQuestion : null,
    alternatives,
  });
}
