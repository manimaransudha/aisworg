// CR-150: the turn logic and the wire formats of the simulated Anthropic endpoint. Pure functions only: no server is started and nothing is called.
import { test } from "node:test";
import assert from "node:assert/strict";

import { nextSimulatedTurn, toMessage, toStreamEvents, type SimulatedRequest } from "../src/adapters/simulatedAnthropic.js";

const TOOLS = [{ name: "provide_evidence" }, { name: "report_status" }];
const PROMPT = 'Do the work for the Deliverable "Requirements Analysis Model". Use the tools.';

function conversation(extra: SimulatedRequest["messages"] = []): SimulatedRequest {
  return { tools: TOOLS, messages: [{ role: "user", content: PROMPT }, ...extra] };
}

const assistantCall = (id: string, name: string) => ({ role: "assistant", content: [{ type: "tool_use", id, name, input: {} }] });
const userResult = (id: string, content: string, isError = false) => ({ role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] });

test("the first turn provides Evidence for the Deliverable named in the prompt", () => {
  const turn = nextSimulatedTurn(conversation());
  assert.equal(turn.stopReason, "tool_use");
  const call = turn.blocks.find((b) => b.type === "tool_use");
  assert.ok(call && call.type === "tool_use");
  assert.equal(call.name, "provide_evidence");
  assert.equal(call.input.title, "Simulated evidence for Requirements Analysis Model");
});

test("the second turn reports Completed with the Evidence id the platform returned", () => {
  const turn = nextSimulatedTurn(conversation([assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: abc-123")]));
  const call = turn.blocks.find((b) => b.type === "tool_use");
  assert.ok(call && call.type === "tool_use");
  assert.equal(call.name, "report_status");
  assert.deepEqual(call.input, { status: "completed", evidence_ids: ["abc-123"] });
});

test("the run stops after the status is reported, and after a refused Evidence", () => {
  const done = nextSimulatedTurn(conversation([assistantCall("t1", "provide_evidence"), userResult("t1", "Evidence recorded. id: abc"), assistantCall("t2", "report_status"), userResult("t2", "ok")]));
  assert.equal(done.stopReason, "end_turn");
  const refused = nextSimulatedTurn(conversation([assistantCall("t1", "provide_evidence"), userResult("t1", "category is not canonical", true)]));
  assert.equal(refused.stopReason, "end_turn");
  assert.ok(refused.blocks.some((b) => b.type === "text" && b.text.includes("category is not canonical")));
});

test("with the platform tools not offered, the run stops at once", () => {
  assert.equal(nextSimulatedTurn({ tools: [], messages: [{ role: "user", content: PROMPT }] }).stopReason, "end_turn");
});

test("the stream carries the events the Messages API streams, in order, and the tool input as one JSON delta", () => {
  const turn = nextSimulatedTurn(conversation());
  const events = toStreamEvents(turn, "claude-sonnet-5-5", "msg_1").split("\n\n").filter(Boolean).map((chunk) => chunk.split("\n")[0]!.replace("event: ", ""));
  assert.equal(events[0], "message_start");
  assert.deepEqual(events.slice(-2), ["message_delta", "message_stop"]);
  assert.ok(events.includes("content_block_start") && events.includes("content_block_delta") && events.includes("content_block_stop"));
  const delta = toStreamEvents(turn, "claude-sonnet-5-5", "msg_1").split("\n").find((line) => line.includes("input_json_delta"))!;
  const partial = JSON.parse(delta.replace("data: ", "")).delta.partial_json as string;
  assert.equal(JSON.parse(partial).category, "Analytical Evidence");
});

test("the non-streaming message names the stop reason and holds no token usage", () => {
  const message = toMessage(nextSimulatedTurn(conversation()), "claude-sonnet-5-5", "msg_1") as { stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
  assert.equal(message.stop_reason, "tool_use");
  assert.deepEqual(message.usage, { input_tokens: 0, output_tokens: 0 });
});
