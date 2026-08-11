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
  return expect(await http("POST", urls.api("/objectives"), { json: { statement, requiredCapabilityCodes } }), 201, "POST /objectives");
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
