// The simulated Anthropic endpoint. It answers POST /v1/messages the way the Messages API does, and no model runs, so it uses no tokens.
// The turns are scripted from the Work Item in the conversation it receives. It reads the context, picks the closest of the situations below and plays that conversation.
// The turn logic and the wire formats are pure functions. The server is started by the running application only.
import http from "node:http";
import {
  ANTHROPIC_SIMULATOR_HOST, ANTHROPIC_SIMULATOR_PORT, SIMULATOR_ATTENTION_CATEGORY, SIMULATOR_ATTENTION_NON_BLOCKING_PRIORITY, SIMULATOR_ATTENTION_PRIORITY,
  SIMULATOR_ATTENTION_TITLE_MAX_LENGTH, SIMULATOR_DECISION_CATEGORY, SIMULATOR_DECISION_CHOSEN_STATUS, SIMULATOR_DECISION_REJECTED_STATUS, SIMULATOR_EVIDENCE_CATEGORY,
  SIMULATOR_KNOWLEDGE_CATEGORY, SIMULATOR_REQUIREMENTS_SERVICE_PATTERN,
} from "../dblayer/constants.js";
import { logger } from "../utils/logger.js";

type Json = Record<string, unknown>;

export interface SimulatedRequest {
  model?: string;
  stream?: boolean;
  tools?: Array<{ name: string }>;
  messages: Array<{ role: string; content: string | Json[] }>;
}

export type SimulatedBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Json };

export interface SimulatedTurn {
  blocks: SimulatedBlock[];
  stopReason: "tool_use" | "end_turn";
}

interface ToolCall {
  name: string;
  result: { content: string; isError: boolean } | null;
}

const textOf = (content: unknown): string =>
  typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => (part && typeof part === "object" && typeof (part as Json).text === "string" ? String((part as Json).text) : "")).join("") : "";

// The tools the conversation called so far, each with the result the platform returned.
function toolCallsOf(messages: SimulatedRequest["messages"]): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (message.role === "assistant" && block.type === "tool_use") calls.set(String(block.id), { name: String(block.name), result: null });
      if (message.role === "user" && block.type === "tool_result") {
        const call = calls.get(String(block.tool_use_id));
        if (call) call.result = { content: textOf(block.content), isError: block.is_error === true };
      }
    }
  }
  return [...calls.values()];
}

// What the Work Item says, read from the markdown of the first user message. The markdown is the one executionContextMarkdown writes.
interface WorkItemFacts {
  deliverable: string;
  deliverableState: string | null;
  service: string | null;
  serviceCode: string | null;
  recorded: { decisions: number; evidence: number; knowledge: number };
  profile: { language: string | null; sourceControl: string | null; methodology: string | null };
  checklist: string[];
  objective: string | null;
  inputLocation: string | null;
  outputLocation: string | null;
  openAttentionItems: string[];
  obligations: string[];
}

const ABSENT = "—";

