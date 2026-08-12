// Dry-run scenarios. Two tenants (Atlas, Babylon) taken through the full
// Participant Integration flow, plus exhaustive non-happy-path coverage. Drives
// the platform only through platform.mjs (the API contract) and simulates the
// tenant side only through edge.mjs (the swap point).
import assert from "node:assert/strict";
import * as P from "./lib/platform.mjs";
import { scenario, check, must, note } from "./lib/harness.mjs";
import { SimVCS, SimParticipant, SimOrchestrator } from "./lib/edge.mjs";

const RUN = Date.now().toString(36); // unique per run, so Objectives never collide
const CAPS = ["requirements-analysis", "architecture", "development"];
const cap = (caps, code) => caps.find((c) => c.code === code);
const del = (dels, name) => dels.find((d) => d.name === name);

// Dispatch a transition, let a simulated participant "execute", and report the
// result back — the whole async round trip. Returns every intermediate so a
// scenario can assert on the dispatch (202), the result (200/4xx), or the state.
async function drive(deliverableId, deliverableName, targetState, worker, opts = {}) {
  const dispatch = await P.dispatchTransition(deliverableId, targetState, opts.dispatchExtra || {});
  if (dispatch.status !== 202) return { dispatch };
  const workItemId = dispatch.body.workItemId;
  const produced = worker.execute({ workItemId, targetState, deliverableName });
  const outcome = opts.outcome ?? produced.outcome;
  const reference = opts.reference !== undefined ? opts.reference : produced.reference;
  const result = await P.reportResult(workItemId, { outcome, reference });
  return { dispatch, workItemId, result, reference, outcome };
}

// Commission a fresh SEU under a tenant and fulfil all three capabilities.
// `plan` maps capability code -> participant.type (default AI). Returns handles.
async function standUp(tenantId, statement, plan = {}) {
  const objective = await P.createObjective(`${statement} [${RUN}]`, CAPS);
  const template = await P.pickTemplate(CAPS);
  const profile = await P.createProfile(template.id);
  const com = await P.commission({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, tenantId });
  if (com.lifecycleState !== "Operational") throw new Error(`commissioning did not reach Operational: ${JSON.stringify(com)}`);
  const status = await P.getSeu(com.seuId);
  const participants = {};
  for (const code of CAPS) {
    const c = cap(status.capabilities, code);
    const type = plan[code] || "AI";
    const f = await P.fulfil(com.seuId, c.capabilityId, { type, displayName: `${code} (${type})` });
    participants[code] = { seuCapabilityId: f.seuCapability?.id, participantId: f.participant?.id, type };
  }
  return { seuId: com.seuId, seu: status.seu, capabilities: status.capabilities, deliverables: status.deliverables, participants };
}

// Commission a fresh SEU under a tenant but do NOT fulfil any Capability — for
// the deferred-dispatch case (dispatch before a Participant exists).
async function commissionOnly(tenantId, statement) {
  const objective = await P.createObjective(`${statement} [${RUN}]`, CAPS);
  const template = await P.pickTemplate(CAPS);
  const profile = await P.createProfile(template.id);
  const com = await P.commission({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, tenantId });
  if (com.lifecycleState !== "Operational") throw new Error(`commissioning did not reach Operational: ${JSON.stringify(com)}`);
  return { seuId: com.seuId, ...(await P.getSeu(com.seuId)) };
}

// Take a Deliverable all the way to Baselined (production, approval, evidence,
// baseline). Returns the deliverable id. Used where a fully-certified Deliverable
// is the setup, not the thing under test.
async function toBaselined(seuId, deliverableId, name, worker) {
  await drive(deliverableId, name, "In Progress", worker);
  await drive(deliverableId, name, "Approved", worker);
  const ev = await P.createEvidence({ seuId, deliverableId, category: "Validation Evidence", title: `${name} sign-off`, source: "dry-run" });
  await P.transitionEvidence(ev.id, "Validated");
  await P.transitionEvidence(ev.id, "Accepted");
  await drive(deliverableId, name, "Baselined", worker);
}

