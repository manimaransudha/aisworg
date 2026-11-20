import { logger } from "../utils/logger.js";
import { participantsDB } from "../dblayer/participantsDB.js";
import {
  AI_RUN_FAILURE_ATTENTION_CATEGORY, AI_RUN_FAILURE_ATTENTION_PRIORITY, AI_SKILL_JOB_ANTHROPIC_TYPE, AI_SKILL_TYPES, ANTHROPIC_ADAPTER_KEY,
} from "../dblayer/constants.js";
import { executionContextMarkdown } from "../routes/seu/core/executionContextMarkdown.js";
import type { AssignmentDeliveryResult, AssignmentOut, ParticipantAdapter, ResolvedExecutionTarget } from "./participantAdapter.js";
import { resolveAiProviderClient, type AiProviderClient } from "./aiProviderClient.js";
import { selectSkills, withoutSkills, type SelectedSkills } from "./aiSkills.js";
import { composeAnthropicPrompt } from "./anthropicPrompt.js";
import { createPlatformToolHandler, PLATFORM_TOOLS } from "./aiTools.js";

// The screen of an AI Participant that runs on Anthropic. It keeps the protocol skill, the bootstrap instruction and the Anthropic job skill
// from the Work Item, composes the prompt, runs the provider client with the platform tools, and raises an Attention Item for the Participant
// when a run fails. The client is registered under the adapter key, so the adapter holds no provider credentials of its own.

async function participantMasterIdOf(participantRowId: string): Promise<string> {
  const { data: participant } = await participantsDB.findById(participantRowId);
  if (!participant?.participant_id) throw new Error(`Participant ${participantRowId} has no participants_master identity, so it cannot act on the platform`);
  return participant.participant_id;
}

// One run of the model for one assignment. It resolves when the model stops.
export async function runAnthropicAssignment(assignment: AssignmentOut, skills: SelectedSkills, client: AiProviderClient): Promise<void> {
  const participantMasterId = await participantMasterIdOf(assignment.participantId);
  const workItemMarkdown = assignment.executionContext ? executionContextMarkdown(withoutSkills(assignment.executionContext, AI_SKILL_TYPES)) : "";
  const { system, prompt } = composeAnthropicPrompt({ skills, workItemMarkdown, deliverableName: assignment.deliverable.name });
  await client.run({ seuId: assignment.seuId, system, prompt, tools: PLATFORM_TOOLS }, createPlatformToolHandler({ seuId: assignment.seuId, deliverableId: assignment.deliverable.id, participantMasterId, inputLocation: assignment.executionContext?.inputLocation ?? null }));
}

// A failed run is the Participant's own Attention Item, so a human sees it where Participants raise theirs.
async function reportRunFailure(assignment: AssignmentOut, err: Error): Promise<void> {
  const { raiseMyAttentionItem } = await import("../routes/seu/core/participantHome.js");
  const participantMasterId = await participantMasterIdOf(assignment.participantId);
  const result = await raiseMyAttentionItem({
    userId: participantMasterId, seuId: assignment.seuId, deliverableId: assignment.deliverable.id,
    category: AI_RUN_FAILURE_ATTENTION_CATEGORY, priority: AI_RUN_FAILURE_ATTENTION_PRIORITY,
    title: "The AI run failed".slice(0, 100), description: err.message,
  });
  if (!result.ok) logger.error(`[anthropicAiAdapter] could not raise the failure Attention Item for Work Item ${assignment.workItemId}: ${result.detail}`);
}

export const anthropicAiAdapter: ParticipantAdapter = {
  mode: ANTHROPIC_ADAPTER_KEY,
  async deliverAssignment(assignment: AssignmentOut, _target: ResolvedExecutionTarget): Promise<AssignmentDeliveryResult> {
    // What the run needs is checked here, so a missing skill or client surfaces in the delivery handler and not in a run nobody awaits.
    const skills = selectSkills(assignment.executionContext, AI_SKILL_JOB_ANTHROPIC_TYPE);
    const client = resolveAiProviderClient(ANTHROPIC_ADAPTER_KEY);
    // The run can take minutes, so the delivery handler is not held. A failure becomes an Attention Item.
    void runAnthropicAssignment(assignment, skills, client).catch(async (err: Error) => {
      logger.error(`[anthropicAiAdapter] run for Work Item ${assignment.workItemId} failed`, err);
      try {
        await reportRunFailure(assignment, err);
      } catch (reportErr) {
        logger.error(`[anthropicAiAdapter] could not report the failure of Work Item ${assignment.workItemId}`, reportErr as Error);
      }
    });
    return { delivered: true, detail: "the AI run was started" };
  },
};
