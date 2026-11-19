// The simulated Anthropic endpoint. It answers POST /v1/messages the way the Messages API does, and no model runs, so it uses no tokens.
// The turns are scripted from the conversation it receives: the AI provides Evidence, reports Completed with that Evidence, and stops.
// The turn logic and the wire formats are pure functions. The server is started by the running application only.
import http from "node:http";
import { ANTHROPIC_SIMULATOR_HOST, ANTHROPIC_SIMULATOR_PORT } from "../dblayer/constants.js";
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

const deliverableNameOf = (messages: SimulatedRequest["messages"]): string => {
  const first = messages.find((m) => m.role === "user");
  return /Deliverable "([^"]+)"/.exec(textOf(first?.content))?.[1] ?? "the Deliverable";
};

let toolSequence = 0;
const toolId = (): string => `toolu_simulated_${++toolSequence}`;

export function nextSimulatedTurn(request: SimulatedRequest): SimulatedTurn {
  const available = new Set((request.tools ?? []).map((tool) => tool.name));
  const calls = toolCallsOf(request.messages);
  const evidence = calls.find((c) => c.name === "provide_evidence");
  const text = (value: string): SimulatedBlock => ({ type: "text", text: value });

  if (!available.has("provide_evidence") || !available.has("report_status")) {
    return { blocks: [text("Simulated run: the platform tools are not offered, so there is nothing to do.")], stopReason: "end_turn" };
  }
  if (!evidence) {
    return {
      blocks: [
        text("Simulated run: providing Evidence for the Deliverable."),
        { type: "tool_use", id: toolId(), name: "provide_evidence", input: { category: "Analytical Evidence", title: `Simulated evidence for ${deliverableNameOf(request.messages)}`, description: "Produced by the simulated Anthropic endpoint. No model ran and no tokens were used." } },
      ],
      stopReason: "tool_use",
    };
  }
  if (evidence.result?.isError) {
    return { blocks: [text(`Simulated run: the platform did not accept the Evidence (${evidence.result.content}). No status was reported.`)], stopReason: "end_turn" };
  }
  if (!calls.some((c) => c.name === "report_status")) {
    const evidenceId = /id: (\S+)/.exec(evidence.result?.content ?? "")?.[1];
    return {
      blocks: [
        text("Simulated run: reporting the work as completed."),
        { type: "tool_use", id: toolId(), name: "report_status", input: { status: "completed", evidence_ids: evidenceId ? [evidenceId] : [] } },
      ],
      stopReason: "tool_use",
    };
  }
  return { blocks: [text("Simulated run finished.")], stopReason: "end_turn" };
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