// ============================================================================
// Scenario 1 — Atlas: ebook library management system, end to end.
// ============================================================================
async function atlas() {
  await scenario("Atlas — commission & configure the tenant (ebook library management system)", async () => {
    const tenant = await must("tenant Atlas exists", () => P.ensureTenant("atlas", "Atlas"));
    Atlas.tenantId = tenant.id;
    await check("declare Atlas's Participant Integration Contract (git VCS, HMAC callback auth)", async () => {
      const c = await P.setContract(tenant.id, {
        vcsBinding: { provider: "git", host: "vcs.atlas.example" },
        callbackAuth: { scheme: "hmac", keyRef: "atlas-callback-key" },
        attestationConfig: { format: "query-only" },
      });
      assert.ok(c);
    });

    const seu = await must("commission Atlas SEU -> Operational, tenant-scoped, capabilities+deliverables seeded", async () => {
      const s = await standUp(tenant.id, "Create an ebook library management system", {
        "requirements-analysis": "Human",
        architecture: "AI",
        development: "AI",
      });
      assert.ok(s.deliverables.length >= 1, "expected seeded deliverables");
      return s;
    });
    Atlas.seu = seu;

    await check("SEU is owned by the Atlas tenant", () => {
      if (seu.seu.tenant_id == null) return note("getSeuStatus did not expose tenant_id — asserting skipped (see findings)");
      assert.equal(seu.seu.tenant_id, tenant.id);
    });

    // Same capability, reached the Atlas way: requirements-analysis is human-on-ui.
    await check("register per-Capability execution targets (human-on-ui + external-orchestrator)", async () => {
      const reqCap = cap(seu.capabilities, "requirements-analysis");
      const archCap = cap(seu.capabilities, "architecture");
      await P.setExecutionTarget({ tenantId: tenant.id, capabilityId: reqCap.capabilityId, mode: "human-on-ui" });
      await P.setExecutionTarget({ tenantId: tenant.id, capabilityId: archCap.capabilityId, mode: "external-orchestrator", adapterEndpoint: "https://agents.atlas.example/hook", adapterAuthRef: "atlas-agent-token" });
      const got = await P.getExecutionTarget(reqCap.capabilityId, tenant.id);
      assert.equal(got.effectiveMode, "human-on-ui");
    });
  });

  await scenario("Atlas — Requirements Specification: async production, approval, attestation, baseline", async () => {
    const seu = Atlas.seu;
    if (!seu) return note("Atlas SEU not available (setup aborted)");
    const worker = Atlas.worker;
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    const archDoc = del(seu.deliverables, "Architecture Document");

    await must("Requirements Specification is Defined", () => assert.equal(reqSpec.lifecycleState, "Defined"));

    await check("dependency gating: Architecture Document cannot start before Requirements is Approved", async () => {
      const blocked = await P.dispatchTransition(archDoc.id, "In Progress");
      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.reason, "dependency_not_satisfied");
    });

    await check("Defined -> In Progress dispatches (202) and lands via the result-in callback (200)", async () => {
      const r = await drive(reqSpec.id, reqSpec.name, "In Progress", worker);
      assert.equal(r.dispatch.status, 202, JSON.stringify(r.dispatch.body));
      assert.ok(r.dispatch.body.workItemId, "expected a Work Item id");
      assert.equal(r.result.status, 200, JSON.stringify(r.result.body));
      assert.equal(r.result.body.deliverable.lifecycle_state, "In Progress");
    });

    await check("production recorded a raw reference but minted NO attestation (not an acceptance)", async () => {
      const tr = await P.traceability(reqSpec.id);
      const prod = tr.explanation.provenance.find((p) => p.fromState === "Defined" && p.toState === "In Progress");
      assert.ok(prod, "expected a Defined->In Progress provenance entry");
      assert.ok(prod.reference, "expected a raw VCS reference recorded at production");
      assert.equal(prod.certified, false, "production is not an acceptance transition — no attestation");
    });

    await check("In Progress -> Approved is an acceptance: it mints an attestation recording the certifying authority", async () => {
      const r = await drive(reqSpec.id, reqSpec.name, "Approved", worker);
      assert.equal(r.result.status, 200, JSON.stringify(r.result.body));
      assert.equal(r.result.body.deliverable.lifecycle_state, "Approved");
      const tr = await P.traceability(reqSpec.id);
      const acc = tr.explanation.provenance.find((p) => p.fromState === "In Progress" && p.toState === "Approved");
      assert.ok(acc, "expected an In Progress->Approved provenance entry");
      assert.equal(acc.certified, true, "an acceptance transition mints an attestation");
      assert.ok(acc.actingAuthorityGrantId, "the attestation records which authority certified the state");
    });

    await check("Resolution 7: the approval attestation does NOT satisfy Baselining — it needs its own fresh Evidence", async () => {
      const blocked = await P.dispatchTransition(reqSpec.id, "Baselined");
      assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
      assert.equal(blocked.body.reason, "quality_gate_blocked");
    });

    await check("with Accepted Evidence, Approved -> Baselined proceeds and mints a second attestation", async () => {
      const ev = await P.createEvidence({ seuId: seu.seuId, deliverableId: reqSpec.id, category: "Validation Evidence", title: "Requirements sign-off", source: "dry-run" });
      await P.transitionEvidence(ev.id, "Validated");
      await P.transitionEvidence(ev.id, "Accepted");
      const r = await drive(reqSpec.id, reqSpec.name, "Baselined", worker);
      assert.equal(r.result.status, 200, JSON.stringify(r.result?.body));
      assert.equal(r.result.body.deliverable.lifecycle_state, "Baselined");
      const tr = await P.traceability(reqSpec.id);
      const base = tr.explanation.provenance.find((p) => p.fromState === "Approved" && p.toState === "Baselined");
      assert.ok(base && base.certified, "Baselining is an acceptance transition and mints an attestation");
    });

    await check("forward traceability: Requirements Specification's change impacts the Architecture Document", async () => {
      const tr = await P.traceability(reqSpec.id);
      assert.ok(tr.impact.impacted.some((n) => n.name === "Architecture Document"), "expected Architecture Document downstream");
    });

    await check("downstream unblocks: Architecture Document can now start", async () => {
      const r = await drive(archDoc.id, archDoc.name, "In Progress", worker);
      assert.equal(r.result?.status, 200, JSON.stringify(r.result?.body));
    });

    await check("event log records the governed journey", async () => {
      const events = (await P.getEvents(seu.seuId)).map((e) => e.event_type);
      for (const t of ["SEUOperational", "CapabilityFulfilled", "DeliverableTransitioned"]) assert.ok(events.includes(t), `expected ${t}`);
    });
  });
}

