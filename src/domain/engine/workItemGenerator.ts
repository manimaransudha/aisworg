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
// governingPolicies/applicableAuthority/openAttentionItems/qualityGate come
// off the Governance Evaluation Outcome executionEngine.execute() already
// persisted, per §6.3's own field mapping — everything else (objective,
// input/output location, Decisions/Evidence/Knowledge, and — CR-108
// follow-on — Obligations/Checklists/Engineering Capital/Profile
// Configuration) is resolved fresh against the Deliverable, since none of
// that was ever Governance's concern to decide.
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

// Local mirror of profileCompositionUnravel.ts's own PoolEntry/PoolSource
// shape (not imported — dblayer's own EbmRow.behaviors is deliberately typed
// loosely for the same reason, seuTypes.ts's own comment on that field).
interface PoolEntry {
  propertyName: string;
  value: unknown;
  source?: { code?: string };
}

async function loadEbmPool(seuId: string): Promise<PoolEntry[]> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return [];
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  return (ebm?.behaviors as { pool?: PoolEntry[] } | null)?.pool ?? [];
}

// Migration 229/profileCompositionUnravel.ts — one {deliverableCode |
// capabilityCode, inputLocation, outputLocation} entry per Deliverable/
// Capability that needs one, carried on the EBM's own behaviors.pool. Keyed
// by canonical Ontology codes (migration 236's own header: labels/names are
// never canonical — deliverable.name is a resolved display label, not a
// join key), so this matches against deliverable.code, not deliverable.name.
function resolveKnowledgeLocation(pool: PoolEntry[], deliverableCode: string | null, capabilityCode: string | null): { inputLocation: string | null; outputLocation: string | null } {
  const entries = (pool.find((e) => e.propertyName === "knowledgeLocations")?.value as KnowledgeLocationEntry[] | undefined) ?? [];
  const match = (deliverableCode ? entries.find((e) => e.deliverableCode === deliverableCode) : undefined) ?? (capabilityCode ? entries.find((e) => e.capabilityCode === capabilityCode) : undefined);
  return { inputLocation: match?.inputLocation ?? null, outputLocation: match?.outputLocation ?? null };
}

// Owner: "Engineering Capital and Checklists are part of a pack which shows
// contributing capability. If deliverable corresponds to the capability, it
// gets included in the workitem." Every pool entry a composed Pack
// contributes (its own Capability code included) carries that Pack's own
// code as source.code (profileCompositionUnravel.ts) — no new link needed,
// just matching on data the pool already carries: find which Pack(s)
// contributed this Deliverable's own producing Capability code, then collect
// those same Packs' checklistItem::/engineeringCapital:: entries.
function resolvePackContributedContent(pool: PoolEntry[], capabilityCode: string | null): { applicableChecklists: WorkItemExecutionContext["applicableChecklists"]; engineeringCapital: WorkItemExecutionContext["engineeringCapital"] } {
  if (!capabilityCode) return { applicableChecklists: [], engineeringCapital: [] };
  const contributingPackCodes = new Set(
    pool.filter((e) => e.propertyName === capabilityCode && e.source?.code).map((e) => e.source!.code!)
  );
  if (contributingPackCodes.size === 0) return { applicableChecklists: [], engineeringCapital: [] };

  const applicableChecklists: WorkItemExecutionContext["applicableChecklists"] = [];
  const engineeringCapital: WorkItemExecutionContext["engineeringCapital"] = [];
  for (const entry of pool) {
    const packCode = entry.source?.code;
    if (!packCode || !contributingPackCodes.has(packCode)) continue;
    if (entry.propertyName.startsWith("checklistItem::")) {
      // packCode comes off the entry's own source.code (reliable); checklistName
      // is the 3rd "::" segment — same convention ebm.ejs's own view already
      // established (safe even if the trailing JSON blob itself contains "::").
      const checklistName = entry.propertyName.split("::")[2];
      const item = entry.value as { statement?: string };
      if (item?.statement) applicableChecklists.push({ packCode, checklistName: checklistName ?? "", statement: item.statement });
    } else if (entry.propertyName.startsWith("engineeringCapital::")) {
      const ec = entry.value as { type?: string; url?: string };
      engineeringCapital.push({ packCode, type: ec?.type, url: ec?.url });
    }
  }
  return { applicableChecklists, engineeringCapital };
}

