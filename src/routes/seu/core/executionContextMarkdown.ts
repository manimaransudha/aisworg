import type { WorkItemExecutionContext } from "../../../dblayer/seuTypes.js";
import { AI_SKILL_TYPES } from "../../../dblayer/constants.js";

// A table cell holds one line, and a pipe would end the cell.
function cell(value: unknown): string {
  const text = value === undefined || value === null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function table(headers: string[], rows: unknown[][]): string {
  if (rows.length === 0) return "_none_\n";
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const row of rows) lines.push(`| ${row.map(cell).join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

// A skill text is markdown with headings of its own. They move below the sub heading of the skill, and a heading never goes deeper than level 6.
// A heading inside a fenced code block is code, so it is left as it is.
function demoteHeadings(markdown: string, by: number): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      const heading = !fenced && /^(#{1,6})\s/.exec(line);
      return heading ? `${"#".repeat(Math.min(6, heading[1]!.length + by))}${line.slice(heading[1]!.length)}` : line;
    })
    .join("\n");
}

// The Execution Context of a Work Item as markdown, one section per part of the context.
export function executionContextMarkdown(ec: WorkItemExecutionContext): string {
  const parts: string[] = [];
  parts.push(`## ${cell(ec.engineeringObjective)}\n`);
  parts.push(table(["Item", "Value"], [
    ["Deliverable", `${ec.relevantDeliverable.name} (${ec.relevantDeliverable.lifecycleState})`],
    ["Service", ec.service ? `${ec.service.name} (${ec.service.code})` : null],
    ["Input location", ec.inputLocation],
    ["Output location", ec.outputLocation],
    ["Applicable authority", ec.applicableAuthority?.code ?? null],
  ]));

  parts.push("### Governing Policies\n");
  parts.push(table(["Code", "Name"], ec.governingPolicies.map((p) => [p.code, p.name])));

  parts.push("### Obligations\n");
  parts.push(table(["Title", "Status"], ec.activeObligations.map((o) => [o.title, o.status])));

  parts.push("### Open Attention Items\n");
  parts.push(table(["Title", "Status"], ec.openAttentionItems.map((a) => [a.title, a.status])));

  parts.push("### Decisions\n");
  parts.push(table(["Title", "Question", "Status"], ec.relevantDecisions.map((d) => [d.title, d.engineeringQuestion, d.status])));

  parts.push("### Evidence\n");
  parts.push(table(["Title", "Status", "Confidence"], ec.supportingEvidence.map((e) => [e.title, e.status, e.confidenceLevel])));

  parts.push("### Knowledge\n");
  parts.push(table(["Title", "Status"], ec.relevantKnowledge.map((k) => [k.title, k.status])));

  parts.push("### Checklists\n");
  parts.push(table(["Pack", "Checklist", "Statement"], (ec.applicableChecklists ?? []).map((c) => [c.packCode, c.checklistName, c.statement])));

  // An AI skill is a text in markdown, so it gets a sub heading of its own and is not put in a table cell. Every other entry is a link and stays in the table.
  const capital = ec.engineeringCapital ?? [];
  const isSkill = (c: { type?: string }): boolean => !!c.type && AI_SKILL_TYPES.includes(c.type);
  const links = capital.filter((c) => !isSkill(c));
  const skills = capital.filter(isSkill);
  parts.push("### Engineering Capital\n");
  if (links.length > 0 || skills.length === 0) parts.push(table(["Pack", "Type", "URL"], links.map((c) => [c.packCode, c.type, c.url])));
  for (const skill of skills) {
    parts.push(`#### ${skill.type}\n`);
    parts.push(`_Pack: ${skill.packCode}_\n`);
    parts.push(`${demoteHeadings(skill.url ?? "", 4)}\n`);
  }

  const profile = Object.entries(ec.profileConfiguration ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  parts.push("### Profile Configuration\n");
  parts.push(table(["Parameter", "Value"], profile.map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])));

  return parts.join("\n");
}
