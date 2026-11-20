// CR-150: the turn logic and the wire formats of the simulated Anthropic endpoint. Pure functions only: no server is started and nothing is called.
import { test } from "node:test";
import assert from "node:assert/strict";

import { nextSimulatedTurn, toMessage, toStreamEvents, type SimulatedRequest } from "../src/adapters/simulatedAnthropic.js";

const TOOLS = ["provide_evidence", "create_knowledge", "raise_attention_item", "report_status"].map((name) => ({ name }));

// The shape executionContextMarkdown writes, wrapped in the tags the Anthropic prompt uses.
function prompt(options: { output: string; attention: string[] }): string {
  const attention = options.attention.length === 0 ? "_none_\n" : ["| Title | Status |", "| --- | --- |", ...options.attention.map((t) => `| ${t} | Created |`)].join("\n");
  return [
    "<work_item>", "## Source Code\n",
    "| Item | Value |", "| --- | --- |", "| Deliverable | Source Code (In Progress) |", "| Input location | https://guides.example.com/source-code |", `| Output location | ${options.output} |`, "",
    "### Obligations\n", "_none_\n", "### Open Attention Items\n", attention, "", "### Checklists\n", "| Pack | Checklist | Statement |", "| --- | --- | --- |", "| p | c | s1 |", "| p | c | s2 |",
    "</work_item>", 'Do the work for the Deliverable "Source Code". Use the tools.',
  ].join("\n");
}

const BLOCKED = prompt({ output: "—", attention: ["Deliverable is blocked by Policy X"] });
const CLEAR = prompt({ output: "https://git.example.com/out", attention: [] });

const conversation = (content: string, extra: SimulatedRequest["messages"] = []): SimulatedRequest => ({ tools: TOOLS, messages: [{ role: "user", content }, ...extra] });
const assistantCall = (id: string, name: string) => ({ role: "assistant", content: [{ type: "tool_use", id, name, input: {} }] });
const userResult = (id: string, content: string, isError = false) => ({ role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] });
const textOf = (turn: ReturnType<typeof nextSimulatedTurn>): string => turn.blocks.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("\n");
const callOf = (turn: ReturnType<typeof nextSimulatedTurn>) => {
  const block = turn.blocks.find((b) => b.type === "tool_use");
  assert.ok(block && block.type === "tool_use");
  return block;
};

// Skipped: the simulated Anthropic endpoint is demo scaffolding, and its tests are not maintained.
test.skip("the first turn narrates what it read in the Work Item and records the review as Evidence", () => {
  const turn = nextSimulatedTurn(conversation(BLOCKED));
  assert.equal(turn.stopReason, "tool_use");
  const said = textOf(turn);
  assert.ok(said.includes("Step 1. I read the whole execution context") && said.includes("The objective is Source Code"), said);
  assert.ok(said.includes("The output location is not set") && said.includes("1 Attention Item(s) are open") && said.includes('The first statement is "s1"'), said);
  assert.ok(said.includes("Step 3.") && said.includes("Step 4.") && said.includes("I report Blocked."), said);
  const call = callOf(turn);
  assert.equal(call.name, "provide_evidence");
  assert.equal(call.input.title, "Review of the Work Item for Source Code");
  // The Evidence description keeps the reasoning and states what was and was not done, which is how the page shows it.
  assert.ok(String(call.input.description).startsWith(said) && String(call.input.description).includes("Did not do: write source code"), String(call.input.description));
});