function workItemFactsOf(messages: SimulatedRequest["messages"]): WorkItemFacts {
  const prompt = textOf(messages.find((m) => m.role === "user")?.content);
  const markdown = /<work_item>([\s\S]*?)<\/work_item>/.exec(prompt)?.[1] ?? "";
  const rows = (heading: string): string[][] => {
    const section = new RegExp(`### ${heading}\\n([\\s\\S]*?)(?=\\n### |$)`).exec(markdown)?.[1] ?? "";
    return section
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .slice(2)
      .map((line) => line.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((part) => part.trim().replace(/\\\|/g, "|")));
  };
  const field = (name: string): string | null => {
    const value = new RegExp(`^\\| ${name} \\| (.*) \\|$`, "m").exec(markdown)?.[1]?.trim();
    return value && value !== ABSENT ? value : null;
  };
  const profile = new Map(rows("Profile Configuration").map((r) => [r[0] ?? "", r[1] ?? ""]));
  return {
    deliverable: /Deliverable "([^"]+)"/.exec(prompt)?.[1] ?? "the Deliverable",
    deliverableState: /\(([^)]+)\)$/.exec(field("Deliverable") ?? "")?.[1] ?? null,
    service: field("Service")?.replace(/\s*\([^)]*\)$/, "") ?? null,
    serviceCode: /\(([^)]+)\)$/.exec(field("Service") ?? "")?.[1] ?? null,
    recorded: { decisions: rows("Decisions").length, evidence: rows("Evidence").length, knowledge: rows("Knowledge").length },
    profile: { language: profile.get("primaryProgrammingLanguage") ?? null, sourceControl: profile.get("sourceControlProvider") ?? null, methodology: profile.get("developmentMethodology") ?? null },
    checklist: rows("Checklists").map((r) => r[2] ?? "").filter(Boolean),
    objective: /^## (.+)$/m.exec(markdown)?.[1]?.trim() ?? null,
    inputLocation: field("Input location"),
    outputLocation: field("Output location"),
    openAttentionItems: rows("Open Attention Items").map((r) => r[0] ?? ""),
    obligations: rows("Obligations").map((r) => r[0] ?? ""),
  };
}

let toolSequence = 0;
const toolId = (): string => `toolu_simulated_${++toolSequence}`;

const idOf = (call: ToolCall | undefined): string | undefined => /id: (\S+)/.exec(call?.result?.content ?? "")?.[1];

// ---------------------------------------------------------------------------------------------------------------------------------------
// The situations. The simulator reads the Work Item, scores every situation against it, and plays the closest one. A situation holds the
// reasoning the AI states, the Evidence it records, the tool calls that follow, and the statuses it tries to report. Edit the texts here.
// To add a situation, add an entry to SITUATIONS with the conditions that select it. A condition adds its weight when the Work Item meets it.
// The situation with the highest total plays, and a tie goes to the one listed first.
// ---------------------------------------------------------------------------------------------------------------------------------------

interface SituationContext {
  evidenceId: string | undefined;
}

interface Step {
  // The step is left out when this returns false.
  when?: (f: WorkItemFacts) => boolean;
  say: (f: WorkItemFacts) => string;
  tool: string;
  input: (f: WorkItemFacts, c: SituationContext) => Json;
}

interface Situation {
  name: string;
  when: Array<[number, (f: WorkItemFacts) => boolean]>;
  // The whole reasoning of the first turn. It is also the start of the Evidence description.
  reasoning: (f: WorkItemFacts) => string;
  evidence: (f: WorkItemFacts) => { title: string; did: string };
  // The tool calls after the Evidence, one per turn.
  steps: Step[];
  // The statuses to report, in the order to try them. A refused status moves on to the next.
  report: (f: WorkItemFacts) => string[];
  // What the final answer says after the status.
  summary: (f: WorkItemFacts) => string;
}

const outputMissing = (f: WorkItemFacts): boolean => !f.outputLocation;
const outputSet = (f: WorkItemFacts): boolean => !!f.outputLocation;
const inputMissing = (f: WorkItemFacts): boolean => !f.inputLocation;
const hasRecorded = (f: WorkItemFacts): boolean => f.recorded.decisions + f.recorded.evidence + f.recorded.knowledge > 0;
const isRequirementsService = (f: WorkItemFacts): boolean => SIMULATOR_REQUIREMENTS_SERVICE_PATTERN.test(f.serviceCode ?? "");
const hasOpenItems = (f: WorkItemFacts): boolean => f.openAttentionItems.length > 0;
const productOf = (f: WorkItemFacts): string => f.objective ?? f.deliverable;

