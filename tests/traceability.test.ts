// Participant Integration & Attestation — Plan step 3 (Decision 7): the Ch.20
// Traceability query surface, delivered as this feature's query surface rather
// than a standalone subsystem. Exercises Ch.20's functional requirements
// against a real commissioned SEU:
//   FR-20.4 backward navigation + FR-20.6/20.7 permanent provenance
//   FR-20.3 forward navigation + FR-20.5 impact analysis
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { explainDeliverable, impactOfDeliverable } from "../src/routes/seu/core/traceability.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function dispatchAndComplete(deliverableId: string, targetState: string, reference: string | null) {
  const dispatched = await transitionDeliverable({ deliverableId, targetState, actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");
  const completed = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "done", reference });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
}

async function commissionWebApp(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("backward navigation + provenance (FR-20.4/20.6/20.7): a Deliverable can be navigated to the commit and Participant that produced each state", async () => {
  const seuId = await commissionWebApp("trace-explain");
  const detail = await getSeuDetailView(seuId);
  const reqSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqCap = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(reqSpec && reqCap);
  await fulfilCapability({ seuId, capabilityId: reqCap.capabilityId, participantType: "AI", displayName: "Trace Analyst" });

  await dispatchAndComplete(reqSpec.id, "In Progress", "vcs://trace/req@prod");
  await dispatchAndComplete(reqSpec.id, "Approved", "vcs://trace/req@approved");

  const explanation = await explainDeliverable(reqSpec.id);
  assert.ok(explanation);
  assert.equal(explanation!.deliverable.lifecycleState, "Approved");
  assert.ok(explanation!.producingCapability?.label.includes("requirements-analysis"));

  // The provenance timeline: one entry per state the Deliverable reached, each
  // bound to its commit + the Participant that produced it.
  const production = explanation!.provenance.find((p) => p.toState === "In Progress");
  const acceptance = explanation!.provenance.find((p) => p.toState === "Approved");
  assert.ok(production && acceptance, "both the production and acceptance completions appear in provenance");
  assert.equal(production!.reference, "vcs://trace/req@prod");
  assert.equal(production!.certified, false, "a production completion is not a certified (attested) state change");
  assert.equal(acceptance!.reference, "vcs://trace/req@approved");
  assert.equal(acceptance!.certified, true, "the In Progress -> Approved acceptance is attested");
  assert.ok(acceptance!.actingAuthorityGrantId, "the certified state records the authority that produced it");
  assert.match(production!.participantLabel ?? "", /Trace Analyst \(AI\)/);
});

test("forward navigation + impact analysis (FR-20.3/20.5): a Deliverable surfaces every downstream Deliverable it impacts", async () => {
  const seuId = await commissionWebApp("trace-impact");
  const detail = await getSeuDetailView(seuId);
  const reqSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const archDoc = detail?.deliverables.find((d) => d.name === "Architecture Document");
  assert.ok(reqSpec && archDoc, "web-application template seeds a downstream Architecture Document");

  // Forward from the upstream Requirements Specification: the Architecture
  // Document depends on it, so it is impacted if Requirements changes.
  const impact = await impactOfDeliverable(reqSpec.id);
  assert.ok(impact);
  const impactedNames = impact!.impacted.map((i) => i.name);
  assert.ok(impactedNames.includes("Architecture Document"), `expected Architecture Document downstream, got: ${impactedNames.join(", ")}`);

  // And the inverse (backward): the Architecture Document explains that it
  // depends on the Requirements Specification reaching Approved.
  const archExplanation = await explainDeliverable(archDoc.id);
  const dep = archExplanation!.dependsOn.find((d) => d.targetId === reqSpec.id);
  assert.ok(dep, "Architecture Document should declare its dependency on Requirements Specification");
  assert.equal(dep!.type, "Deliverable");
  assert.equal(dep!.requiredState, "Approved");

  // A leaf upstream Deliverable (nothing depends on the downstream one) has no impact set.
  const archImpact = await impactOfDeliverable(archDoc.id);
  assert.equal(archImpact!.impacted.some((i) => i.deliverableId === reqSpec.id), false, "impact is directional — upstream is not 'impacted by' its own downstream");
});

test("traceability reads only platform-held records and 404s an unknown Deliverable", async () => {
  const explanation = await explainDeliverable(randomUUID());
  assert.equal(explanation, null);
  const impact = await impactOfDeliverable(randomUUID());
  assert.equal(impact, null);
});
