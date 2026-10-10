import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
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

interface KnowledgeLocationEntry {
  deliverableCode?: string;
  capabilityCode?: string;
  inputLocation?: string;
  outputLocation?: string;
}

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

function resolveKnowledgeLocation(pool: PoolEntry[], deliverableCode: string | null, capabilityCode: string | null): { inputLocation: string | null; outputLocation: string | null } {
  const entries = (pool.find((e) => e.propertyName === "knowledgeLocations")?.value as KnowledgeLocationEntry[] | undefined) ?? [];
  const match = (deliverableCode ? entries.find((e) => e.deliverableCode === deliverableCode) : undefined) ?? (capabilityCode ? entries.find((e) => e.capabilityCode === capabilityCode) : undefined);
  return { inputLocation: match?.inputLocation ?? null, outputLocation: match?.outputLocation ?? null };
}

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

async function resolveWorkItemAuthor(command: CommandRow): Promise<{ authorId: string; authorBadge: string }> {
  if (command.requested_by == null) throw new Error(`Command ${command.id} has no requested_by — cannot author its Work Item`);
  if (!command.acting_badge_type) throw new Error(`Command ${command.id} has no acting_badge_type — cannot author its Work Item`);
  const { data: master } = await participantsMasterDB.findById(command.requested_by);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(command.seu_id, master.id);
  if (!participant) throw new Error(`No participants row for participants_master ${master.id} in SEU ${command.seu_id}`);
  return { authorId: participant.id, authorBadge: command.acting_badge_type };
}

export const workItemGenerator = {
  async generate(input: { command: CommandRow; seuId: string | null; correlationId: string; causationEventId: string | null; targetCompletionAt?: string | null }): Promise<WorkItemRow> {
    const executionContext = input.command.entity_type === "Deliverable" ? await buildDeliverableExecutionContext(input.command) : null;
    const { authorId, authorBadge } = await resolveWorkItemAuthor(input.command);

    const { data: workItem, error } = await workItemsDB.create({ commandId: input.command.id, authorId, authorBadge, executionContext });
    if (error || !workItem) throw error ?? new Error("failed to generate work item");

    await eventBus.publish({
      eventType: "WorkItemGenerated",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      causationId: input.causationEventId,
      actorId: authorId,
      authorityBadge: authorBadge,
      payload: { commandId: input.command.id, targetCompletionAt: input.targetCompletionAt ?? null },
    });

    return workItem;
  },
};
