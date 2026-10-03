// Participant Integration & Attestation — Plan step 6 (Resolution 8, the
// step-6 core-invariance check). Deployment-time contract config, per tenant.
// The decisive demonstration: two tenants that share NO edge choice — different
// VCS providers, different orchestrator endpoints, different auth, different
// attestation config — run on the exact same core. The same pack-global
// Capability resolves to a different execution target for each tenant, and each
// tenant's assignment carries its own VCS binding. Only the edge configuration
// differs. Run against the real dev database, with a local capture server
// standing in for the tenants' orchestrators.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import pool from "../src/utils/db.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapabilityAsRoot as fulfilCapability } from "./testFixtures.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { createObjective, submitObjective, transitionObjective } from "../src/routes/seu/core/objectives.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { tenantContractsDB } from "../src/dblayer/tenantContractsDB.js";
import { executionTargetsDB } from "../src/dblayer/executionTargetsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync, driveCommissioningToActive, waitForDispatchedWorkItem, ensureEligibleParticipant } from "./testFixtures.js";
import { ROOT_ACTOR_ID, TESTER_ALL_ID } from "./testFixtures.js";

const captured: Array<{ url: string; body: any; auth: string | undefined }> = [];
let captureServer: http.Server;
let captureBase: string;

// Ch.30 Event Bus redesign — dispatch is fire-and-forget, so anything
// waiting on a handler's side effect (here, delivery to the capture server)
// must poll rather than assume it's done synchronously.
async function waitUntil(condition: () => boolean, timeoutMs = 2000, intervalMs = 20): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) return; // let the caller's own assertion report the failure
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

