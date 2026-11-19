import type { WorkItemExecutionContext } from "../dblayer/seuTypes.js";
import { AI_SKILL_BOOTSTRAP_TYPE, AI_SKILL_PROTOCOL_TYPE } from "../dblayer/constants.js";

export interface SelectedSkills {
  protocol: string;
  bootstrap: string;
  job: string;
}

const skillText = (context: WorkItemExecutionContext, type: string): string =>
  (context.engineeringCapital ?? [])
    .filter((entry) => entry.type === type && entry.url?.trim())
    .map((entry) => entry.url!.trim())
    .join("\n\n");

// The skills an adapter reads from the Work Item: the protocol skill, the bootstrap instruction and the job skill of its own provider.
// A skill an adapter needs and does not find is an error, because the AI would otherwise run without it.
export function selectSkills(context: WorkItemExecutionContext | null, jobSkillType: string): SelectedSkills {
  if (!context) throw new Error("the Work Item carries no execution context, so no skill can be selected");
  const selected = { protocol: skillText(context, AI_SKILL_PROTOCOL_TYPE), bootstrap: skillText(context, AI_SKILL_BOOTSTRAP_TYPE), job: skillText(context, jobSkillType) };
  const missing = (Object.entries({ [AI_SKILL_PROTOCOL_TYPE]: selected.protocol, [AI_SKILL_BOOTSTRAP_TYPE]: selected.bootstrap, [jobSkillType]: selected.job }) as Array<[string, string]>)
    .filter(([, text]) => !text)
    .map(([type]) => type);
  if (missing.length > 0) throw new Error(`the Work Item execution context holds no ${missing.join(", ")} skill`);
  return selected;
}

// The execution context without the entries that are skills, so a skill text is not repeated in the Work Item section of a prompt.
export function withoutSkills(context: WorkItemExecutionContext, skillTypes: string[]): WorkItemExecutionContext {
  return { ...context, engineeringCapital: (context.engineeringCapital ?? []).filter((entry) => !entry.type || !skillTypes.includes(entry.type)) };
}