// Steps 1 and 2 are the same in every situation: the AI reads the whole context and the checklists.
function reading(f: WorkItemFacts): string {
  const { recorded, profile } = f;
  const unrecorded = !hasRecorded(f);
  const titles = f.openAttentionItems.map((t) => `"${t}"`).join("; ");
  const lines = [
    "Step 1. I read the whole execution context before I write anything.",
    `- The objective is ${productOf(f)}. The Deliverable "${f.deliverable}" is ${f.deliverableState ?? "in progress"}.${f.service ? ` The Service is ${f.service}.` : ""}`,
    `- The input location is ${f.inputLocation ?? "not set"}. The output location is ${f.outputLocation ?? "not set"}.${f.outputLocation ? "" : " I should raise this as an Attention Item as this will block the deliverable. I will however create it in my cache."}`,
    ...(hasOpenItems(f)
      ? [`- ${f.openAttentionItems.length} Attention Item(s) are open: ${titles}. ${f.obligations.length} Obligation(s) are open. This will not impact the ${productOf(f)} I have to produce.`]
      : [`- No Attention Item is open. ${f.obligations.length} Obligation(s) are open.`]),
    unrecorded
      ? `- No Decision, Knowledge or Evidence is recorded yet that I can use to produce the ${productOf(f)}.`
      : `- Recorded already: ${recorded.decisions} Decision(s), ${recorded.evidence} Evidence item(s), ${recorded.knowledge} Knowledge item(s).`,
    ...(profile.language || profile.sourceControl || profile.methodology
      ? [`- The profile asks for ${profile.language ?? "no stated language"} on ${profile.sourceControl ?? "no stated source control"} with ${profile.methodology ?? "no stated methodology"}. I will use the information provided in the Work Item Sheet and ask if I do not find one.`]
      : []),
    "",
    f.checklist[0]
      ? `Step 2. The checklists in the context are my acceptance criteria. The first statement is "${f.checklist[0]}" I walk each statement against what I can do now.`
      : "Step 2. The context holds no checklist, so the objective is my acceptance criterion.",
  ];
  return lines.join("\n");
}

// An open Attention Item holds the Deliverable through an Obligation, and the AI leaves it alone.
const holdNote = (f: WorkItemFacts): string =>
  hasOpenItems(f) ? "\nStep 4. An open Attention Item holds the Deliverable through an Obligation. The protocol skill says I never bypass a Policy or an Obligation and that a human must fix the cause. I leave it as it is.\n" : "";

const CANNOT_OPEN = "None of my tools opens a URL or writes a file.";

const keepInputAsKnowledge: Step = {
  when: (f) => !!f.inputLocation,
  say: () => "The Evidence is recorded. Keeping the input location as Knowledge for whoever works on this Deliverable next.",
  tool: "create_knowledge",
  input: (f, c) => ({ category: SIMULATOR_KNOWLEDGE_CATEGORY, title: `Input location for ${f.deliverable}`, description: f.inputLocation, evidence_id: c.evidenceId }),
};

// The statuses to try when the situation does not say: Completed when nothing is open, otherwise Completed Pending Attention and, if the platform refuses it, Blocked.
const defaultReport = (f: WorkItemFacts): string[] => (hasOpenItems(f) ? ["completed_pending_attention", "blocked"] : ["completed"]);

