import type { SelectedSkills } from "./aiSkills.js";

// The Anthropic shaped prompt: tagged sections, the protocol skill before the job skill, the Work Item after the skills, the output contract last.
export interface AnthropicPrompt {
  system: string;
  prompt: string;
}

export function composeAnthropicPrompt(input: { skills: SelectedSkills; workItemMarkdown: string; deliverableName: string }): AnthropicPrompt {
  const system = [
    "<bootstrap>", input.skills.bootstrap, "</bootstrap>",
    "<protocol_skill>", input.skills.protocol, "</protocol_skill>",
    "<job_skill>", input.skills.job, "</job_skill>",
  ].join("\n");
  const prompt = [
    "<work_item>", input.workItemMarkdown, "</work_item>",
    "<output_contract>",
    `Do the work for the Deliverable "${input.deliverableName}". Read the input location with read_input_location. Use the platform tools to provide Evidence and to raise Attention Items. Give the output in the Evidence description.`,
    "Think before you act. State your final answer in a separate <final_answer> section.",
    "Call report_status once, last.",
    "</output_contract>",
  ].join("\n");
  return { system, prompt };
}
