// CR-150: in the Work Item context, an AI skill of the Engineering Capital has a sub heading of its own and its text is markdown, not a table cell.
// A pure function: no database is used.
import { test } from "node:test";
import assert from "node:assert/strict";

import { executionContextMarkdown } from "../src/routes/seu/core/executionContextMarkdown.js";
import { AI_SKILL_BOOTSTRAP_TYPE } from "../src/dblayer/constants.js";
import type { WorkItemExecutionContext } from "../src/dblayer/seuTypes.js";

function context(engineeringCapital: WorkItemExecutionContext["engineeringCapital"]): WorkItemExecutionContext {
  return {
    engineeringObjective: "Objective", relevantDeliverable: { id: "d", name: "Deliverable", lifecycleState: "Defined" }, service: null, inputLocation: null, outputLocation: null,
    relevantDecisions: [], supportingEvidence: [], relevantKnowledge: [], governingPolicies: [], applicableAuthority: null, activeObligations: [], openAttentionItems: [], qualityGate: null,
    applicableChecklists: [], engineeringCapital, profileConfiguration: {},
  };
}

test("a skill entry has a sub heading and its text as markdown, and a link entry stays in the table", () => {
  const text = "# Bootstrap instruction\n\nRead the protocol skill.\n\n1. First\n2. Second\n\n```\n# not a heading\n```\n";
  const markdown = executionContextMarkdown(context([
    { packCode: "ai-skill-bootstrap", type: AI_SKILL_BOOTSTRAP_TYPE, url: text },
    { packCode: "other-pack", type: "Engineering Behaviour", url: "https://example.test/standard" },
  ]));
  assert.ok(markdown.includes(`#### ${AI_SKILL_BOOTSTRAP_TYPE}\n`), "the skill type is a sub heading");
  assert.ok(markdown.includes("_Pack: ai-skill-bootstrap_"));
  assert.ok(markdown.includes("##### Bootstrap instruction"), "the skill heading moves below the sub heading");
  assert.ok(markdown.includes("1. First\n2. Second"), "the skill text keeps its lines, so a list stays a list");
  assert.ok(markdown.includes("# not a heading"), "a line inside a code fence is left as it is");
  assert.ok(!markdown.includes("##### not a heading"));
  assert.ok(markdown.includes("| other-pack | Engineering Behaviour | https://example.test/standard |"), "a link entry stays a table row");
  assert.ok(!markdown.includes("| ai-skill-bootstrap |"), "a skill is not a table row");
});

test("with only skill entries there is no empty table, and with no entries the table says none", () => {
  const onlySkills = executionContextMarkdown(context([{ packCode: "p", type: AI_SKILL_BOOTSTRAP_TYPE, url: "Text" }]));
  assert.ok(!onlySkills.split("### Engineering Capital")[1]!.split("###")[0]!.includes("| Pack | Type | URL |"));
  assert.ok(executionContextMarkdown(context([])).includes("_none_"));
});