const SITUATIONS: Situation[] = [
  {
    // The output location is missing, so the work has nowhere to go. The AI records what it did, raises a blocking Attention Item and reports Blocked.
    name: "output location missing",
    when: [[10, outputMissing]],
    reasoning: (f) => [
      reading(f), "",
      `Step 3. I read the input location. My tools can record Evidence, Knowledge, Decisions and Attention Items and report status. ${CANNOT_OPEN} I cannot read the guide and I cannot write the ${productOf(f)} to an output location that is not set.`,
      holdNote(f),
      `My plan. I record in Evidence what I did and did not do. ${f.inputLocation ? "I keep the input location as Knowledge. " : ""}I raise one blocking Attention Item for the missing output location. I report Blocked.`,
    ].join("\n"),
    evidence: (f) => ({
      title: `Review of the Work Item for ${f.deliverable}`,
      did: `Did: reviewed the objective, the locations, ${f.openAttentionItems.length} open Attention Item(s), ${f.obligations.length} open Obligation(s) and the checklists. Did not do: produce the ${productOf(f)}, because the output location is not set and no tool of mine writes files${f.inputLocation ? "; read the input guide, because no tool of mine opens a URL" : ""}.`,
    }),
    steps: [
      keepInputAsKnowledge,
      {
        say: (f) => `I cannot complete "${f.deliverable}": the output location is not set. Raising an Attention Item that blocks the Deliverable, so a person can act on it.`,
        tool: "raise_attention_item",
        input: (f) => ({
          category: SIMULATOR_ATTENTION_CATEGORY, priority: SIMULATOR_ATTENTION_PRIORITY, blocks_progress: true,
          title: `Output location is not set for ${f.deliverable}`.slice(0, SIMULATOR_ATTENTION_TITLE_MAX_LENGTH),
          description: `The Work Item has no output location, so the ${productOf(f)} has nowhere to be written. Please set the output location${hasOpenItems(f) ? ", and resolve the open Policy block," : ""} then dispatch the Work Item again.`,
        }),
      },
    ],
    report: () => ["blocked"],
    summary: (f) => `I recorded a review as Evidence, ${f.inputLocation ? "kept the input location as Knowledge, " : ""}and raised a blocking Attention Item because the output location is not set. I produced no ${productOf(f)}.${hasOpenItems(f) ? " The open Attention Item on the Deliverable needs a human." : ""}`,
  },
  {
    // The input location is missing. The AI works from the objective and the checklists and asks for the guide in an Attention Item that does not block.
    name: "input location missing",
    when: [[6, inputMissing], [1, outputSet]],
    reasoning: (f) => [
      reading(f), "",
      `Step 3. The input location is not set, so I have no guide to read. I work from the objective, the checklists and what the context records, and I ask for the guide. ${CANNOT_OPEN}`,
      holdNote(f),
      `My plan. I record in Evidence what I did and did not do. I raise an Attention Item that does not block, asking for the input location. I report Completed Pending Attention.`,
    ].join("\n"),
    evidence: (f) => ({
      title: `Work done on ${f.deliverable}`,
      did: `Did: reviewed the objective, the output location (${f.outputLocation ?? "not set"}) and the checklists, and described the ${productOf(f)} for the output location. Did not do: check the work against an input guide, because none is set; write files, because no tool of mine writes files.`,
    }),
    steps: [
      {
        say: (f) => `No guide is set for "${f.deliverable}". Raising an Attention Item that does not block, so a person can provide it.`,
        tool: "raise_attention_item",
        input: (f) => ({
          category: SIMULATOR_ATTENTION_CATEGORY, priority: SIMULATOR_ATTENTION_NON_BLOCKING_PRIORITY, blocks_progress: false,
          title: `Input location is not set for ${f.deliverable}`.slice(0, SIMULATOR_ATTENTION_TITLE_MAX_LENGTH),
          description: "The Work Item has no input location. I worked from the objective and the checklists. Please provide the guide so the work can be checked against it.",
        }),
      },
    ],
    report: () => ["completed_pending_attention", "blocked"],
    summary: (f) => `I recorded the work as Evidence and raised an Attention Item asking for the input location. It does not block, so the work is reported with that item open.${hasOpenItems(f) ? " The other open Attention Item on the Deliverable stays as it is." : ""}`,
  },
  {
    // The Deliverable already holds Decisions, Evidence or Knowledge. The AI reads them first and builds on them.
    name: "builds on recorded work",
    when: [[5, hasRecorded], [1, outputSet]],
    reasoning: (f) => [
      reading(f), "",
      `Step 3. The context already records ${f.recorded.decisions} Decision(s), ${f.recorded.evidence} Evidence item(s) and ${f.recorded.knowledge} Knowledge item(s). I read them first and build on them. I do not repeat them. ${CANNOT_OPEN}`,
      holdNote(f),
      "My plan. I record in Evidence what I added to the recorded work and what I did not do.",
    ].join("\n"),
    evidence: (f) => ({
      title: `Continuation of ${f.deliverable}`,
      did: `Did: read the recorded Decisions, Evidence and Knowledge and continued from them for the output location ${f.outputLocation ?? ""}. Did not do: open the input guide, because no tool of mine opens a URL; write files, because no tool of mine writes files.`,
    }),
    steps: [keepInputAsKnowledge],
    report: defaultReport,
    summary: () => "I built on the recorded work and recorded what I added as Evidence.",
  },
  {
    // A requirements Deliverable. The AI reads the requirements, makes Decisions on how to structure them, and keeps the structure as Knowledge.
    name: "requirements analysis",
    when: [[4, isRequirementsService], [1, outputSet]],
    reasoning: (f) => [
      reading(f), "",
      `Step 3. I cannot open the input location, so I work from the objective, the checklists and what the context records. ${CANNOT_OPEN} I read the requirements the checklists imply and decide how to structure them.`,
      holdNote(f),
      "My plan. I record the analysis as Evidence. I make two Decisions on how to structure the requirements, each citing that Evidence. I keep the structure as Knowledge. I report the status.",
    ].join("\n"),
    evidence: (f) => ({
      title: `Requirements analysis for ${f.deliverable}`,
      did: `Did: analysed the objective against ${Math.min(f.checklist.length, 2)} checklist statement(s) and chose a structure for the requirements. Did not do: open the input guide, because no tool of mine opens a URL; write files, because no tool of mine writes files.`,
    }),
    steps: [
      {
        say: (f) => `Decision 1 of 2. The checklist asks: "${f.checklist[0] ?? productOf(f)}" I need to choose how to organise the requirements.`,
        tool: "create_decision",
        input: (f, c) => ({
          category: SIMULATOR_DECISION_CATEGORY,
          title: `How to organise the requirements of ${f.deliverable}`.slice(0, SIMULATOR_ATTENTION_TITLE_MAX_LENGTH),
          engineering_question: `How should the requirements of ${f.deliverable} be organised so that "${f.checklist[0] ?? productOf(f)}"`,
          alternatives: [
            { statement: "Organise the requirements by capability", rationale: "Each capability owns its requirements, which matches the Service that produces them.", risk: "A requirement that spans capabilities is repeated.", status: SIMULATOR_DECISION_CHOSEN_STATUS },
            { statement: "Organise the requirements by stakeholder", rationale: "Each stakeholder need stays visible.", risk: "One capability is split across several stakeholders.", status: SIMULATOR_DECISION_REJECTED_STATUS },
          ],
          evidence_ids: c.evidenceId ? [c.evidenceId] : [],
        }),
      },
      {
        say: (f) => `Decision 2 of 2. ${f.checklist[1] ? `The next statement is "${f.checklist[1]}" ` : ""}I need to choose how each requirement is traced.`,
        tool: "create_decision",
        input: (f, c) => ({
          category: SIMULATOR_DECISION_CATEGORY,
          title: `How to trace the requirements of ${f.deliverable}`.slice(0, SIMULATOR_ATTENTION_TITLE_MAX_LENGTH),
          engineering_question: `How should each requirement of ${f.deliverable} be traced to the work that meets it?`,
          alternatives: [
            { statement: "Trace each requirement to a Deliverable", rationale: "A Deliverable is the unit the platform tracks, so the trace stays checkable.", risk: "A large Deliverable hides which requirement it meets.", status: SIMULATOR_DECISION_CHOSEN_STATUS },
            { statement: "Trace each requirement to a test only", rationale: "A test shows the requirement is met.", risk: "A requirement with no test cannot be traced.", status: SIMULATOR_DECISION_REJECTED_STATUS },
          ],
          evidence_ids: c.evidenceId ? [c.evidenceId] : [],
        }),
      },
      {
        say: () => "Both Decisions are recorded. Keeping the structure as Knowledge, because other Deliverables reuse it.",
        tool: "create_knowledge",
        input: (f, c) => ({
          category: SIMULATOR_KNOWLEDGE_CATEGORY, title: `Requirements structure for ${f.deliverable}`,
          description: "The requirements are organised by capability, and each requirement is traced to a Deliverable.", evidence_id: c.evidenceId,
        }),
      },
    ],
    report: defaultReport,
    summary: () => "I analysed the requirements, recorded the analysis as Evidence, made two Decisions that cite it and kept the structure as Knowledge.",
  },
  {
    // Every other Work Item with an output location. The AI describes what it produced as Evidence, and a person places it.
    name: "produce the deliverable",
    when: [[1, outputSet]],
    reasoning: (f) => [
      reading(f), "",
      `Step 3. I read the input location. ${CANNOT_OPEN} I describe the ${productOf(f)} I produce and where it belongs, in Evidence, so a person can place it in the output location.`,
      holdNote(f),
      `My plan. I record the ${productOf(f)} as Evidence for the output location. ${f.inputLocation ? "I keep the input location as Knowledge. " : ""}I report the status.`,
    ].join("\n"),
    evidence: (f) => ({
      title: `${f.deliverable} produced`,
      did: `Did: produced the ${productOf(f)} for the output location ${f.outputLocation ?? ""} and described it here. Did not do: open the input guide, because no tool of mine opens a URL; write files, because no tool of mine writes files.`,
    }),
    steps: [keepInputAsKnowledge],
    report: defaultReport,
    summary: (f) => `I recorded the ${productOf(f)} as Evidence for the output location${f.inputLocation ? " and kept the input location as Knowledge" : ""}.`,
  },
];