// Owner: "The relevant profile configuration parameters have to be in the
// work item. Like methodology, environment etc. dispatch_strategy is not
// relevant to a participant." Only the fields that describe how the work
// should actually be done — never Execution/Dispatch Engine or
// EBM-composition mechanics (dispatchStrategyPreference, redispatch*,
// compositionOptions, featureFlagCodes, additionalCapabilityCodes), which
// this Participant never acts on directly.
const PROFILE_CONFIGURATION_KEYS = [
  "developmentMethodology", "environment", "primaryProgrammingLanguage", "sourceControlProvider",
  "targetCloudProvider", "deploymentStrategy", "aiProviderPreference", "defaultRepositoryStructure",
  "documentationLevel", "readme", "domain", "participatingOrganisationCodes",
  "environmentConfiguration", "deploymentTargets",
] as const;

function resolveProfileConfiguration(pool: PoolEntry[]): WorkItemExecutionContext["profileConfiguration"] {
  const configuration: WorkItemExecutionContext["profileConfiguration"] = {};
  for (const key of PROFILE_CONFIGURATION_KEYS) {
    const entry = pool.find((e) => e.propertyName === key);
    if (entry !== undefined && entry.value !== undefined && entry.value !== null) (configuration as Record<string, unknown>)[key] = entry.value;
  }
  return configuration;
}

async function buildDeliverableExecutionContext(command: CommandRow): Promise<WorkItemExecutionContext | null> {
  const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
  if (!deliverable) return null;

  const service = deliverable.producing_capability_id ? (await capabilitiesDB.findById(deliverable.producing_capability_id)).data ?? null : null;
  const pool = await loadEbmPool(command.seu_id);
  const { inputLocation, outputLocation } = resolveKnowledgeLocation(pool, deliverable.code, service?.code ?? null);
  const { applicableChecklists, engineeringCapital } = resolvePackContributedContent(pool, service?.code ?? null);
  const profileConfiguration = resolveProfileConfiguration(pool);

  // Owner: "all associated with the deliverable" — activeObligations is
  // every Obligation raised against this Deliverable (open or resolved),
  // the same unscoped findByRelatedObject query relevantDecisions/
  // supportingEvidence/relevantKnowledge already use below, not just the
  // ones a specific Governance Evaluation Outcome happened to consult for
  // one particular transition attempt.
  const [{ data: decisions }, { data: evidence }, { data: knowledge }, { data: allObligations }] = await Promise.all([
    decisionsDB.findByRelatedObject("Deliverable", deliverable.id),
    evidenceDB.findByRelatedObject("Deliverable", deliverable.id),
    knowledgeItemsDB.findByDeliverableId(deliverable.id),
    obligationsDB.findByRelatedObject("Deliverable", deliverable.id),
  ]);
  const activeObligations: WorkItemExecutionContext["activeObligations"] = (allObligations ?? []).map((o) => ({ id: o.id, title: o.title, status: o.status }));

  let governingPolicies: WorkItemExecutionContext["governingPolicies"] = [];
  let applicableAuthority: WorkItemExecutionContext["applicableAuthority"] = null;
  let openAttentionItems: WorkItemExecutionContext["openAttentionItems"] = [];
  let qualityGate: WorkItemExecutionContext["qualityGate"] = null;

  if (command.governance_outcome_id) {
    const { data: outcome } = await governanceEvaluationOutcomesDB.findById(command.governance_outcome_id);
    if (outcome) {
      const [{ data: policies }, authorityRule, attentionItems] = await Promise.all([
        policiesDB.findByIds(outcome.satisfied_policy_ids),
        outcome.applicable_authority_rule_id ? authorityRulesDB.findById(outcome.applicable_authority_rule_id) : Promise.resolve({ data: null }),
        Promise.all(outcome.open_attention_item_ids.map((id) => attentionItemsDB.findById(id))),
      ]);
      governingPolicies = (policies ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name }));
      applicableAuthority = authorityRule?.data ? { ruleId: authorityRule.data.id, code: authorityRule.data.code } : null;
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
    applicableChecklists,
    engineeringCapital,
    profileConfiguration,
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