// ============================================================================
// Scenario 2 — Babylon: student enrollment system. Human/AI roles swapped.
// ============================================================================
async function babylon() {
  await scenario("Babylon — commission & run the flow (student enrollment mapping students to courses for credits)", async () => {
    const tenant = await must("tenant Babylon exists", () => P.ensureTenant("babylon", "Babylon"));
    Babylon.tenantId = tenant.id;
    await check("declare Babylon's contract with a DIFFERENT VCS provider and auth (svn, bearer)", async () => {
      const c = await P.setContract(tenant.id, {
        vcsBinding: { provider: "svn", host: "svn.babylon.example" },
        callbackAuth: { scheme: "bearer", keyRef: "babylon-token" },
        attestationConfig: { format: "signed", algo: "ed25519" },
      });
      assert.ok(c);
    });

    const seu = await must("commission Babylon SEU -> Operational (roles swapped: AI analyst, human architect)", () =>
      standUp(tenant.id, "Build a school student enrollment system mapping students to courses so they earn required credits", {
        "requirements-analysis": "AI",
        architecture: "Human",
        development: "AI",
      })
    );
    Babylon.seu = seu;

    await check("same capability, reached the Babylon way: requirements-analysis is external-orchestrator here", async () => {
      const reqCap = cap(seu.capabilities, "requirements-analysis");
      await P.setExecutionTarget({ tenantId: tenant.id, capabilityId: reqCap.capabilityId, mode: "external-orchestrator", adapterEndpoint: "https://orchestrator.babylon.example/run", adapterAuthRef: "babylon-run-token" });
      const got = await P.getExecutionTarget(reqCap.capabilityId, tenant.id);
      assert.equal(got.effectiveMode, "external-orchestrator");
    });

    await check("full lifecycle to Baselined runs identically on the same core", async () => {
      const reqSpec = del(seu.deliverables, "Requirements Specification");
      await toBaselined(seu.seuId, reqSpec.id, reqSpec.name, Babylon.worker);
      const tr = await P.traceability(reqSpec.id);
      const states = tr.explanation.provenance.map((p) => `${p.fromState}->${p.toState}`);
      for (const s of ["Defined->In Progress", "In Progress->Approved", "Approved->Baselined"]) assert.ok(states.includes(s), `expected ${s}`);
      assert.equal(tr.explanation.provenance.find((p) => p.toState === "Baselined").certified, true);
    });
  });
}

