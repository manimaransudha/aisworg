// CR-150: the pure parts of an AI adapter. Skill selection keeps the protocol skill, the bootstrap instruction and the adapter's own job skill,
// the prompt is composed from them, and the mock provider client plays its script. No database is used.
import { test } from "node:test";
import assert from "node:assert/strict";

import { selectSkills, withoutSkills } from "../src/adapters/aiSkills.js";
import { composeAnthropicPrompt } from "../src/adapters/anthropicPrompt.js";
import { createMockAiProviderClient } from "../src/adapters/mockAiProviderClient.js";
import { PLATFORM_TOOLS } from "../src/adapters/aiTools.js";
import { AI_SKILL_BOOTSTRAP_TYPE, AI_SKILL_JOB_ANTHROPIC_TYPE, AI_SKILL_PROTOCOL_TYPE, AI_SKILL_TYPES } from "../src/dblayer/constants.js";
import type { WorkItemExecutionContext } from "../src/dblayer/seuTypes.js";

const OTHER_PROVIDER_TYPE = "Skill Job Other Provider";

function context(entries: Array<{ type: string; url: string }>): WorkItemExecutionContext {
  return {
    engineeringObjective: "Objective", relevantDeliverable: { id: "d", name: "Deliverable", lifecycleState: "Defined" }, service: null, inputLocation: null, outputLocation: null,
    relevantDecisions: [], supportingEvidence: [], relevantKnowledge: [], governingPolicies: [], applicableAuthority: null, activeObligations: [], openAttentionItems: [], qualityGate: null,
    applicableChecklists: [], engineeringCapital: entries.map((e) => ({ packCode: "pack", ...e })), profileConfiguration: {},
  };
}

const ALL = context([
  { type: AI_SKILL_PROTOCOL_TYPE, url: "PROTOCOL TEXT" },
  { type: AI_SKILL_BOOTSTRAP_TYPE, url: "BOOTSTRAP TEXT" },
  { type: AI_SKILL_JOB_ANTHROPIC_TYPE, url: "ANTHROPIC JOB TEXT" },
  { type: OTHER_PROVIDER_TYPE, url: "OTHER PROVIDER JOB TEXT" },
  { type: "Engineering Behaviour", url: "https://example.test/standard" },
]);

test("an adapter keeps the protocol skill, the bootstrap instruction and its own job skill, and ignores the rest", () => {
  const skills = selectSkills(ALL, AI_SKILL_JOB_ANTHROPIC_TYPE);
  assert.deepEqual(skills, { protocol: "PROTOCOL TEXT", bootstrap: "BOOTSTRAP TEXT", job: "ANTHROPIC JOB TEXT" });
});

test("a skill the adapter needs and does not find is an error", () => {
  assert.throws(() => selectSkills(context([{ type: AI_SKILL_PROTOCOL_TYPE, url: "P" }]), AI_SKILL_JOB_ANTHROPIC_TYPE), new RegExp(`${AI_SKILL_BOOTSTRAP_TYPE}, ${AI_SKILL_JOB_ANTHROPIC_TYPE}`));
  assert.throws(() => selectSkills(null, AI_SKILL_JOB_ANTHROPIC_TYPE), /no execution context/);
});

test("the Work Item section of a prompt holds no skill entry", () => {
  const stripped = withoutSkills(ALL, [...AI_SKILL_TYPES, OTHER_PROVIDER_TYPE]);
  assert.deepEqual(stripped.engineeringCapital.map((e) => e.type), ["Engineering Behaviour"]);
});

test("the Anthropic prompt carries the three skills in tagged sections and ends with the output contract", () => {
  const { system, prompt } = composeAnthropicPrompt({ skills: selectSkills(ALL, AI_SKILL_JOB_ANTHROPIC_TYPE), workItemMarkdown: "WORK ITEM", deliverableName: "Requirements Analysis Model" });
  assert.ok(system.indexOf("<protocol_skill>") < system.indexOf("<job_skill>"), "the protocol skill comes before the job skill");
  for (const text of ["PROTOCOL TEXT", "BOOTSTRAP TEXT", "ANTHROPIC JOB TEXT"]) assert.ok(system.includes(text), `the system prompt holds ${text}`);
  assert.ok(!system.includes("OTHER PROVIDER JOB TEXT"));
  assert.ok(prompt.includes("<work_item>\nWORK ITEM\n</work_item>"));
  assert.ok(prompt.trimEnd().endsWith("</output_contract>"), "the output contract is last");
  assert.ok(prompt.includes("Requirements Analysis Model"));
});

test("the platform tools are the read of the input location and the five Participant operations", () => {
  assert.deepEqual(PLATFORM_TOOLS.map((t) => t.name), ["read_input_location", "provide_evidence", "create_knowledge", "create_decision", "raise_attention_item", "report_status"]);
});

test("the mock client plays its script, and a later step can use an earlier result", async () => {
  const client = createMockAiProviderClient([
    { tool: "first", input: { n: 1 } },
    { tool: "second", input: (earlier) => ({ saw: earlier[0]!.content }) },
  ]);
  const calls: Array<[string, Record<string, unknown>]> = [];
  await client.run({ seuId: "seu", system: "s", prompt: "p", tools: PLATFORM_TOOLS }, async (name, input) => {
    calls.push([name, input]);
    return { ok: true, content: `result of ${name}` };
  });
  assert.deepEqual(calls, [["first", { n: 1 }], ["second", { saw: "result of first" }]]);
  assert.equal(client.runs.length, 1);
});