function chooseSituation(facts: WorkItemFacts): Situation {
  let best = SITUATIONS[0]!;
  let bestScore = -1;
  for (const situation of SITUATIONS) {
    const score = situation.when.reduce((sum, [weight, met]) => sum + (met(facts) ? weight : 0), 0);
    if (score > bestScore) {
      best = situation;
      bestScore = score;
    }
  }
  return best;
}

const STATUS_WORDS: Record<string, string> = { completed: "complete", completed_pending_attention: "complete, with Attention Items still open", blocked: "blocked" };

// The conversation is replayed in every request, so the turn follows from the Work Item and from the calls made so far: the Evidence, the steps of the
// chosen situation, then the status. A call the platform refuses ends the run, except a status, which moves on to the next status to try.
export function nextSimulatedTurn(request: SimulatedRequest): SimulatedTurn {
  const available = new Set((request.tools ?? []).map((tool) => tool.name));
  const calls = toolCallsOf(request.messages);
  const text = (value: string): SimulatedBlock => ({ type: "text", text: value });
  const use = (name: string, input: Json): SimulatedBlock => ({ type: "tool_use", id: toolId(), name, input });
  const stop = (value: string): SimulatedTurn => ({ blocks: [text(value)], stopReason: "end_turn" });

  if (!["provide_evidence", "create_knowledge", "create_decision", "raise_attention_item", "report_status"].every((name) => available.has(name))) {
    return stop("Simulated run: the platform tools are not offered, so there is nothing to do.");
  }
  const facts = workItemFactsOf(request.messages);
  const situation = chooseSituation(facts);
  const steps = situation.steps.filter((step) => !step.when || step.when(facts));
  const worked = calls.filter((c) => c.name !== "report_status");
  const reports = calls.filter((c) => c.name === "report_status");

  if (worked.length === 0) {
    const reasoning = situation.reasoning(facts);
    const evidence = situation.evidence(facts);
    // Protocol 6: the Evidence description states what was done and what was not. It keeps the reasoning, which is how the page shows it.
    return {
      blocks: [text(reasoning), use("provide_evidence", { category: SIMULATOR_EVIDENCE_CATEGORY, title: evidence.title, source: facts.inputLocation ?? undefined, description: `${reasoning}\n\n${evidence.did}` })],
      stopReason: "tool_use",
    };
  }
  const refused = worked.find((c) => c.result?.isError);
  if (refused) return stop(`The platform did not accept ${refused.name} (${refused.result?.content}). I stopped there and reported no status.`);

  if (worked.length - 1 < steps.length) {
    const step = steps[worked.length - 1]!;
    return { blocks: [text(step.say(facts)), use(step.tool, step.input(facts, { evidenceId: idOf(worked[0]) }))], stopReason: "tool_use" };
  }

  const tries = situation.report(facts);
  const last = reports[reports.length - 1];
  if (last && !last.result?.isError) {
    return stop(`<final_answer>"${facts.deliverable}" is ${STATUS_WORDS[tries[reports.length - 1] ?? ""] ?? "reported"}. ${situation.summary(facts)}</final_answer>`);
  }
  if (last && reports.length >= tries.length) return stop(`The platform did not accept my status report: ${last.result?.content}`);
  const status = tries[reports.length]!;
  const say = last
    ? `The platform refused: ${last.result?.content} Reporting the Deliverable as ${STATUS_WORDS[status] ?? status}.`
    : status === "completed" ? "Nothing blocks the work. Reporting it as completed."
    : status === "completed_pending_attention" ? "Attention Items are open, and none of them blocks the work I did. Reporting it as completed pending attention."
    : "Reporting the Deliverable as blocked.";
  return { blocks: [text(say), use("report_status", { status, evidence_ids: idOf(worked[0]) ? [idOf(worked[0])] : [] })], stopReason: "tool_use" };
}