// ============================================================================
// Scenario 3 — Decoupling / core-invariance (§0.1): one core, per-tenant edges.
// ============================================================================
async function decoupling() {
  await scenario("Decoupling — the same Capability is reached differently per tenant, on an identical core", async () => {
    if (!Atlas.seu || !Babylon.seu) return note("both tenants required (a prior setup aborted)");
    const capId = cap(Atlas.seu.capabilities, "requirements-analysis").capabilityId;
    await check("requirements-analysis resolves human-on-ui for Atlas but external-orchestrator for Babylon", async () => {
      const atlasMode = (await P.getExecutionTarget(capId, Atlas.tenantId)).effectiveMode;
      const babylonMode = (await P.getExecutionTarget(capId, Babylon.tenantId)).effectiveMode;
      assert.equal(atlasMode, "human-on-ui");
      assert.equal(babylonMode, "external-orchestrator");
      assert.notEqual(atlasMode, babylonMode, "the SAME global capability id, two tenant edges, one core");
    });
    await check("the two tenants are distinct and their SEUs do not share identity", async () => {
      assert.notEqual(Atlas.tenantId, Babylon.tenantId);
      assert.notEqual(Atlas.seu.seuId, Babylon.seu.seuId);
    });
  });
}

// ============================================================================
// Scenario 4 — Exhaustive non-happy-path.
// ============================================================================
async function edgeCases() {
  await scenario("Edge — empty-centre: an approval cannot certify nothing", async () => {
    const seu = await must("stand up a sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox empty-centre"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    await must("produce with NO reference (empty centre)", async () => {
      const r = await drive(reqSpec.id, reqSpec.name, "In Progress", new SimParticipant({ vcs: Atlas.vcs, behaviour: "empty" }));
      assert.equal(r.result.status, 200, "an empty production still completes the Work Item");
      assert.equal(r.result.body.deliverable.lifecycle_state, "In Progress");
    });
    await check("approving the empty Deliverable is rejected with reason empty_centre", async () => {
      const blocked = await P.dispatchTransition(reqSpec.id, "Approved");
      assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
      assert.equal(blocked.body.reason, "empty_centre");
    });
    note("the empty Deliverable stays stuck at In Progress: there is no in-place rework transition to attach a reference (recovery would be a separate governed re-production, out of scope here).");
    await check("on a fresh Deliverable, a real produced reference lets approval through (the presence check clears)", async () => {
      const seu2 = await standUp(Atlas.tenantId, "Sandbox empty-centre cleared");
      const rs2 = del(seu2.deliverables, "Requirements Specification");
      await drive(rs2.id, rs2.name, "In Progress", Atlas.worker); // a real reference this time
      const r = await drive(rs2.id, rs2.name, "Approved", Atlas.worker);
      assert.equal(r.result?.status, 200, JSON.stringify(r.result?.body));
      assert.equal(r.result.body.deliverable.lifecycle_state, "Approved");
    });
  });

  await scenario("Edge — failed & blocked results raise Attention, do not advance state", async () => {
    for (const outcome of ["failed", "blocked"]) {
      const seu = await must(`sandbox SEU for a ${outcome} result`, () => standUp(Atlas.tenantId, `Sandbox ${outcome}`));
      const reqSpec = del(seu.deliverables, "Requirements Specification");
      await check(`a ${outcome} result is accepted (200), the Deliverable stays Defined, and an Attention Item is raised`, async () => {
        const r = await drive(reqSpec.id, reqSpec.name, "In Progress", Atlas.worker, { outcome });
        assert.equal(r.result.status, 200, JSON.stringify(r.result.body));
        assert.equal(r.result.body.outcome, outcome);
        const after = await P.getSeu(seu.seuId);
        assert.equal(del(after.deliverables, "Requirements Specification").lifecycleState, "Defined", "a non-done result does not advance state");
        const items = await P.attentionItems(seu.seuId);
        assert.ok(items.length >= 1, `expected an Attention Item after a ${outcome} result`);
      });
    }
  });

  await scenario("Edge — the result-in callback's error surface (replay, unknown, malformed)", async () => {
    const seu = await must("sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox callbacks"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    const first = await must("first done result succeeds", async () => {
      const r = await drive(reqSpec.id, reqSpec.name, "In Progress", Atlas.worker);
      assert.equal(r.result.status, 200);
      return r;
    });
    await check("a replayed result on the disposed Work Item is a 409 not_outstanding (never a re-apply)", async () => {
      const replay = await P.reportResult(first.workItemId, { outcome: "done", reference: "x" });
      assert.equal(replay.status, 409);
      assert.equal(replay.body.reason, "not_outstanding");
    });
    await check("an unknown Work Item id is a 404", async () => {
      const unknown = await P.reportResult("00000000-0000-0000-0000-000000000000", { outcome: "done" });
      assert.equal(unknown.status, 404);
    });
    await check("an invalid outcome is a 400", async () => {
      const bad = await P.reportResult(first.workItemId, { outcome: "totally-not-valid" });
      assert.equal(bad.status, 400);
    });
  });

  await scenario("Edge — stall/timeout escalation (deterministic via a past deadline)", async () => {
    const seu = await must("sandbox SEU for a stall", () => standUp(Atlas.tenantId, "Sandbox stall"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    await must("dispatch with a deadline already in the past, then never report a result", async () => {
      const d = await P.dispatchTransition(reqSpec.id, "In Progress", { targetCompletionAt: new Date(Date.now() - 3600_000).toISOString() });
      assert.equal(d.status, 202, JSON.stringify(d.body));
    });
    await check("sweep-stalled raises an escalation Attention Item for the overdue Work Item", async () => {
      await P.sweepStalled(seu.seuId);
      const items = await P.attentionItems(seu.seuId);
      assert.ok(items.length >= 1, "expected an Attention Item after the stall sweep");
      note(`attention items after sweep: ${items.map((i) => i.category || i.title || i.state).join(", ")}`);
    });
  });

  await scenario("Edge — opaque reference round-trip (§0.1: the core never parses a VCS reference)", async () => {
    const seu = await must("sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox opaque-ref"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    const weird = "weird-scheme://Ω/repo?rev=πλ#frag@deadBEEF spaces&sym=%%";
    await check("a bizarre provider-specific reference is stored and returned byte-for-byte", async () => {
      await drive(reqSpec.id, reqSpec.name, "In Progress", Atlas.worker, { reference: weird });
      const tr = await P.traceability(reqSpec.id);
      const prod = tr.explanation.provenance.find((p) => p.toState === "In Progress");
      assert.equal(prod.reference, weird, "the core must store the reference verbatim, never parse or normalise it");
    });
  });

  await scenario("Edge — participant replacement (idle and mid-flight)", async () => {
    const seu = await must("sandbox SEU with a fulfilled requirements-analysis participant", () => standUp(Atlas.tenantId, "Sandbox replacement"));
    const reqCap = cap(seu.capabilities, "requirements-analysis");
    const p1 = seu.participants["requirements-analysis"].participantId;
    await check("replace an idle participant: the SEU detail page then shows the replacement fulfilling the Capability", async () => {
      if (!p1) return note("fulfil did not return a participant id — replacement assertion skipped");
      const res = await P.replaceParticipant(seu.seuId, reqCap.capabilityId, p1, { type: "AI", displayName: "Replacement Analyst" });
      assert.ok(res.status === 302 || res.status === 303, `expected a redirect, got ${res.status}`);
      const html = await P.getSeuDetailHtml(seu.seuId);
      assert.ok(html.includes("Replacement Analyst"), "expected the replacement participant to appear on the SEU detail page (redirect alone can be a flashed error)");
    });
    await check("replace mid-flight: while a Work Item is outstanding, the replacement takes over the Capability", async () => {
      const reqSpec = del(seu.deliverables, "Requirements Specification");
      const d = await P.dispatchTransition(reqSpec.id, "In Progress");
      assert.equal(d.status, 202, "a Work Item must be outstanding for the mid-flight case");
      const current = d.body.participantId;
      if (!current) return note("dispatch did not report the assigned participant id — mid-flight replacement skipped");
      const res = await P.replaceParticipant(seu.seuId, reqCap.capabilityId, current, { type: "Human", displayName: "Mid-flight Replacement" });
      assert.ok(res.status === 302 || res.status === 303, `expected a redirect, got ${res.status}`);
      const html = await P.getSeuDetailHtml(seu.seuId);
      assert.ok(html.includes("Mid-flight Replacement"), "expected the mid-flight replacement to appear on the SEU detail page");
    });
  });

  await scenario("Edge — dispatch is deferred when no Participant fulfils the producing Capability", async () => {
    const seu = await must("commission a sandbox SEU but fulfil NOTHING", () => commissionOnly(Atlas.tenantId, "Sandbox deferred"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    await check("dispatching before a Participant exists is refused with reason dispatch_deferred (never silently applied)", async () => {
      const deferred = await P.dispatchTransition(reqSpec.id, "In Progress");
      assert.equal(deferred.status, 409, JSON.stringify(deferred.body));
      assert.equal(deferred.body.reason, "dispatch_deferred");
      const after = await P.getSeu(seu.seuId);
      assert.equal(del(after.deliverables, "Requirements Specification").lifecycleState, "Defined", "a deferred dispatch must not move state");
    });
    await check("once an External participant fulfils the Capability, the same transition dispatches (202)", async () => {
      const reqCap = cap(seu.capabilities, "requirements-analysis");
      // Exercises the third participant.type (External), alongside AI and Human elsewhere.
      await P.fulfil(seu.seuId, reqCap.capabilityId, { type: "External", displayName: "External Orchestrator Participant" });
      const d = await P.dispatchTransition(reqSpec.id, "In Progress");
      assert.equal(d.status, 202, JSON.stringify(d.body));
    });
  });

  await scenario("Edge — an undefined transition is rejected (no_transition_definition), never silently applied", async () => {
    const seu = await must("stand up a sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox invalid-transition"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");
    await check("Defined -> Baselined (skipping the graph) is refused; the Deliverable stays Defined", async () => {
      const bad = await P.dispatchTransition(reqSpec.id, "Baselined");
      assert.equal(bad.status, 409, JSON.stringify(bad.body));
      assert.equal(bad.body.reason, "no_transition_definition");
      const after = await P.getSeu(seu.seuId);
      assert.equal(del(after.deliverables, "Requirements Specification").lifecycleState, "Defined");
    });
  });

  await scenario("Edge — external-orchestrator delivery: the platform hands the assignment to the tenant's orchestrator, which closes the loop", async () => {
    const orch = new SimOrchestrator();
    const base = await orch.start();
    try {
      const seu = await must("stand up a Babylon sandbox SEU (Babylon = svn VCS, external-orchestrator)", () => standUp(Babylon.tenantId, "Sandbox external-delivery"));
      const reqCap = cap(seu.capabilities, "requirements-analysis");
      await must("point Babylon's requirements-analysis execution target at the simulated orchestrator", () =>
        P.setExecutionTarget({ tenantId: Babylon.tenantId, capabilityId: reqCap.capabilityId, mode: "external-orchestrator", adapterEndpoint: `${base}/hook`, adapterAuthRef: "sim-orch-token" })
      );
      const reqSpec = del(seu.deliverables, "Requirements Specification");

      const dispatch = await must("dispatch Defined -> In Progress (202)", async () => {
        const d = await P.dispatchTransition(reqSpec.id, "In Progress");
        assert.equal(d.status, 202, JSON.stringify(d.body));
        return d;
      });

      await check("the orchestrator received the assignment-out carrying Babylon's tenant identity, VCS binding, auth, and the transition", async () => {
        const delivered = await orch.waitFor(dispatch.body.workItemId);
        assert.ok(delivered, "the tenant orchestrator should have received the assignment");
        assert.equal(delivered.url, "/hook");
        assert.equal(delivered.auth, "Bearer sim-orch-token", "the opaque outbound credential is carried at the edge, not by the core");
        assert.equal(delivered.assignment.tenant.id, Babylon.tenantId, "the assignment is stamped with the owning tenant");
        assert.equal(delivered.assignment.vcsBinding.provider, "svn", "Babylon's declared VCS binding travels with the assignment");
        assert.equal(delivered.assignment.transition.toState, "In Progress");
        assert.ok(Array.isArray(delivered.assignment.inputReferences), "the §2.2 input references array is present");
      });

      await check("the orchestrator does the work and reports back to the same result-in callback, closing the loop (200, state advances)", async () => {
        const ref = Babylon.vcs.commit({ repo: "enrollment", path: "in-progress/output", message: "orchestrated" });
        const result = await P.reportResult(dispatch.body.workItemId, { outcome: "done", reference: ref });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.deliverable.lifecycle_state, "In Progress");
      });
    } finally {
      await orch.stop();
    }
  });

  await scenario("Review Model (Ch.25) — governed evaluation, immutable outcome, Findings, traceability", async () => {
    const seu = await must("stand up a sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox review-model"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");

    const review = await must("plan a Requirements Review against the Requirements Specification", () =>
      P.createReview({ seuId: seu.seuId, relatedObjectType: "Deliverable", relatedObjectId: reqSpec.id, category: "Requirements", name: "Requirements Review" })
    );

    await check("completing a Review without an outcome is refused (409 outcome_required)", async () => {
      await P.transitionReview(review.id, "Prepared");
      await P.transitionReview(review.id, "In Progress");
      const noOutcome = await P.transitionReview(review.id, "Completed");
      assert.equal(noOutcome.status, 409, JSON.stringify(noOutcome.body));
      assert.equal(noOutcome.body.reason, "outcome_required");
    });

    await check("the Review completes with an outcome, which is immutable, and never modifies the reviewed object (RM-001)", async () => {
      const completed = await P.transitionReview(review.id, "Completed", "Passed with Recommendations");
      assert.equal(completed.status, 200, JSON.stringify(completed.body));
      assert.equal(completed.body.review.outcome, "Passed with Recommendations");
      await P.transitionReview(review.id, "Accepted");
      const status = await P.getSeu(seu.seuId);
      assert.equal(del(status.deliverables, "Requirements Specification").lifecycleState, "Defined", "a Review must not modify the reviewed object");
    });

    await check("a High-severity Finding auto-surfaces an Attention Item and can be converted to an Obligation", async () => {
      const finding = await P.createFinding(review.id, { severity: "High", title: "Acceptance criteria are ambiguous", description: "Credit mapping underspecified" });
      const items = await P.attentionItems(seu.seuId);
      assert.ok(items.some((i) => i.category === "Action Required"), "a High Finding surfaces an Action Required Attention Item");
      const converted = await P.convertFindingToObligation(finding.id, "Engineering");
      assert.equal(converted.status, 200, JSON.stringify(converted.body));
      assert.ok(converted.body.obligationId, "the Finding converts to an Obligation");
      const again = await P.convertFindingToObligation(finding.id);
      assert.equal(again.status, 409, "a Finding cannot be converted twice");
      assert.equal(again.body.reason, "already_converted");
    });

    await check("traceability lists the Review and its Findings against the Deliverable (Ch.25 §14)", async () => {
      const tr = await P.traceability(reqSpec.id);
      assert.ok(tr.explanation.reviews.some((r) => r.id === review.id && r.status === "Accepted" && r.outcome === "Passed with Recommendations"), "the Review appears in traceability");
      assert.ok(tr.explanation.findings.length >= 1, "the Finding appears in traceability");
    });
  });

  await scenario("Compliance Model (Ch.27) — emergent, read-only evaluation over existing governance, with waivers", async () => {
    const RUNC = Date.now().toString(36);
    const fw = `dryrun-fw-${RUNC}`;
    const reqReview = `dryrun-req-review-${RUNC}`;
    const reqDecision = `dryrun-req-decision-${RUNC}`;

    await must("register a Compliance Framework + two declarative Requirements (composing existing primitives)", async () => {
      await P.registerComplianceFramework({ code: fw, name: "Dry-run Compliance Framework" });
      await P.registerComplianceRequirement({ code: reqReview, frameworkCode: fw, name: "Security review accepted", criteria: { type: "requires_accepted_review", category: "Security" } });
      await P.registerComplianceRequirement({ code: reqDecision, frameworkCode: fw, name: "Privacy decision approved", criteria: { type: "requires_approved_decision", category: "Privacy" } });
    });

    const seu = await must("stand up a sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox compliance"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");

    await check("both requirements are unsatisfied initially, and evaluation never modifies engineering state (Ch.27 §9)", async () => {
      const evalResult = await P.evaluateCompliance(seu.seuId);
      assert.ok(evalResult.frameworks.includes(fw), `framework ${fw} should apply`);
      assert.equal(evalResult.results.find((r) => r.requirementCode === reqReview)?.state, "unsatisfied");
      assert.equal(evalResult.results.find((r) => r.requirementCode === reqDecision)?.state, "unsatisfied");
      const after = await P.getSeu(seu.seuId);
      assert.equal(del(after.deliverables, "Requirements Specification").lifecycleState, "Defined", "compliance evaluation is read-only");
    });

    await check("satisfying a requirement via the real primitive it composes (an Accepted, passing Security Review) flips it to satisfied", async () => {
      const review = await P.createReview({ seuId: seu.seuId, relatedObjectType: "Deliverable", relatedObjectId: reqSpec.id, category: "Security", name: "Security Review" });
      await P.walkReviewToAccepted(review.id, "Passed");
      const evalResult = await P.evaluateCompliance(seu.seuId);
      assert.equal(evalResult.results.find((r) => r.requirementCode === reqReview)?.state, "satisfied", "the compliance requirement reads the Review outcome");
    });

    await check("a Waiver moves the still-unsatisfied requirement to waived", async () => {
      await P.grantComplianceWaiver(seu.seuId, reqDecision, "Privacy decision deferred; risk accepted for the pilot.");
      const evalResult = await P.evaluateCompliance(seu.seuId);
      assert.equal(evalResult.results.find((r) => r.requirementCode === reqDecision)?.state, "waived");
    });

    await check("a compliance report is generated from engineering state (Ch.27 §12)", async () => {
      const report = await P.complianceReport(seu.seuId);
      assert.ok(report.frameworks.includes(fw));
      assert.ok(["Compliant", "Compliant with Exceptions", "Partially Compliant", "Non-Compliant", "Compliance Unknown"].includes(report.status));
      assert.ok(Array.isArray(report.satisfied) && Array.isArray(report.outstanding) && Array.isArray(report.waived));
    });
  });

  await scenario("Ontology Model (Ch.18) — canonical vocabulary enforced on write; tenant rename-only alias resolved at read", async () => {
    if (!Atlas.tenantId || !Babylon.tenantId) return note("both tenants required (a prior setup aborted)");

    await check("the canonical vocabulary is queryable and platform-owned", async () => {
      const concepts = await P.ontologyConcepts("category:evidence");
      assert.ok(concepts.some((c) => c.code === "Validation Evidence"), "expected the canonical evidence vocabulary");
    });

    const seu = await must("stand up a sandbox SEU", () => standUp(Atlas.tenantId, "Sandbox ontology"));
    const reqSpec = del(seu.deliverables, "Requirements Specification");

    await check("write-path enforcement: an off-canonical category is rejected (400); a canonical one is accepted (201)", async () => {
      const bad = await P.createEvidenceRaw({ seuId: seu.seuId, deliverableId: reqSpec.id, category: "Totally Made Up XYZ", title: "bad", source: "dry-run" });
      assert.equal(bad.status, 400, "an off-list category must be rejected on the write path");
      const good = await P.createEvidenceRaw({ seuId: seu.seuId, deliverableId: reqSpec.id, category: "Validation Evidence", title: "good", source: "dry-run" });
      assert.equal(good.status, 201, "a canonical category is accepted");
      assert.equal(good.body.evidence.category, "Validation Evidence", "stored verbatim as the canonical code");
    });

    await check("tenant rename-only alias: the SAME canonical code resolves to different labels per tenant, on one core", async () => {
      const a = await P.setConceptAlias(Atlas.tenantId, { conceptType: "category:evidence", canonicalCode: "Validation Evidence", displayLabel: "VALEV" });
      const b = await P.setConceptAlias(Babylon.tenantId, { conceptType: "category:evidence", canonicalCode: "Validation Evidence", displayLabel: "Sign-off Proof" });
      assert.equal(a.status, 200); assert.equal(b.status, 200);
      const atlasVocab = await P.tenantVocabulary(Atlas.tenantId, "category:evidence");
      const babylonVocab = await P.tenantVocabulary(Babylon.tenantId, "category:evidence");
      assert.equal(atlasVocab["Validation Evidence"], "VALEV");
      assert.equal(babylonVocab["Validation Evidence"], "Sign-off Proof");
      // A concept the tenant hasn't aliased falls back to the platform default.
      assert.equal(atlasVocab["Analytical Evidence"], "Analytical Evidence");
    });

    await check("clearing an alias (empty label) reverts a tenant to the platform default", async () => {
      await P.setConceptAlias(Atlas.tenantId, { conceptType: "category:evidence", canonicalCode: "Validation Evidence", displayLabel: "" });
      const vocab = await P.tenantVocabulary(Atlas.tenantId, "category:evidence");
      assert.equal(vocab["Validation Evidence"], "Validation Evidence");
    });
  });

  await scenario("Edge — separation of duties (structural; negative case documented)", async () => {
    if (!Atlas.seu) return note("Atlas SEU required");
    const reqSpec = del(Atlas.seu.deliverables, "Requirements Specification");
    await check("the platform records WHICH authority certified each acceptance (creator vs approver are distinct rules)", async () => {
      const tr = await P.traceability(reqSpec.id);
      const acc = tr.explanation.provenance.find((p) => p.toState === "Approved");
      assert.ok(acc?.actingAuthorityGrantId, "an acceptance records its certifying authority grant");
    });
    note("Negative case (a creator attempting the approver transition -> authority_denied) needs a non-root identity.");
    note("The NODE_ENV=test auto-login is a single root badge holder, so it is not reachable black-box here.");
    note("It is covered in-process by the repo's badge-model.test.ts. This is a harness limitation, not a gap.");
  });
}

// Per-tenant state carried across scenarios.
const Atlas = { vcs: new SimVCS("git", "atlas"), worker: null, seu: null, tenantId: null };
const Babylon = { vcs: new SimVCS("svn", "babylon"), worker: null, seu: null, tenantId: null };
Atlas.worker = new SimParticipant({ kind: "AI", name: "atlas-agent", vcs: Atlas.vcs });
Babylon.worker = new SimParticipant({ kind: "AI", name: "babylon-agent", vcs: Babylon.vcs });

export async function run() {
  await atlas();
  await babylon();
  await decoupling();
  await edgeCases();
}
