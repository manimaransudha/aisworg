import type { AiToolDefinition, AiToolHandler, AiToolResult } from "./aiProviderClient.js";

// The platform operations an AI Participant can use. Each runs the core function the Participant home runs, as the Participant,
// so the rules a human meets (Evidence to claim completion, a blocking Attention Item to report Blocked) reach the AI as text.
export interface PlatformToolContext {
  seuId: string;
  deliverableId: string;
  // The participants_master id of the Participant the Work Item was assigned to.
  participantMasterId: string;
}

const text = (name: string, description: string): Record<string, unknown> => ({ type: "string", description: `${name}: ${description}` });

export const PLATFORM_TOOLS: AiToolDefinition[] = [
  {
    name: "provide_evidence",
    description: "Record Evidence for this Deliverable. An artefact of the work is Evidence. Returns the Evidence id.",
    inputSchema: { type: "object", required: ["category", "title"], properties: { category: text("category", "an Evidence category"), title: text("title", "a short title"), description: text("description", "what the Evidence shows"), source: text("source", "where the artefact lives") } },
  },
  {
    name: "create_knowledge",
    description: "Record a reusable component or asset as Knowledge. Work Item artefacts are Evidence, not Knowledge. It must cite Evidence.",
    inputSchema: { type: "object", required: ["category", "title", "evidence_id"], properties: { category: text("category", "a Knowledge category"), title: text("title", "a short title"), description: text("description", "what the component is"), evidence_id: text("evidence_id", "the id of supporting Evidence") } },
  },
  {
    name: "create_decision",
    description: "Record a Decision between alternatives. It must cite at least one Knowledge item or one Evidence item.",
    inputSchema: {
      type: "object",
      required: ["category", "title", "alternatives"],
      properties: {
        category: text("category", "a Decision category"),
        title: text("title", "a short title, at most 100 characters"),
        engineering_question: text("engineering_question", "the question the Decision answers"),
        alternatives: { type: "array", items: { type: "object", required: ["statement"], properties: { statement: { type: "string" }, rationale: { type: "string" }, risk: { type: "string" }, status: { type: "string" } } } },
        knowledge_ids: { type: "array", items: { type: "string" } },
        evidence_ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "raise_attention_item",
    description: "Raise an Attention Item when you need a human or something prevents progress. Set blocks_progress when the Deliverable cannot progress without a fix.",
    inputSchema: { type: "object", required: ["category", "title"], properties: { category: text("category", "Escalation or Operational"), title: text("title", "a short title, at most 100 characters"), description: text("description", "the details"), priority: text("priority", "Very High, High, Medium or Low"), blocks_progress: { type: "boolean" } } },
  },
  {
    name: "report_status",
    description: "Report your status once, last. completed needs Evidence and no open Attention Item. completed_pending_attention needs Evidence and no open blocking Attention Item. blocked needs an open blocking Attention Item.",
    inputSchema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["completed", "completed_pending_attention", "blocked"] }, evidence_ids: { type: "array", items: { type: "string" } } } },
  },
];

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const optional = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

// The core modules are loaded when a tool runs, because they import the transition engine, which imports the adapter registry this module is part of.
export function createPlatformToolHandler(context: PlatformToolContext): AiToolHandler {
  return async (name, input): Promise<AiToolResult> => {
    try {
      switch (name) {
        case "provide_evidence": return await provideEvidence(context, input);
        case "create_knowledge": return await createKnowledge(context, input);
        case "create_decision": return await createDecision(context, input);
        case "raise_attention_item": return await raiseAttentionItem(context, input);
        case "report_status": return await reportStatus(context, input);
        default: return { ok: false, content: `Unknown tool "${name}".` };
      }
    } catch (err) {
      return { ok: false, content: (err as Error).message };
    }
  };
}