const messageId = (): string => `msg_simulated_${Date.now()}`;
const sse = (event: string, data: Json): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// The turn as the server-sent events the Messages API streams.
export function toStreamEvents(turn: SimulatedTurn, model: string, id: string): string {
  const out: string[] = [
    sse("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } }),
  ];
  turn.blocks.forEach((block, index) => {
    if (block.type === "text") {
      out.push(sse("content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } }));
      out.push(sse("content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } }));
    } else {
      out.push(sse("content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } }));
      out.push(sse("content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } }));
    }
    out.push(sse("content_block_stop", { type: "content_block_stop", index }));
  });
  out.push(sse("message_delta", { type: "message_delta", delta: { stop_reason: turn.stopReason, stop_sequence: null }, usage: { output_tokens: 0 } }));
  out.push(sse("message_stop", { type: "message_stop" }));
  return out.join("");
}

// The turn as the Messages API returns it when the request does not stream.
export function toMessage(turn: SimulatedTurn, model: string, id: string): Json {
  return { id, type: "message", role: "assistant", model, content: turn.blocks, stop_reason: turn.stopReason, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } };
}

function reply(res: http.ServerResponse, status: number, body: Json): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startSimulatedAnthropicServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    if (req.method !== "POST" || path !== "/v1/messages") return reply(res, 404, { type: "error", error: { type: "not_found_error", message: `the simulated Anthropic endpoint serves POST /v1/messages only, not ${req.method} ${path}` } });
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let request: SimulatedRequest;
      try {
        request = JSON.parse(raw) as SimulatedRequest;
        if (!Array.isArray(request.messages)) throw new Error("messages is required");
      } catch (err) {
        return reply(res, 400, { type: "error", error: { type: "invalid_request_error", message: (err as Error).message } });
      }
      const turn = nextSimulatedTurn(request);
      const model = request.model ?? "simulated-model";
      const id = messageId();
      if (request.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        res.end(toStreamEvents(turn, model, id));
      } else {
        reply(res, 200, toMessage(turn, model, id));
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(ANTHROPIC_SIMULATOR_PORT, ANTHROPIC_SIMULATOR_HOST, () => {
      logger.info(`Simulated Anthropic endpoint on http://${ANTHROPIC_SIMULATOR_HOST}:${ANTHROPIC_SIMULATOR_PORT}`);
      resolve(server);
    });
  });
}
