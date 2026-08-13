// The platform API contract, as a thin client. Every function here maps to one
// real endpoint (verified against src/routes/seu/api/* and the repo's own e2e
// tests). This is tenant-invariant: no VCS/orchestrator/auth specifics leak in —
// those live in edge.mjs. Functions return the raw { status, body } where a
// scenario asserts on status codes; otherwise they return the useful payload and
// throw on an unexpected status (so setup failures are loud).
import { http, urls, csrfFor } from "./harness.mjs";

function expect(res, status, what) {
  if (res.status !== status) {
    throw new Error(`${what}: expected HTTP ${status}, got ${res.status} — ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// ---- tenancy & contract ------------------------------------------------------
export async function ensureTenant(code, name) {
  const res = await http("POST", urls.api("/tenants"), { json: { code, name } });
  if (res.status === 201) return res.body.tenant;
  if (res.status === 409) {
    const all = expect(await http("GET", urls.api("/tenants")), 200, "GET /tenants").tenants;
    const found = all.find((t) => t.code === code);
    if (!found) throw new Error(`tenant ${code} reported existing but not found in list`);
    return found;
  }
  throw new Error(`POST /tenants ${code}: unexpected ${res.status} — ${JSON.stringify(res.body)}`);
}

export async function setContract(tenantId, contract) {
  return expect(await http("POST", urls.api(`/tenants/${tenantId}/contract`), { json: contract }), 200, "POST contract").contract;
}

export async function setExecutionTarget({ tenantId, capabilityId, mode, adapterEndpoint, adapterAuthRef }) {
  return expect(
    await http("POST", urls.api("/execution-targets"), { json: { tenantId, capabilityId, mode, adapterEndpoint, adapterAuthRef } }),
    200,
    "POST /execution-targets"
  ).executionTarget;
}

export async function getExecutionTarget(capabilityId, tenantId) {
  return expect(await http("GET", urls.api(`/execution-targets/${capabilityId}?tenantId=${tenantId}`)), 200, "GET execution-target");
}

// ---- commissioning -----------------------------------------------------------
export async function createObjective(statement, requiredCapabilityCodes) {
  // CR-009: only Strategic Objectives may be roots — an Engineering Objective
  // needs a parent. Create a Strategic root, then the Engineering leaf under it,
  // and return the leaf (what commissioning targets). Both default to Active.
  const root = expect(
    await http("POST", urls.api("/objectives"), { json: { statement: `${statement} [root]`, requiredCapabilityCodes, tier: "Strategic" } }),
    201,
    "POST /objectives (Strategic root)"
  );
  return expect(
    await http("POST", urls.api("/objectives"), { json: { statement, requiredCapabilityCodes, tier: "Engineering", parentObjectiveId: root.id } }),
    201,
    "POST /objectives (Engineering leaf)"
  );
}

export async function pickTemplate(capabilityCodes) {
  const body = expect(await http("GET", urls.api(`/templates?capabilityCodes=${capabilityCodes.join(",")}`)), 200, "GET /templates");
  const t = (body.candidates || []).find((c) => c.satisfies);
  if (!t) throw new Error(`no Template satisfies [${capabilityCodes.join(", ")}] — did you run the seed prerequisite (pnpm seed:seu)?`);
  return t;
}

export async function createProfile(templateId, environment = "development") {
  return expect(await http("POST", urls.api("/profiles"), { json: { templateId, environment } }), 201, "POST /profiles");
}

export async function commission({ objectiveId, templateId, profileId, tenantId }) {
  return expect(await http("POST", urls.api("/commission"), { json: { objectiveId, templateId, profileId, tenantId } }), 201, "POST /commission");
}

export async function getSeu(seuId) {
  return expect(await http("GET", urls.api(`/seus/${seuId}`)), 200, "GET /seus/:id");
}

export async function getEvents(seuId) {
  return expect(await http("GET", urls.api(`/seus/${seuId}/events`)), 200, "GET events").events;
}

// The rendered web detail page (used to verify a web-form action actually took
// effect — both flashSuccess and flashError redirect 302, so status alone can't
// tell them apart; the durable participant name on the page can).
export async function getSeuDetailHtml(seuId) {
  return (await http("GET", urls.web(`/seus/${seuId}`))).text;
}

// ---- participants ------------------------------------------------------------
export async function fulfil(seuId, capabilityId, participant) {
  return expect(
    await http("POST", urls.api(`/seus/${seuId}/capabilities/${capabilityId}/fulfil`), { json: { participant } }),
    200,
    "POST fulfil"
  );
}

// Web-only route — needs CSRF + session cookie. Returns { status, location }.
export async function replaceParticipant(seuId, capabilityId, participantId, participant) {
  const csrf = await csrfFor(`/seu/seus/${seuId}`);
  const res = await http("POST", urls.web(`/seus/${seuId}/capabilities/${capabilityId}/participant/${participantId}/replace`), {
    form: { _csrf: csrf, participantType: participant.type, displayName: participant.displayName },
  });
  return { status: res.status, location: res.location, body: res.body };
}

// ---- deliverable transitions (async, Model A) --------------------------------
// Returns the raw { status, body } so scenarios can assert 202 / 409 / 404.
export async function dispatchTransition(deliverableId, targetState, extra = {}) {
  return http("POST", urls.api(`/deliverables/${deliverableId}/transition`), { json: { targetState, ...extra } });
}

export async function reportResult(workItemId, { outcome, reference }) {
  return http("POST", urls.api(`/work-items/${workItemId}/result`), { json: { outcome, reference } });
}

// ---- evidence (to satisfy the Baselining gate) -------------------------------
export async function createEvidence({ seuId, deliverableId, category, title, source }) {
  return expect(
    await http("POST", urls.api("/evidence"), { json: { seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, source } }),
    201,
    "POST /evidence"
  ).evidence;
}

export async function transitionEvidence(evidenceId, targetState) {
  return expect(await http("POST", urls.api(`/evidence/${evidenceId}/transition`), { json: { targetState } }), 200, "POST evidence transition").evidence;
}

// ---- traceability / attention / stall ----------------------------------------
export async function traceability(deliverableId) {
  return expect(await http("GET", urls.api(`/deliverables/${deliverableId}/traceability`)), 200, "GET traceability");
}

export async function sweepStalled(seuId) {
  return expect(await http("POST", urls.api(`/work-items/sweep-stalled?seuId=${seuId}`)), 200, "POST sweep-stalled");
}

export async function attentionItems(seuId) {
  return expect(await http("GET", urls.api(`/attention-items?seuId=${seuId}`)), 200, "GET attention-items").attentionItems;
}

// ---- reviews & findings (Phase 14 — Ch.25) -----------------------------------
export async function createReview({ seuId, relatedObjectType, relatedObjectId, category, name }) {
  return expect(await http("POST", urls.api("/reviews"), { json: { seuId, relatedObjectType, relatedObjectId, category, name } }), 201, "POST /reviews").review;
}

// Returns the raw { status, body } so scenarios can assert 409 outcome_required etc.
export async function transitionReview(reviewId, targetState, outcome) {
  return http("POST", urls.api(`/reviews/${reviewId}/transition`), { json: { targetState, ...(outcome ? { outcome } : {}) } });
}

export async function createFinding(reviewId, { severity, title, description }) {
  return expect(await http("POST", urls.api(`/reviews/${reviewId}/findings`), { json: { severity, title, description } }), 201, "POST finding").finding;
}

export async function transitionFinding(findingId, targetState) {
  return http("POST", urls.api(`/findings/${findingId}/transition`), { json: { targetState } });
}

export async function convertFindingToObligation(findingId, category) {
  return http("POST", urls.api(`/findings/${findingId}/convert-to-obligation`), { json: category ? { category } : {} });
}

// Walk a Review Planned -> Prepared -> In Progress -> Completed(outcome) -> Accepted.
export async function walkReviewToAccepted(reviewId, outcome) {
  await transitionReview(reviewId, "Prepared");
  await transitionReview(reviewId, "In Progress");
  const completed = await transitionReview(reviewId, "Completed", outcome);
  if (completed.status !== 200) throw new Error(`completing review failed: ${completed.status} ${JSON.stringify(completed.body)}`);
  await transitionReview(reviewId, "Accepted");
}

// ---- compliance (Phase 15 — Ch.27) -------------------------------------------
export async function registerComplianceFramework({ code, name, originatingPackId }) {
  return expect(await http("POST", urls.api("/compliance/frameworks"), { json: { code, name, originatingPackId } }), 200, "POST framework").framework;
}

export async function registerComplianceRequirement({ code, frameworkCode, name, criteria, severity, conflictsWith, originatingPackId }) {
  return expect(await http("POST", urls.api("/compliance/requirements"), { json: { code, frameworkCode, name, criteria, severity, conflictsWith, originatingPackId } }), 200, "POST requirement").requirement;
}

export async function evaluateCompliance(seuId) {
  return expect(await http("GET", urls.api(`/seus/${seuId}/compliance`)), 200, "GET compliance");
}

export async function grantComplianceWaiver(seuId, requirementCode, rationale) {
  return expect(await http("POST", urls.api(`/seus/${seuId}/compliance/waivers`), { json: { requirementCode, rationale } }), 200, "POST waiver").waiver;
}

export async function complianceReport(seuId) {
  return expect(await http("GET", urls.api(`/seus/${seuId}/compliance/report`)), 200, "GET compliance report");
}

// ---- ontology / vocabulary (Phase 17 — Ch.18) --------------------------------
export async function ontologyConcepts(conceptType) {
  return expect(await http("GET", urls.api(`/ontology/concepts?conceptType=${encodeURIComponent(conceptType)}`)), 200, "GET concepts").concepts;
}

export async function setConceptAlias(tenantId, { conceptType, canonicalCode, displayLabel }) {
  return http("POST", urls.api(`/tenants/${tenantId}/aliases`), { json: { conceptType, canonicalCode, displayLabel } });
}

export async function tenantVocabulary(tenantId, conceptType) {
  return expect(await http("GET", urls.api(`/tenants/${tenantId}/vocabulary?conceptType=${encodeURIComponent(conceptType)}`)), 200, "GET vocabulary").labels;
}

// Raw evidence create so a scenario can assert the write-path rejection (400).
export async function createEvidenceRaw({ seuId, deliverableId, category, title, source }) {
  return http("POST", urls.api("/evidence"), { json: { seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, title, source } });
}

// ---- governance model (Phase 16 — Ch.21 FR-21.1) -----------------------------
export async function governanceModel(seuId) {
  return expect(await http("GET", urls.api(`/seus/${seuId}/governance-model`)), 200, "GET governance-model");
}

// ---- dev-only "Act As" switcher (CR-001) -------------------------------------
// Web-only routes (CSRF + session cookie). Only reachable under NODE_ENV=test
// as the single god identity (the auto-login the suite already runs as), so the
// suite can assume a non-root badge and exercise real authority denials. Both
// return the raw { status, location } — a 302 redirect is the web-form success.
export async function actAs(tenantId, badgeType) {
  const csrf = await csrfFor(`/seu/seus`);
  const res = await http("POST", urls.web(`/dev/act-as`), { form: { _csrf: csrf, tenantId: tenantId ?? "", badgeType } });
  return { status: res.status, location: res.location };
}

export async function resetActAs() {
  const csrf = await csrfFor(`/seu/seus`);
  const res = await http("POST", urls.web(`/dev/act-as/reset`), { form: { _csrf: csrf } });
  return { status: res.status, location: res.location };
}

// GET a requirePlatformBadge('root')-gated web surface — returns raw status so a
// scenario can assert 200 (allowed) vs a 302 redirect (denied) under Act-As.
export async function getRootGatedSurface() {
  return http("GET", urls.web(`/identity/tenants`));
}