test.skip("the input location is kept as Knowledge, citing the Evidence the platform returned", () => {
  const call = callOf(nextSimulatedTurn(conversation(BLOCKED, [assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: ev-1")])));
  assert.equal(call.name, "create_knowledge");
  assert.equal(call.input.evidence_id, "ev-1");
  assert.equal(call.input.description, "https://guides.example.com/source-code");
});

test.skip("a Work Item with a blocker raises a blocking Attention Item and reports Blocked", () => {
  const evidenceAndKnowledge = [assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: ev-1"), assistantCall("t2", "create_knowledge"), userResult("t2", "Knowledge recorded. id: k-1")];
  const raise = callOf(nextSimulatedTurn(conversation(BLOCKED, evidenceAndKnowledge)));
  assert.equal(raise.name, "raise_attention_item");
  assert.equal(raise.input.blocks_progress, true);
  assert.equal(raise.input.title, "Output location is not set for Source Code");
  assert.ok(String(raise.input.title).length <= 100);

  const report = callOf(nextSimulatedTurn(conversation(BLOCKED, [...evidenceAndKnowledge, assistantCall("t3", "raise_attention_item"), userResult("t3", "Attention Item raised. id: a-1")])));
  assert.equal(report.name, "report_status");
  assert.deepEqual(report.input, { status: "blocked", evidence_ids: ["ev-1"] });
});

test.skip("a Work Item with no blocker reports Completed with the Evidence", () => {
  const history = [assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: ev-1"), assistantCall("t2", "create_knowledge"), userResult("t2", "Knowledge recorded. id: k-1")];
  const call = callOf(nextSimulatedTurn(conversation(CLEAR, history)));
  assert.equal(call.name, "report_status");
  assert.deepEqual(call.input, { status: "completed", evidence_ids: ["ev-1"] });
});

test.skip("the run ends with a final answer, and stops at the first call the platform refuses", () => {
  const history = [assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: ev-1"), assistantCall("t2", "create_knowledge"), userResult("t2", "Knowledge recorded. id: k-1"), assistantCall("t3", "report_status"), userResult("t3", "Completion recorded.")];
  const done = nextSimulatedTurn(conversation(CLEAR, history));
  assert.equal(done.stopReason, "end_turn");
  assert.ok(textOf(done).includes("<final_answer>"));

  const refusedEvidence = nextSimulatedTurn(conversation(CLEAR, [assistantCall("t1", "provide_evidence"), userResult("t1", "category is not canonical", true)]));
  assert.equal(refusedEvidence.stopReason, "end_turn");
  assert.ok(textOf(refusedEvidence).includes("category is not canonical"));

  const refusedStatus = nextSimulatedTurn(conversation(CLEAR, history.slice(0, 4).concat([assistantCall("t3", "report_status"), userResult("t3", "Completed needs no open Attention Item.", true)])));
  assert.equal(refusedStatus.stopReason, "end_turn");
  assert.ok(textOf(refusedStatus).includes("Completed needs no open Attention Item."));
});

test("with the platform tools not offered, the run stops at once", () => {
  assert.equal(nextSimulatedTurn({ tools: [], messages: [{ role: "user", content: CLEAR }] }).stopReason, "end_turn");
});

test.skip("the stream carries the events the Messages API streams, in order, and the tool input as one JSON delta", () => {
  const turn = nextSimulatedTurn(conversation(CLEAR));
  const events = toStreamEvents(turn, "claude-sonnet-5-5", "msg_1").split("\n\n").filter(Boolean).map((chunk) => chunk.split("\n")[0]!.replace("event: ", ""));
  assert.equal(events[0], "message_start");
  assert.deepEqual(events.slice(-2), ["message_delta", "message_stop"]);
  assert.ok(events.includes("content_block_start") && events.includes("content_block_delta") && events.includes("content_block_stop"));
  const delta = toStreamEvents(turn, "claude-sonnet-5-5", "msg_1").split("\n").find((line) => line.includes("input_json_delta"))!;
  const partial = JSON.parse(delta.replace("data: ", "")).delta.partial_json as string;
  assert.equal(JSON.parse(partial).category, "Analytical Evidence");
});

test.skip("the non-streaming message names the stop reason and holds no token usage", () => {
  const message = toMessage(nextSimulatedTurn(conversation(CLEAR)), "claude-sonnet-5-5", "msg_1") as { stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
  assert.equal(message.stop_reason, "tool_use");
  assert.deepEqual(message.usage, { input_tokens: 0, output_tokens: 0 });
});
