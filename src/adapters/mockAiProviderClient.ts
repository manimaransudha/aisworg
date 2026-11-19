import type { AiProviderClient, AiRunRequest, AiRunResult, AiToolHandler, AiToolResult } from "./aiProviderClient.js";

// One scripted tool call. The input may depend on the results of the earlier calls, for example the id of Evidence just provided.
export interface MockToolStep {
  tool: string;
  input: Record<string, unknown> | ((earlier: AiToolResult[]) => Record<string, unknown>);
}

export interface MockAiRun {
  request: AiRunRequest;
  results: AiToolResult[];
}

// A client that plays a fixed script, with no network. It records each request it received.
export function createMockAiProviderClient(steps: MockToolStep[], options?: { failWith?: Error }): AiProviderClient & { runs: MockAiRun[] } {
  const runs: MockAiRun[] = [];
  return {
    runs,
    async run(request: AiRunRequest, onToolCall: AiToolHandler): Promise<AiRunResult> {
      if (options?.failWith) throw options.failWith;
      const results: AiToolResult[] = [];
      runs.push({ request, results });
      for (const step of steps) {
        const input = typeof step.input === "function" ? step.input(results) : step.input;
        results.push(await onToolCall(step.tool, input));
      }
      return { finalText: "mock run finished" };
    },
  };
}
