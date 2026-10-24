import { findingsDB } from "../dblayer/findingsDB.js";
import type { ActionInput } from "./index.js";

// Converting a Finding links the Obligation raised for it (CR-133). It runs inside the transition's transaction, before the status
// changes, and refuses by throwing.
export async function convertFinding(input: ActionInput): Promise<void> {
  const obligationId = input.context.obligationId;
  if (typeof obligationId !== "string" || !obligationId) throw new Error("converting a Finding requires the Obligation raised for it");
  const { error } = await findingsDB.setObligationId(input.entityId, obligationId);
  if (error) throw error;
}
