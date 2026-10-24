import { RAISE_EBM_RETIRED_ATTENTION_ACTION_CODE, SUPERSEDE_OBJECTIVE_ACTION_CODE, SUPERSEDE_DECISION_ACTION_CODE, COMPLETE_REVIEW_ACTION_CODE, CONVERT_FINDING_ACTION_CODE, VALIDATE_SEU_REQUEST_ACTION_CODE, UNRAVEL_PROFILE_ACTION_CODE, UNRAVEL_TEMPLATE_ACTION_CODE } from "../dblayer/constants.js";
import { raiseEbmRetiredAttention } from "./raiseEbmRetiredAttention.js";
import { completeReview } from "./completeReview.js";
import { convertFinding } from "./convertFinding.js";
import { supersedeDecision } from "./supersedeDecision.js";
import { supersedeObjective } from "./supersedeObjective.js";
import { unravelProfile } from "./unravelProfile.js";
import { unravelTemplate } from "./unravelTemplate.js";
import { validateSeuRequest } from "./validateSeuRequest.js";

export interface ActionInput {
  entityType: string;
  entityId: string;
  actorId: string;
  authorityBadge: string;
  context: Record<string, unknown>;
}

// A transition row that names an action code runs the function registered here under that code (CR-128). Unlike a
// Policy function, an action writes. It runs inside the transition's transaction, after the gate and before the
// status changes, so a throw leaves the status as it was. An action throws on any `{ error }` a DB-layer function
// returns, because those functions return the error instead of throwing. Each entity adds its actions in its own pass.
export type ActionImplementation = (input: ActionInput) => Promise<void>;

const ACTION_IMPLEMENTATIONS: Record<string, ActionImplementation> = {
  [UNRAVEL_TEMPLATE_ACTION_CODE]: unravelTemplate,
  [UNRAVEL_PROFILE_ACTION_CODE]: unravelProfile,
  [SUPERSEDE_OBJECTIVE_ACTION_CODE]: supersedeObjective,
  [SUPERSEDE_DECISION_ACTION_CODE]: supersedeDecision,
  [COMPLETE_REVIEW_ACTION_CODE]: completeReview,
  [CONVERT_FINDING_ACTION_CODE]: convertFinding,
  [RAISE_EBM_RETIRED_ATTENTION_ACTION_CODE]: raiseEbmRetiredAttention,
  [VALIDATE_SEU_REQUEST_ACTION_CODE]: validateSeuRequest,
};

export function isRegisteredAction(actionCode: string): boolean {
  return actionCode in ACTION_IMPLEMENTATIONS;
}

export async function runAction(actionCode: string, input: ActionInput): Promise<void> {
  const implementation = ACTION_IMPLEMENTATIONS[actionCode];
  if (!implementation) throw new Error(`Transition Definition names the action "${actionCode}" and there is no implementation in src/actions`);
  return implementation(input);
}
