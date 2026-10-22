import type { EbmRow } from "../dblayer/seuTypes.js";
import type { ActionInput } from "./index.js";

// Raises the Attention Item for a retired EBM (CR-128). It runs inside the transition's transaction, before the status changes.
// The caller (validateEbm) passes the dead references it found in `context.deadReferences`.
export async function raiseEbmRetiredAttention(input: ActionInput): Promise<void> {
  const ebm = input.context.row as EbmRow;
  const deadReferences = Array.isArray(input.context.deadReferences) ? (input.context.deadReferences as string[]) : [];
  // Loaded when called: routes/seu/core/attentionItems.ts imports the transition engine, which imports this registry.
  const { raiseAttentionItem } = await import("../routes/seu/core/attentionItems.js");
  await raiseAttentionItem({
    seuId: ebm.seu_id,
    category: "EBM Retired",
    priority: "High",
    title: `EBM for this SEU was retired — references no longer live`,
    description: deadReferences.join("; "),
    relatedObjectType: "EBM",
    relatedObjectId: ebm.id,
    actorId: input.actorId,
    authorBadge: input.authorityBadge,
  });
}