async function provideEvidence(context: PlatformToolContext, input: Record<string, unknown>): Promise<AiToolResult> {
  const { createEvidence } = await import("../routes/seu/core/evidence.js");
  const { transitionDefinitionsDB } = await import("../dblayer/transitionDefinitionsDB.js");
  const { badgeAuthorityEngine } = await import("../domain/engine/badgeAuthorityEngine.js");
  // The badge is the one the Evidence birth hop requires, read from its Transition Definition.
  const { data: birth, error } = await transitionDefinitionsDB.findBirth("Evidence");
  if (error) throw error;
  if (!birth?.verb) throw new Error("the Evidence birth Transition Definition names no verb");
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(context.participantMasterId, `evidence_${birth.verb}`);
  const evidence = await createEvidence({
    seuId: context.seuId, relatedObjectType: "Deliverable", relatedObjectId: context.deliverableId,
    category: String(input.category ?? ""), title: String(input.title ?? ""), description: optional(input.description), source: optional(input.source),
    actorId: context.participantMasterId, authorBadge,
  });
  return { ok: true, content: `Evidence recorded. id: ${evidence.id}` };
}

async function createKnowledge(context: PlatformToolContext, input: Record<string, unknown>): Promise<AiToolResult> {
  const { createKnowledgeItem } = await import("../routes/seu/core/knowledge.js");
  const evidenceId = String(input.evidence_id ?? "");
  const item = await createKnowledgeItem({
    seuId: context.seuId, deliverableId: context.deliverableId, category: String(input.category ?? ""), title: String(input.title ?? ""), description: optional(input.description),
    evidenceReferences: evidenceId ? { supports: [evidenceId] } : undefined, actorId: context.participantMasterId,
  });
  return { ok: true, content: `Knowledge recorded. id: ${item.id}` };
}

async function createDecision(context: PlatformToolContext, input: Record<string, unknown>): Promise<AiToolResult> {
  const { createDecisionFromForm } = await import("../routes/seu/core/decisionForm.js");
  const alternatives = Array.isArray(input.alternatives) ? (input.alternatives as Array<Record<string, unknown>>) : [];
  const decision = await createDecisionFromForm({
    seuId: context.seuId, actorId: context.participantMasterId,
    body: {
      deliverableId: context.deliverableId, category: input.category, title: input.title, engineeringQuestion: input.engineering_question,
      alternativeStatement: alternatives.map((a) => String(a.statement ?? "")),
      alternativeRationale: alternatives.map((a) => String(a.rationale ?? "")),
      alternativeRisk: alternatives.map((a) => String(a.risk ?? "")),
      alternativeStatus: alternatives.map((a) => String(a.status ?? "")),
      knowledgeId: strings(input.knowledge_ids), evidenceId: strings(input.evidence_ids),
    },
  });
  return { ok: true, content: `Decision recorded. id: ${decision.id}` };
}

async function raiseAttentionItem(context: PlatformToolContext, input: Record<string, unknown>): Promise<AiToolResult> {
  const { raiseMyAttentionItem } = await import("../routes/seu/core/participantHome.js");
  const result = await raiseMyAttentionItem({
    userId: context.participantMasterId, seuId: context.seuId, deliverableId: context.deliverableId,
    category: String(input.category ?? ""), title: String(input.title ?? ""), description: optional(input.description), priority: optional(input.priority), blocksProgress: input.blocks_progress === true,
  });
  return result.ok ? { ok: true, content: `Attention Item raised. id: ${result.attentionItem.id}` } : { ok: false, content: result.detail };
}

async function reportStatus(context: PlatformToolContext, input: Record<string, unknown>): Promise<AiToolResult> {
  const { reportMyStatus } = await import("../routes/seu/core/participantHome.js");
  const result = await reportMyStatus({
    userId: context.participantMasterId, seuId: context.seuId, deliverableId: context.deliverableId,
    status: input.status as "completed" | "completed_pending_attention" | "blocked", evidenceIds: strings(input.evidence_ids),
  });
  return result.ok ? { ok: true, content: result.message } : { ok: false, content: result.detail };
}