before(async () => {
  // Ch.30 Event Bus redesign — the assignmentDelivery subscriber is now
  // DB-backed (event_subscriptions), loaded into memory here instead of the
  // old imperative registerAssignmentDelivery() call.
  await eventBus.loadSubscriptions();
  captureServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        captured.push({ url: req.url ?? "", body: JSON.parse(raw || "{}"), auth: req.headers["authorization"] as string | undefined });
      } catch { /* ignore */ }
      res.writeHead(200);
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => captureServer.listen(0, () => resolve()));
  captureBase = `http://127.0.0.1:${(captureServer.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => captureServer.close(() => resolve()));
});

async function commissionAndDispatch(prefix: string, tenantId: string, expectedCapabilityId: string) {
  // CR-087 — pinned to the fixture Template directly (commissionSeu, not
  // commissionFromForm's own auto-matching): test-enterprise-web-application
  // gained a 4th required capability (requirements-validation, CR-087 Step
  // 2d), which findCandidateTemplates' "smallest satisfying candidate wins"
  // selection is sensitive to — a different (real) Template being picked has
  // a much longer prerequisite chain ahead of "Requirements Analysis Model"
  // than this test's own flow (fulfil requirements-analysis, transition
  // Requirements Analysis Model directly) drives through.
  const { template: fixtureTemplate } = await ensureWebAppTemplateFixture();
  const profilePublish = await publishProfile({
    seed: {
      code: `tenant-contract-profile-${randomUUID()}`,
      name: "Tenant Contract Profile",
      baseTemplateCode: fixtureTemplate.code,
      environment: "development",
      profileVersion: `1.0.${Date.now()}${process.pid}`,
      developmentMethodology: "scrum",
      primaryProgrammingLanguage: "typescript",
      sourceControlProvider: "github",
      redispatchMaxAttempts: 5,
      redispatchAttentionThreshold: 2,
    },
    actorRole: "super",
    actorId: TESTER_ALL_ID,
  });
  assert.equal(profilePublish.ok, true, !profilePublish.ok ? JSON.stringify(profilePublish.errors) : "assertion failed");
  if (!profilePublish.ok) throw new Error("unreachable");
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);
  const { objective: tcRoot } = await createObjective({ statement: `tenant-contract-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, status: "Proposed" });
  const { objective } = await createObjective({ statement: `${prefix}-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], tier: "Engineering", parentObjectiveId: tcRoot.id, requestedBy: TESTER_ALL_ID, status: "Proposed" });
  await submitObjective(objective.id, TESTER_ALL_ID);
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: TESTER_ALL_ID });
  assert.equal(activated.ok, true);

  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [fixtureTemplate.id], profileIds: [profile!.id], actorRole: "super", actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID, tenantId });
  assert.equal(requested.ok, true, !requested.ok ? `commissioning failed: ${requested.reason}` : "assertion failed");
  if (!requested.ok) throw new Error("unreachable");

  // beforeCommenceWork (driveCommissioningToActive) fulfils the producing
  // Capability before executionEngineKickoff's own automatic Activated ->
  // Operational attempt reaches Dispatch, so it dispatches for real instead
  // of racing an as-yet-unfulfilled Capability into a terminal
  // empty_eligible_pool rejection (dispatchEngine.ts Case 1b).
  const result = await driveCommissioningToActive({
    seuId: requested.seu.id,
    actorRole: "super",
    actorId: TESTER_ALL_ID,
    beforeCommenceWork: async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      // Diagnostic: this SEU's actual producing Capability must be the same
      // row the test upserted the execution_targets row against, or
      // resolveExecutionTarget (executionTargetResolver.ts) silently falls
      // back to human-on-ui and the capture server never sees a delivery.
      assert.equal(capability!.capabilityId, expectedCapabilityId, `SEU's requirements-analysis Capability (${capability!.capabilityId}) does not match the Capability the execution target was upserted against (${expectedCapabilityId})`);
      await fulfilCapability({ seuId, capabilityId: capability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });
    },
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  // The SEU records its owning tenant.
  const { data: seuRow } = await seusDB.findById(seuId);
  assert.equal(seuRow?.tenant_id, tenantId, "the commissioned SEU belongs to its tenant");

  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(deliverable);

  // deliverableKickoffHandler (SEUOperational / DeliverableTransitioned /
  // ObligationTransitioned) re-scans every Deliverable in the SEU and
  // attempts each one's own next governed transition unprompted — the same
  // governed check this manual call also runs, and the "manual" trigger tag
  // only controls button visibility, not who/what may attempt the
  // transition. So this hop can legitimately already have a Command in
  // flight from that automatic rescan (already_in_flight) before this call
  // lands — a real Command either way, just differing in who got there first.
  const dispatched = await transitionDeliverable({ deliverableId: deliverable.id, targetState: "In Progress", actorRole: "super", actorId: ROOT_ACTOR_ID });
  if (!dispatched.ok) assert.equal(dispatched.reason, "already_in_flight", JSON.stringify(dispatched));
  const { workItem } = await waitForDispatchedWorkItem(deliverable.id, "Defined", "In Progress");
  return workItem.id;
}

