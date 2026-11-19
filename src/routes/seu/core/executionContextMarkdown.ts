import type { WorkItemExecutionContext } from "../../../dblayer/seuTypes.js";

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

  parts.push("### Quality Gate\n");
  parts.push(ec.qualityGate ? `**${cell(ec.qualityGate.outcome)}**: ${cell(ec.qualityGate.rationale)}\n` : "_none_\n");

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

  parts.push("### Engineering Capital\n");
  parts.push(table(["Pack", "Type", "URL"], (ec.engineeringCapital ?? []).map((c) => [c.packCode, c.type, c.url])));

  const profile = Object.entries(ec.profileConfiguration ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  parts.push("### Profile Configuration\n");
  parts.push(table(["Parameter", "Value"], profile.map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])));

  return parts.join("\n");
}
