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
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { tenantContractsDB } from "../src/dblayer/tenantContractsDB.js";
import { executionTargetsDB } from "../src/dblayer/executionTargetsDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { registerAssignmentDelivery } from "../src/adapters/assignmentDelivery.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

const captured: Array<{ url: string; body: any; auth: string | undefined }> = [];
let captureServer: http.Server;
let captureBase: string;

before(async () => {
  registerAssignmentDelivery();
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
  await pool.end();
});

async function commissionAndDispatch(prefix: string, tenantId: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
    tenantId,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  // The SEU records its owning tenant.
  const { data: seuRow } = await seusDB.findById(seuId);
  assert.equal(seuRow?.tenant_id, tenantId, "the commissioned SEU belongs to its tenant");

  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(deliverable && capability);
  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantType: "AI", displayName: `${prefix} Agent` });

  const dispatched = await transitionDeliverable({ deliverableId: deliverable.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");
  return dispatched.workItemId;
}

test("two tenants sharing no edge choice run on the same core; each Work Item routes to its own tenant's edge", async () => {
  // The one pack-global Capability every SEU here produces against.
  const { data: caps } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  const reqAnalysisCapId = (caps ?? [])[0]?.id;
  assert.ok(reqAnalysisCapId);

  // Tenant A: GitHub, HMAC callback auth, query-only attestation, orchestrator /a.
  const { data: tenantA } = await tenantsDB.create({ code: `acme-${randomUUID().slice(0, 8)}`, name: "Acme Corp" });
  assert.ok(tenantA);
  await tenantContractsDB.upsert({
    tenantId: tenantA!.id,
    vcsBinding: { provider: "github", repoTopology: "one-repo-per-seu" },
    callbackAuth: { scheme: "hmac" },
    attestationConfig: { mode: "query-only" },
  });
  await executionTargetsDB.upsert({ tenantId: tenantA!.id, capabilityId: reqAnalysisCapId, mode: "external-orchestrator", adapterEndpoint: `${captureBase}/a`, adapterAuthRef: "token-a" });

  // Tenant B: GitLab, JWT callback auth, signed attestation, orchestrator /b.
  const { data: tenantB } = await tenantsDB.create({ code: `globex-${randomUUID().slice(0, 8)}`, name: "Globex" });
  assert.ok(tenantB);
  await tenantContractsDB.upsert({
    tenantId: tenantB!.id,
    vcsBinding: { provider: "gitlab", repoTopology: "monorepo" },
    callbackAuth: { scheme: "jwt" },
    attestationConfig: { mode: "signed", format: "sigstore" },
  });
  await executionTargetsDB.upsert({ tenantId: tenantB!.id, capabilityId: reqAnalysisCapId, mode: "external-orchestrator", adapterEndpoint: `${captureBase}/b`, adapterAuthRef: "token-b" });

  // Same code path for both — only the tenant differs.
  const widA = await commissionAndDispatch("tenant-a", tenantA!.id);
  const widB = await commissionAndDispatch("tenant-b", tenantB!.id);

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
  const result = await commissionFromForm({
    statement: `tenant-default-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const { data: seuRow } = await seusDB.findById(result.seu.id);
  assert.equal(seuRow?.tenant_id, def!.id, "no tenant named -> default tenant");
});
