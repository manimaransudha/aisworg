import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { CapabilityRow, ObjectiveRow } from "../../../dblayer/seuTypes.js";

// Ch.1 §10 — MVP declares required Capabilities explicitly rather than
// deriving them (Build Plan §5 item 1).
export async function createObjective(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  requestedBy?: number | null;
}): Promise<{ objective: ObjectiveRow; requiredCapabilities: CapabilityRow[] }> {
  const { data: objective, error } = await objectivesDB.create({ statement: input.statement, requestedBy: input.requestedBy });
  if (error || !objective) throw error ?? new Error("failed to create objective");

  const { data: capabilities, error: capErr } = await capabilitiesDB.findByCodes(input.requiredCapabilityCodes);
  if (capErr) throw capErr;
  const found = capabilities ?? [];
  const foundCodes = new Set(found.map((c) => c.code));
  const missing = input.requiredCapabilityCodes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new Error(`unknown capability code(s): ${missing.join(", ")}`);
  }

  await objectivesDB.addCapabilities(objective.id, found.map((c) => c.id));
  return { objective, requiredCapabilities: found };
}
