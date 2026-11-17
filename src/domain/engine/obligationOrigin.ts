import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { OBLIGATION_ORIGIN_POLICY } from "../../dblayer/constants.js";
import type { ObligationRow } from "../../dblayer/seuTypes.js";

// The plain code of the Policy that raised an Obligation, or null when a Policy did not raise it. The originating id is the id of the Policy Definition or of the Policy row.
export async function originatingPolicyCode(obligation: Pick<ObligationRow, "originating_entity_type" | "originating_entity_id">): Promise<string | null> {
  if (obligation.originating_entity_type !== OBLIGATION_ORIGIN_POLICY || !obligation.originating_entity_id) return null;
  const { data: definition, error } = await policyDefinitionsDB.findById(obligation.originating_entity_id);
  if (error) throw error;
  if (definition) return definition.code.split("::")[0];
  const { data: policies, error: policiesError } = await policiesDB.findByIds([obligation.originating_entity_id]);
  if (policiesError) throw policiesError;
  return policies?.[0] ? policies[0].code.split("::")[0] : null;
}
