// Post-MVP Phase 6 (Organisational Learning Obligation + Engineering Capital
// surfaces: Book 1 Ch.21 §21.6, Book 3 Ch.16 §12-§13, Ch.23 §7) — automated
// coverage for what the Phase 6 audit checked by hand: promoting a Published
// Knowledge Item's Acquisition Scope raises a real, visible Organisational
// Learning Obligation, and Engineering Capital is a real query (Capability/
// Enterprise/Platform-scoped Knowledge only, never SEU-scoped). Run against
// the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { createKnowledgeItem, getEngineeringCapital, promoteKnowledgeItemScope, transitionKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

async function commissionSeuWithPublishedKnowledge(statementPrefix: string) {
  const seuId = await commissionTestSeu(statementPrefix);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  const knowledgeItem = await createKnowledgeItem({
    seuId,
    deliverableId: requirementsSpec.id,
    category: "Domain Knowledge",
    title: `Phase6 test knowledge ${randomUUID()}`,
  });
  assert.equal(knowledgeItem.acquisition_scope, "SEU");

  for (const targetState of ["Proposed", "Validated", "Accepted", "Published"]) {
    const step = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? `Knowledge transition to ${targetState} failed: ${JSON.stringify(step)}` : undefined);
  }

  return { seuId, knowledgeItemId: knowledgeItem.id };
}

test("promoting a Published Knowledge Item's scope raises a visible Organisational Learning Obligation", async () => {
  const { knowledgeItemId } = await commissionSeuWithPublishedKnowledge("phase6-obligation");

  const result = await promoteKnowledgeItemScope({ knowledgeItemId, targetScope: "Capability", actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);
  if (result.ok) {
    assert.equal(result.knowledgeItem.acquisition_scope, "Capability");
    assert.equal(result.appliedTransition.fromState, "SEU");
    assert.equal(result.appliedTransition.toState, "Capability");
    assert.equal(result.obligation.category, "Organisational Learning");
    assert.match(result.obligation.title, /Capability-scoped Engineering Capital/);
    assert.equal(result.obligation.related_object_type, "Deliverable");
    assert.equal(result.obligation.related_object_id, result.knowledgeItem.deliverable_id, "the Obligation must attach to the Knowledge Item's own originating Deliverable");
  }
});

test("Acquisition Scope promotion requires the Knowledge Item to be Published first", async () => {
  const seuId = await commissionTestSeu("phase6-not-published");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  const knowledgeItem = await createKnowledgeItem({ seuId, deliverableId: requirementsSpec.id, category: "Technical Knowledge", title: "Phase6 unpublished knowledge" });
  assert.equal(knowledgeItem.status, "Observed");

  const result = await promoteKnowledgeItemScope({ knowledgeItemId: knowledgeItem.id, targetScope: "Capability", actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not_published");
});

test("Acquisition Scope promotion is one tier at a time and never demotes", async () => {
  const { knowledgeItemId } = await commissionSeuWithPublishedKnowledge("phase6-monotonic");

  // Skipping a tier (SEU straight to Enterprise) has no Transition Definition.
  const skipped = await promoteKnowledgeItemScope({ knowledgeItemId, targetScope: "Enterprise", actorRole: "super", actorId: "1001" });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.reason, "no_transition_definition");

  const toCapability = await promoteKnowledgeItemScope({ knowledgeItemId, targetScope: "Capability", actorRole: "super", actorId: "1001" });
  assert.equal(toCapability.ok, true);

  // Demoting back to SEU has no Transition Definition either.
  const demoted = await promoteKnowledgeItemScope({ knowledgeItemId, targetScope: "SEU", actorRole: "super", actorId: "1001" });
  assert.equal(demoted.ok, false);
  if (!demoted.ok) assert.equal(demoted.reason, "no_transition_definition");
});

// CR-006: the role-ladder for scope promotion (general→Capability, power→
// Enterprise, super→Platform) is retired — promotion authority is now the
// noun_verb badge (knowledgescope_promote_to_capability/enterprise/platform),
// and the noun_verb mechanism is proven once in badge-model.test.ts. This
// role-tiering test is therefore removed (its premise no longer exists).

test("Engineering Capital lists Capability/Enterprise/Platform-scoped Knowledge and excludes SEU-scoped Knowledge", async () => {
  const { seuId, knowledgeItemId } = await commissionSeuWithPublishedKnowledge("phase6-capital-query");

  const beforePromotion = await getEngineeringCapital();
  assert.ok(!beforePromotion.some((k) => k.id === knowledgeItemId), "SEU-scoped Knowledge must not appear in Engineering Capital");

  const result = await promoteKnowledgeItemScope({ knowledgeItemId, targetScope: "Capability", actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true);

  const afterPromotion = await getEngineeringCapital();
  const entry = afterPromotion.find((k) => k.id === knowledgeItemId);
  assert.ok(entry, "Capability-scoped Knowledge must appear in Engineering Capital");
  assert.equal(entry?.acquisition_scope, "Capability");
  assert.equal(entry?.capability_code, "requirements-analysis", "attributed to the Capability that produced the originating Deliverable");
  assert.equal(entry?.seu_id, seuId);
});