test("two tenants sharing no edge choice run on the same core; each Work Item routes to its own tenant's edge", async () => {
  // The one pack-global Capability every SEU here produces against — read
  // off the fixture Template's own required Capabilities (template_capabilities,
  // the same join every real commissioning resolves producing_capability_id
  // from), not re-derived by code. deriveDedupedCapabilitiesFromPackCodes(["requirements-analysis"])
  // treats that argument as a Pack code, not a Capability code — and
  // integration-jira.pack.json genuinely also has a Pack sharing that code,
  // so it was resolving to THAT Pack's own distinct "requirements-analysis"
  // Capability row instead of this fixture Template's own, causing
  // resolveExecutionTarget to silently fall back to human-on-ui delivery.
  const { template: fixtureTemplate } = await ensureWebAppTemplateFixture();
  const { data: templateCapabilities } = await templatesDB.getRequiredCapabilities(fixtureTemplate.id);
  const reqAnalysisCapId = templateCapabilities?.find((c) => c.code === "requirements-analysis")?.id;
  assert.ok(reqAnalysisCapId);

  // Tenant A: GitHub, HMAC callback auth, query-only attestation, orchestrator /a.
  const { data: tenantA } = await tenantsDB.create({ code: `acme-${randomUUID().slice(0, 8)}`, name: "Acme Corp", authorId: ROOT_ACTOR_ID, authorBadge: "root", is_system: false });
  assert.ok(tenantA);
  await tenantContractsDB.upsert({
    tenantId: tenantA!.id,
    vcsBinding: { provider: "github", repoTopology: "one-repo-per-seu" },
    callbackAuth: { scheme: "hmac" },
    attestationConfig: { mode: "query-only" },
  });
  await executionTargetsDB.upsert({ tenantId: tenantA!.id, capabilityId: reqAnalysisCapId, mode: "external-orchestrator", authorId: ROOT_ACTOR_ID, authorBadge: "root", adapterEndpoint: `${captureBase}/a`, adapterAuthRef: "token-a" });

  // Tenant B: GitLab, JWT callback auth, signed attestation, orchestrator /b.
  const { data: tenantB } = await tenantsDB.create({ code: `globex-${randomUUID().slice(0, 8)}`, name: "Globex", authorId: ROOT_ACTOR_ID, authorBadge: "root", is_system: false });
  assert.ok(tenantB);
  await tenantContractsDB.upsert({
    tenantId: tenantB!.id,
    vcsBinding: { provider: "gitlab", repoTopology: "monorepo" },
    callbackAuth: { scheme: "jwt" },
    attestationConfig: { mode: "signed", format: "sigstore" },
  });
  await executionTargetsDB.upsert({ tenantId: tenantB!.id, capabilityId: reqAnalysisCapId, mode: "external-orchestrator", authorId: ROOT_ACTOR_ID, authorBadge: "root", adapterEndpoint: `${captureBase}/b`, adapterAuthRef: "token-b" });

  // Same code path for both — only the tenant differs.
  const widA = await commissionAndDispatch("tenant-a", tenantA!.id, reqAnalysisCapId!);
  const widB = await commissionAndDispatch("tenant-b", tenantB!.id, reqAnalysisCapId!);

  // Ch.30 Event Bus redesign — dispatch is now fire-and-forget (publish()
  // no longer awaits the assignmentDelivery handler), so delivery to the
  // capture server may still be in flight when commissionAndDispatch
  // returns. Poll briefly rather than asserting immediately.
  await waitUntil(() => captured.some((c) => c.body.workItemId === widA) && captured.some((c) => c.body.workItemId === widB));

  const deliveredA = captured.find((c) => c.body.workItemId === widA);
  const deliveredB = captured.find((c) => c.body.workItemId === widB);
  assert.ok(deliveredA, "tenant A's Work Item should be delivered");
  assert.ok(deliveredB, "tenant B's Work Item should be delivered");

  // Each routed to its OWN tenant's orchestrator endpoint, with its OWN auth...
  assert.equal(deliveredA!.url, "/a");
  assert.equal(deliveredA!.auth, "Bearer token-a");
  assert.equal(deliveredB!.url, "/b");
  assert.equal(deliveredB!.auth, "Bearer token-b");

  // ...and carried its OWN tenant identity + VCS binding, the same pack-global
  // Capability resolving differently per tenant.
  assert.equal(deliveredA!.body.tenant.id, tenantA!.id);
  assert.equal(deliveredA!.body.vcsBinding.provider, "github");
  assert.equal(deliveredB!.body.tenant.id, tenantB!.id);
  assert.equal(deliveredB!.body.vcsBinding.provider, "gitlab");
});

test("a SEU commissioned without a named tenant belongs to the seeded default tenant", async () => {
  await ensureWebAppTemplateFixture();
  const { data: def } = await tenantsDB.findDefault();
  assert.ok(def, "a default tenant is seeded");
  const result = await commissionFromFormSync({
    statement: `tenant-default-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const { data: seuRow } = await seusDB.findById(result.seu.id);
  assert.equal(seuRow?.tenant_id, def!.id, "no tenant named -> default tenant");
});
