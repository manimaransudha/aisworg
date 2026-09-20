// CR-109 Build Plan §6 — Work Item Generator design. Resolves Ch.32 §7/§11's
// Execution Context once, at generation, into real content (not references
// the Participant has to chase, per the owner's own worked example:
// "these are the inputs, this is where they are located, these were the
// decisions associated with the input, this is all the evidence, this is
// the knowledge you need").
//
// Currently Deliverable-Command-only — the only real Command entity_type
// today (Ch.32 minimal instance, unchanged from before this pass). A
// non-Deliverable Command (none exist yet) gets a Work Item with a null
// execution_context, same as before this design.
//
// governance_outcome_id (CR-109 §6.1/§6.2) is read here, not re-derived:
// constraints/activeObligations come off the Governance Evaluation Outcome
// executionEngine.execute() already persisted, per §6.3's own field mapping
// — everything else (objective, input/output location, Decisions/Evidence/
// Knowledge) is resolved fresh against the Deliverable, since none of that
// was ever Governance's concern to decide.
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { capabilitiesDB } from "../../dblayer/capabilitiesDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { governanceEvaluationOutcomesDB } from "../../dblayer/governanceEvaluationOutcomesDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { authorityRulesDB } from "../../dblayer/authorityRulesDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { attentionItemsDB } from "../../dblayer/attentionItemsDB.js";
import { qualityGatesDB } from "../../dblayer/qualityGatesDB.js";
import { eventBus } from "./eventBus.js";
import type { CommandRow, WorkItemExecutionContext, WorkItemRow } from "../../dblayer/seuTypes.js";

// Mirrors profiles.ts's own KnowledgeLocation shape (routes/seu/core) without
// importing it — engine layer never calls back into core (Ch.30 boundary).
interface KnowledgeLocationEntry {
  deliverableCode?: string;
  capabilityCode?: string;
  inputLocation?: string;
  outputLocation?: string;
}

// Migration 229/profileCompositionUnravel.ts — one {deliverableCode |
// capabilityCode, inputLocation, outputLocation} entry per Deliverable/
// Capability that needs one, carried on the EBM's own behaviors.pool. Keyed
// by canonical Ontology codes (migration 236's own header: labels/names are
// never canonical — deliverable.name is a resolved display label, not a
// join key), so this matches against deliverable.code, not deliverable.name.
async function resolveKnowledgeLocation(seuId: string, deliverableCode: string | null, capabilityCode: string | null): Promise<{ inputLocation: string | null; outputLocation: string | null }> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return { inputLocation: null, outputLocation: null };
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  const pool = (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown }> } | null)?.pool ?? [];
  const entries = (pool.find((e) => e.propertyName === "knowledgeLocations")?.value as KnowledgeLocationEntry[] | undefined) ?? [];
  const match = (deliverableCode ? entries.find((e) => e.deliverableCode === deliverableCode) : undefined) ?? (capabilityCode ? entries.find((e) => e.capabilityCode === capabilityCode) : undefined);
  return { inputLocation: match?.inputLocation ?? null, outputLocation: match?.outputLocation ?? null };
}

