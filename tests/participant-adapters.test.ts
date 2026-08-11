// Participant Integration & Attestation — Plan step 5 (Decision 9, §0.1 — the
// decisive core-invariance step). One contract, two initial adapters
// (human-on-UI, external-orchestrator), resolved by mode. The core never
// imports a concrete adapter: it publishes WorkItemDispatched, and the edge
// (assignmentDelivery) resolves the Capability's execution target and delivers
// via the adapter. Adding a third adapter is a registry entry, no core edit.
// Run against the real dev database, with a local capture server standing in
// for a tenant orchestrator.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { executionTargetsDB } from "../src/dblayer/executionTargetsDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { registerAdapter, resolveAdapter } from "../src/adapters/adapterRegistry.js";
import { humanOnUiAdapter } from "../src/adapters/humanOnUiAdapter.js";
import { externalOrchestratorAdapter } from "../src/adapters/externalOrchestratorAdapter.js";
import { registerAssignmentDelivery } from "../src/adapters/assignmentDelivery.js";
import type { ParticipantAdapter } from "../src/adapters/participantAdapter.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

// A local server standing in for a tenant's external orchestrator, capturing
// every assignment the platform delivers.
const captured: Array<{ workItemId: string; body: any; auth: string | undefined }> = [];
let captureServer: http.Server;
let captureUrl: string;
let defaultTenantId: string;

before(async () => {
  registerAssignmentDelivery();
  const { data: def } = await tenantsDB.findDefault();
  assert.ok(def, "a default tenant must be seeded");
  defaultTenantId = def!.id;
  captureServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        captured.push({ workItemId: body.workItemId, body, auth: req.headers["authorization"] as string | undefined });
      } catch { /* ignore malformed */ }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => captureServer.listen(0, () => resolve()));
  const port = (captureServer.address() as AddressInfo).port;
  captureUrl = `http://127.0.0.1:${port}/orchestrator`;
});

after(async () => {
  // Capabilities are pack-global, so the per-Capability execution target this
  // file set is global. Clear it so later e2e files (which boot the app and
  // register the delivery subscriber) don't try to deliver to this now-closed
  // capture server.
  const { data: caps } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  for (const cap of caps ?? []) await executionTargetsDB.deleteByTenantAndCapability(defaultTenantId, cap.id);
  await new Promise<void>((resolve) => captureServer.close(() => resolve()));
  await pool.end();
});

async function commissionAndFulfil(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;
  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(deliverable && capability);
  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantType: "AI", displayName: `${prefix} Agent` });
  return { seuId, deliverableId: deliverable.id, capabilityId: capability.capabilityId };
}

test("both adapters implement the one contract; the registry resolves by mode; a third adapter needs no core edit", () => {
  assert.equal(typeof humanOnUiAdapter.deliverAssignment, "function");
  assert.equal(typeof externalOrchestratorAdapter.deliverAssignment, "function");
  assert.equal(resolveAdapter("human-on-ui"), humanOnUiAdapter);
  assert.equal(resolveAdapter("external-orchestrator"), externalOrchestratorAdapter);
  // Unknown mode falls back to the human surface — never undeliverable.
  assert.equal(resolveAdapter("no-such-mode"), humanOnUiAdapter);

  // Adding a hypothetical third adapter is a single registry call, no core edit.
  const seen: string[] = [];
  const spy: ParticipantAdapter = {
    mode: "test-spy",
    async deliverAssignment(a) { seen.push(a.workItemId); return { delivered: true }; },
  };
  registerAdapter("test-spy", spy);
  assert.equal(resolveAdapter("test-spy"), spy);
});

test("external-orchestrator: dispatching delivers the assignment to the tenant endpoint over the adapter", async () => {
  const { seuId, deliverableId, capabilityId } = await commissionAndFulfil("adapter-external");
  await executionTargetsDB.upsert({ tenantId: defaultTenantId, capabilityId, mode: "external-orchestrator", adapterEndpoint: captureUrl, adapterAuthRef: "secret-token" });

  const before = captured.length;
  const dispatched = await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");

  const mine = captured.slice(before).find((c) => c.workItemId === dispatched.workItemId);
  assert.ok(mine, "the orchestrator endpoint should have received the assignment");
  assert.equal(mine!.body.transition.fromState, "Defined");
  assert.equal(mine!.body.transition.toState, "In Progress");
  assert.equal(mine!.body.deliverable.id, deliverableId);
  assert.ok(Array.isArray(mine!.body.inputReferences), "the assignment carries the §2.2 input references array");
  assert.equal(mine!.auth, "Bearer secret-token", "the opaque outbound credential is carried by the adapter, not the core");
});

test("human-on-UI (default, no execution target): dispatching makes no external call", async () => {
  const { deliverableId, capabilityId } = await commissionAndFulfil("adapter-human");
  // Capabilities are pack-global, so the per-Capability execution target is
  // shared across SEUs (tenant scoping is step 6). Clear any target another
  // test set for this Capability so this exercises the true default.
  await executionTargetsDB.deleteByTenantAndCapability(defaultTenantId, capabilityId);

  const before = captured.length;
  const dispatched = await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) throw new Error("unreachable");

  const mine = captured.slice(before).find((c) => c.workItemId === dispatched.workItemId);
  assert.equal(mine, undefined, "the human-on-UI path makes no wire call — the item is fulfilled through the platform UI");
});

test("the platform-side flow is identical either way: the Deliverable is dispatched-and-outstanding regardless of adapter", async () => {
  // Same Capability, both modes, same observable platform result (outstanding).
  const external = await commissionAndFulfil("adapter-invariance-ext");
  await executionTargetsDB.upsert({ tenantId: defaultTenantId, capabilityId: external.capabilityId, mode: "external-orchestrator", adapterEndpoint: captureUrl });
  const d1 = await transitionDeliverable({ deliverableId: external.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  const human = await commissionAndFulfil("adapter-invariance-hum");
  const d2 = await transitionDeliverable({ deliverableId: human.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  assert.equal(d1.ok, true);
  assert.equal(d2.ok, true);
  if (!d1.ok || !d2.ok) throw new Error("unreachable");
  // Both dispatched, both pending the same transition — the platform behaves
  // identically; only the edge differed.
  assert.deepEqual(d1.pendingTransition, { fromState: "Defined", toState: "In Progress" });
  assert.deepEqual(d2.pendingTransition, { fromState: "Defined", toState: "In Progress" });
});
