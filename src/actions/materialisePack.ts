import { packsDB } from "../dblayer/packsDB.js";
import type { ActionInput } from "./index.js";

// Writes the rows a Pack's contributions name: Capabilities, Services, authority rules, Policies, Checklists, review gates and quality gates.
// It runs on the Pack Published -> Active hop, inside the transition's transaction and before the status changes, so a throw leaves the Pack Published.
// The upserts of Services, Checklists, review gates and quality gates open their own transaction, so their rows are kept when a later step fails.
// Each upsert leaves an unchanged row as it is, so a second attempt writes the rest.
export async function materialisePack(input: ActionInput): Promise<void> {
  const { data: pack, error } = await packsDB.findById(input.entityId);
  if (error) throw error;
  if (!pack) throw new Error(`Pack ${input.entityId} not found`);
  // Loaded when called: packs.ts imports sdkAuthoring.ts, which imports the transition engine, which imports this registry.
  const { materializeContributions } = await import("../routes/seu/core/packs.js");
  await materializeContributions(pack, { contributions: pack.contributions });
}
