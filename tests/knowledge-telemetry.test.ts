// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 4 — Knowledge Telemetry, narrowed to growth
// and Evidence generation only. Proves both are real counts derived from
// real Knowledge Items/Evidence, correctly broken down by Acquisition Scope,
// and correctly scoped per SEU.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { createKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { createEvidence } from "../src/routes/seu/core/evidence.js";
import { getKnowledgeMetrics } from "../src/routes/seu/core/telemetry.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeuWithDeliverable(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(requirementsSpec);
  return { seuId, deliverableId: requirementsSpec.id };
}

test("Knowledge Telemetry: growth and Evidence generation are real counts, broken down by Acquisition Scope, scoped correctly per SEU", async () => {
  const a = await commissionTestSeuWithDeliverable("knowledge-telemetry-a");
  const b = await commissionTestSeuWithDeliverable("knowledge-telemetry-b");

  const beforeA = await getKnowledgeMetrics(a.seuId);

  await createKnowledgeItem({ seuId: a.seuId, deliverableId: a.deliverableId, category: "Technical", title: "Test Knowledge Item (SEU scope)", acquisitionScope: "SEU" });
  await createKnowledgeItem({ seuId: a.seuId, deliverableId: a.deliverableId, category: "Technical", title: "Test Knowledge Item (Platform scope)", acquisitionScope: "Platform" });
  await createEvidence({ seuId: a.seuId, relatedObjectType: "Deliverable", relatedObjectId: a.deliverableId, category: "Test", title: "Test Evidence" });

  await createKnowledgeItem({ seuId: b.seuId, deliverableId: b.deliverableId, category: "Technical", title: "SEU B's own Knowledge Item", acquisitionScope: "SEU" });

  const afterA = await getKnowledgeMetrics(a.seuId);
  assert.equal(afterA.totalKnowledgeItems, beforeA.totalKnowledgeItems + 2);
  assert.equal(afterA.byAcquisitionScope.SEU, beforeA.byAcquisitionScope.SEU + 1);
  assert.equal(afterA.byAcquisitionScope.Platform, beforeA.byAcquisitionScope.Platform + 1);
  assert.equal(afterA.evidenceGenerated, beforeA.evidenceGenerated + 1);

  const platformWide = await getKnowledgeMetrics();
  assert.ok(platformWide.totalKnowledgeItems >= afterA.totalKnowledgeItems + 1, "platform-wide total must include SEU B's item too");
});
