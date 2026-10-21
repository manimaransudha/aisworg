import { COMMENT_REQUIRED_POLICY_CODE, MATERIALISE_PROFILE_POLICY_CODE, MATERIALISE_TEMPLATE_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../dblayer/constants.js";
import { commentRequired } from "./commentRequired.js";
import { materialiseProfile } from "./materialiseProfile.js";
import { materialiseTemplate } from "./materialiseTemplate.js";
import { ontologyValuesPresent } from "./ontologyValuesPresent.js";
import { validateSchema } from "./validateSchema.js";

export interface PolicyImplementationInput {
  entityType: string;
  entityId: string | undefined;
  context: Record<string, unknown>;
}

// A Policy whose governingCondition has type "implemented" is decided by the function registered here under its code (CR-128). The function changes nothing.
export type PolicyImplementation = (input: PolicyImplementationInput) => Promise<boolean>;

const POLICY_IMPLEMENTATIONS: Record<string, PolicyImplementation> = {
  [ONTOLOGY_VALUES_PRESENT_POLICY_CODE]: ontologyValuesPresent,
  [VALIDATE_SCHEMA_POLICY_CODE]: validateSchema,
  [COMMENT_REQUIRED_POLICY_CODE]: commentRequired,
  [MATERIALISE_TEMPLATE_POLICY_CODE]: materialiseTemplate,
  [MATERIALISE_PROFILE_POLICY_CODE]: materialiseProfile,
};

export async function evaluateImplementedPolicy(policyCode: string, input: PolicyImplementationInput): Promise<boolean> {
  const implementation = POLICY_IMPLEMENTATIONS[policyCode.split("::")[0]];
  if (!implementation) throw new Error(`Policy ${policyCode} has an implemented condition and no implementation in src/policies`);
  return implementation(input);
}