async function buildDeliverableExecutionContext(command: CommandRow): Promise<WorkItemExecutionContext | null> {
  const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
  if (!deliverable) return null;

  const service = deliverable.producing_capability_id ? (await capabilitiesDB.findById(deliverable.producing_capability_id)).data ?? null : null;
  const { inputLocation, outputLocation } = await resolveKnowledgeLocation(command.seu_id, deliverable.code, service?.code ?? null);

  const [{ data: decisions }, { data: evidence }, { data: knowledge }] = await Promise.all([
    decisionsDB.findByRelatedObject("Deliverable", deliverable.id),
    evidenceDB.findByRelatedObject("Deliverable", deliverable.id),
    knowledgeItemsDB.findByDeliverableId(deliverable.id),
  ]);

  let governingPolicies: WorkItemExecutionContext["governingPolicies"] = [];
  let applicableAuthority: WorkItemExecutionContext["applicableAuthority"] = null;
  let activeObligations: WorkItemExecutionContext["activeObligations"] = [];
  let openAttentionItems: WorkItemExecutionContext["openAttentionItems"] = [];
  let qualityGate: WorkItemExecutionContext["qualityGate"] = null;

  if (command.governance_outcome_id) {
    const { data: outcome } = await governanceEvaluationOutcomesDB.findById(command.governance_outcome_id);
    if (outcome) {
      const [{ data: policies }, authorityRule, obligations, attentionItems] = await Promise.all([
        policiesDB.findByIds(outcome.satisfied_policy_ids),
        outcome.applicable_authority_rule_id ? authorityRulesDB.findById(outcome.applicable_authority_rule_id) : Promise.resolve({ data: null }),
        Promise.all(outcome.consulted_obligation_ids.map((id) => obligationsDB.findById(id))),
        Promise.all(outcome.open_attention_item_ids.map((id) => attentionItemsDB.findById(id))),
      ]);
      governingPolicies = (policies ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name }));
      applicableAuthority = authorityRule?.data ? { ruleId: authorityRule.data.id, code: authorityRule.data.code } : null;
      activeObligations = obligations.map((o) => o.data).filter((o): o is NonNullable<typeof o> => !!o).map((o) => ({ id: o.id, title: o.title, status: o.status }));
      openAttentionItems = attentionItems.map((a) => a.data).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ id: a.id, title: a.title, status: a.status }));
      if (outcome.quality_gate_id && outcome.quality_gate_outcome) {
        const { data: gates } = await qualityGatesDB.findByIds([outcome.quality_gate_id]);
        const gate = gates?.[0];
        qualityGate = { id: outcome.quality_gate_id, name: gate?.name ?? outcome.quality_gate_id, outcome: outcome.quality_gate_outcome };
      }
    }
  }

  return {
    engineeringObjective: deliverable.name,
    relevantDeliverable: { id: deliverable.id, name: deliverable.name, lifecycleState: deliverable.lifecycle_state },
    service: service ? { capabilityId: service.id, code: service.code, name: service.name } : null,
    inputLocation,
    outputLocation,
    relevantDecisions: (decisions ?? []).map((d) => ({ id: d.id, title: d.title, engineeringQuestion: d.engineering_question, status: d.status })),
    supportingEvidence: (evidence ?? []).map((e) => ({ id: e.id, title: e.title, status: e.status, confidenceLevel: e.confidence_level })),
    relevantKnowledge: (knowledge ?? []).map((k) => ({ id: k.id, title: k.title, status: k.status })),
    governingPolicies,
    applicableAuthority,
    activeObligations,
    openAttentionItems,
    qualityGate,
  };
}

export const workItemGenerator = {
  // targetCompletionAt: the assigner's explicit deadline override (Participant
  // Integration Plan step 4), carried through from CommandGenerated's own
  // payload — not derived here, this function never decides it. Threaded
  // onto WorkItemGenerated's own payload so the (future) consumer that calls
  // dispatchEngine.dispatch() still has it, now that generation and dispatch
  // no longer run in the same call stack as the caller that received it.
  async generate(input: { command: CommandRow; seuId: string | null; correlationId: string; causationEventId: string | null; targetCompletionAt?: string | null }): Promise<WorkItemRow> {
    const executionContext = input.command.entity_type === "Deliverable" ? await buildDeliverableExecutionContext(input.command) : null;

    const { data: workItem, error } = await workItemsDB.create({ commandId: input.command.id, executionContext });
    if (error || !workItem) throw error ?? new Error("failed to generate work item");

    await eventBus.publish({
      eventType: "WorkItemGenerated",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      causationId: input.causationEventId,
      payload: { commandId: input.command.id, targetCompletionAt: input.targetCompletionAt ?? null },
    });

    return workItem;
  },
};
