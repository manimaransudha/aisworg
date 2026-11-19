import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_EFFORT, ANTHROPIC_FALLBACK_BETA, ANTHROPIC_MAX_TOKENS, ANTHROPIC_MAX_TURNS, ANTHROPIC_MODEL } from "../dblayer/constants.js";
import type { AiProviderClient, AiRunRequest, AiRunResult, AiToolHandler } from "./aiProviderClient.js";

// The real Anthropic client. It runs the tool loop itself: one streamed request per turn, every tool call of the turn answered in one user message.
// It is built only by the server start-up, and it refuses to run under a test, so a test can never reach Anthropic.
function assertNotUnderTest(): void {
  if (process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT) throw new Error("the Anthropic client does not run under a test");
}

export function createAnthropicProviderClient(options: { resolveCredentials: (seuId: string) => Promise<{ apiKey: string; baseURL: string }> }): AiProviderClient {
  return {
    async run(request: AiRunRequest, onToolCall: AiToolHandler): Promise<AiRunResult> {
      assertNotUnderTest();
      const credentials = await options.resolveCredentials(request.seuId);
      const client = new Anthropic({ apiKey: credentials.apiKey, baseURL: credentials.baseURL });
      const tools = request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema as Anthropic.Tool.InputSchema }));
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request.prompt }];

      for (let turn = 0; turn < ANTHROPIC_MAX_TURNS; turn++) {
        const response = await client.beta.messages
          .stream({
            model: ANTHROPIC_MODEL,
            max_tokens: ANTHROPIC_MAX_TOKENS,
            system: request.system,
            tools,
            messages,
            output_config: { effort: ANTHROPIC_EFFORT },
            betas: [ANTHROPIC_FALLBACK_BETA],
            fallbacks: "default",
          })
          .finalMessage();

        if (response.stop_reason === "refusal") throw new Error(`Anthropic refused the request (${response.stop_details?.category ?? "no category"})`);
        if (response.stop_reason === "max_tokens") throw new Error("Anthropic stopped at the output limit before the run finished");

        messages.push({ role: "assistant", content: response.content });
        const toolUses = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
        if (toolUses.length === 0) {
          return { finalText: response.content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text").map((block) => block.text).join("\n") };
        }

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          const result = await onToolCall(toolUse.name, (toolUse.input ?? {}) as Record<string, unknown>);
          results.push({ type: "tool_result", tool_use_id: toolUse.id, content: result.content, is_error: !result.ok });
        }
        messages.push({ role: "user", content: results });
      }
      throw new Error(`the run did not finish within ${ANTHROPIC_MAX_TURNS} turns`);
    },
  };
}
