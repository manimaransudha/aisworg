// Shared test-only fixture — NOT part of any production seed pipeline
// (cleanSlate.ts). Several tests were written against
// test-enterprise-web-application/test-profile-default-development, which
// used to be seeded ambiently by seedSeu.ts; that script is retired entirely now (owner,
// 2026-08-20: it left platform-core-engineering/technology-nodejs un-reset by
// every later db:clean-slate — "That is polluting the db") and
// db:clean-slate deliberately no longer recreates these two either way (the
// intended path post-reset is authoring through the SDK UI, not a pre-seeded
// demo — see Database Clean Slate — Instructions.md). That's the right call
// for the real database, but it left these tests depending on ambient state
// nothing guarantees anymore.
//
// Fix: reuse the exact original seed data (web-application.template.json /
// default-development.profile.json — still real files, just no longer
// referenced by any production script) via one idempotent, test-scoped
// helper, instead of each test file re-deriving its own throwaway Template
// and losing the specific shape (dependsOnCapabilityServiceCodes wiring,
// mandatoryPackCodes) some of these tests are specifically about. Safe to
// call from many test files/processes concurrently (upsert, not create) and
// safe to leave in place after a real db:clean-slate run — it recreates
// itself the next time tests run.
//
// 2026-08-25 (owner: "alter the test suites to use the seeded packs, not
// the legacy ones") — web-application.template.json's own mandatoryPackCodes
// no longer names platform-core-engineering/technology-nodejs (both
// confirmed permanently unpublishable — no working bootstrap path, and 69
// CRs of real design work since either was the source of truth). It named 3
// real, always-seeded OpenUP capability-pattern Packs instead — briefly.
//
// 2026-08-25, later same day — briefly moved onto test-only twins
// (test-requirements-analysis/test-architecture-solution-design/
// test-development, seedTestFixturePacks.ts / migration 119) after a live
// collision was found: tests/sdk-authoring.test.ts reused the literal code
// "development" for its own throwaway authored-Pack tests, and since only
// one Pack version per code can be Active, every run of that file deprecated
// this fixture's real dependency out from under every other test file.
//
// 2026-08-25, reverted back to the real Pack codes same day — the twins
// introduced a worse, systemic problem: capabilities.code is Pack-scoped
// (CR-065), not globally unique, so having BOTH the real Pack and its twin
// simultaneously Active meant every capability code this fixture derives
// (requirements-analysis/architecture/development) now had TWO rows.
// capabilitiesDB.findByCodes (used by createObjective wherever
// requiredCapabilityCodes is passed — ~30 test files) has no Pack scoping at
// all, so it silently returned double the expected capabilities platform-
// wide the moment both Packs were Active together. Fixed properly instead:
// sdk-authoring.test.ts now mints its own randomized, per-run
// capability-name concept (registerTestOntologyCode) rather than reusing any
// shared identity, so this fixture no longer needs to avoid the real Packs
// at all — the original collision is solved at its actual source.
//
// 2026-08-27 — the fixture's OWN identity renamed: `enterprise-web-application`
// (web-application.template.json) collided with a REAL production Template,
// `enterprise-web-application-parent.template.json` (one of the 9 standard
// Templates, seedSdlcStandardTemplates.ts) — same code, different
// templateVersion, so templatesDB.upsert's own (code, template_version,
// tenant_id) ON CONFLICT never merged them; both rows coexisted, and
// templatesDB.findByCode's "most recent wins" resolution non-deterministically
// picked whichever was seeded last, silently handing several tests the real
// 9-deliverable Template instead of this fixture's own 3-deliverable one.
// Same collision class as the Pack-code/capability-code ones above, one layer
// up. Renamed to `test-enterprise-web-application` /
// `test-profile-default-development` — never touches templatesDB.upsert's
// Ontology validation (that only applies to the real authoring pipeline,
// createAuthoringDraft/publishAuthoringDraft — this fixture calls
// templatesDB.upsert directly), so no new Ontology concept was needed, unlike
// the Pack-code rename earlier.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { dependencyDefinitionsDB } from "../src/dblayer/dependencyDefinitionsDB.js";
import { materialiseDependencyGraph } from "../src/domain/engine/materialiseDependencyGraph.js";
import { deriveCapabilityCodesFromPackCodes } from "../src/routes/seu/core/templates.js";
import { addConcept } from "../src/routes/seu/core/ontology.js";
import pool from "../src/utils/db.js";
import { transitionDeliverable, type TransitionDeliverableResult } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { seedAllTestFixturePacks } from "../src/dblayer/seed/seedTestFixturePacks.js";
import type { DeliverableRow, ProfileRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../src/dblayer/seuTypes.js";

// Test-only Pack twins (migration 119 / seedTestFixturePacks.ts) — every real
// seed Pack mirrored under a `test-` prefixed code. NOT used by
// ensureWebAppTemplateFixture/ensureCoreEngineeringQualityGates below any
// more (see this file's own header — reverted onto the real Packs, since
// duplicating their capability codes broke every non-Pack-scoped capability
// lookup platform-wide). Still real infrastructure for consumers that need
// "a real, resolvable Pack" without caring about specific capability content
// — e.g. pack-sdk.test.ts's dependency-resolution test,
// dependency-graph-relationship-kind.test.ts's engineeringPackCodes. Same
// memoized, idempotent, self-healing idiom as ensureWebAppTemplateFixture.
let testFixturePacksCached: Promise<void> | null = null;

export function ensureTestFixturePacks(): Promise<void> {
  if (!testFixturePacksCached) testFixturePacksCached = seedAllTestFixturePacks();
  return testFixturePacksCached;
}

// CR-046 (owner: "why are test scripts adding code that is not in the
// ontology??? I thought we fixed this" / "the test script should use a code
// present in the ontology") — Pack.code (capability-name) and Template.code
// (template-categories) are now server-side Ontology-validated at publish
// time (validatePackSeed/validateTemplateSeed's own assertCanonicalCategory
// check). Most tests need a fresh, per-call-unique identity (to avoid
// colliding with a prior run's own leftover rows in this never-reset dev
// database) — reusing one of the small pre-seeded vocabulary's fixed values
// wouldn't give that, so this registers a REAL Ontology concept first,
// genuinely "present in the ontology," not just coincidentally matching one.
// Callers track the returned code themselves and delete the row in their own
// after(), matching the existing user/grant/Template cleanup discipline
// already in these files (e.g. sdk-authoring.test.ts) — this helper only
// creates, it never cleans up on its own.
export async function registerTestOntologyCode(conceptType: string, prefix: string): Promise<string> {
  const code = `${prefix}-${randomUUID()}`;
  await addConcept({ conceptType, code, defaultLabel: prefix }, { isRoot: true, tenantId: null });
  return code;
}

// Shared delete helper for the above — one raw DELETE, callers just track
// which (conceptType, code) pairs they registered.
export async function deleteTestOntologyCodes(entries: Array<{ conceptType: string; code: string }>): Promise<void> {
  for (const { conceptType, code } of entries) {
    await pool.query("DELETE FROM ontology_concepts WHERE concept_type = $1 AND code = $2", [conceptType, code]);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "dblayer", "seed", "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  name: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters: Record<string, unknown>;
  optionalPackCodes?: string[];
}

// CR-006 — the seeded fixture actors (seedIdentityBaseline). Holder ids are
// TEXT; these hold noun_verb grants so tests act as a non-root, badge-holding
// actor. tester-all authorises any transition; creator/approver are for
// separation-of-duties assertions.
export const TESTER_ALL_ID = "1001";
export const TESTER_CREATOR_ID = "1002";
export const TESTER_APPROVER_ID = "1003";

// Model A made transitionDeliverable async (Participant Integration Plan): a
// governed transition is *dispatched*, and the Deliverable only moves when a
// Participant reports a `done` result to the result-in callback. The many
// governance/telemetry/badge tests that are about the *outcome* of a
// transition (was it authorised? did the Quality Gate block? what's the cycle
// time?) — not about the async mechanics — drive the whole dispatch->complete
// round-trip in one call through this helper, which restores the old
// synchronous contract: it returns the moved Deliverable on success, or the
// governance failure verbatim (failures short-circuit before dispatch, so they
// never reach completion). Tests that assert the async mechanics themselves
// (command-pipeline, participant-lifecycle) call transitionDeliverable +
// completeWorkItem directly instead.
export async function transitionDeliverableSync(input: {
  deliverableId: string;
  targetState: string;
  actorRole?: string;
  actorId?: string;
  actingBadgeGrantId?: string;
  requestedBy?: number | null;
}): Promise<{ ok: true; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } } | Extract<TransitionDeliverableResult, { ok: false }>> {
  const dispatched = await transitionDeliverable({ ...input, actorId: input.actorId ?? TESTER_ALL_ID });
  if (!dispatched.ok) return dispatched;
  const completed = await completeWorkItem({
    workItemId: dispatched.workItemId,
    outcome: "done",
    reference: `vcs://test/${input.deliverableId}@${dispatched.pendingTransition.toState}`,
  });
  if (!completed.ok || completed.outcome !== "done") {
    throw new Error(`test transitionDeliverableSync: completion failed: ${completed.ok ? completed.outcome : completed.detail}`);
  }
  return { ok: true, deliverable: completed.deliverable, appliedTransition: completed.appliedTransition };
}

let cached: Promise<{ template: TemplateRow; profile: ProfileRow }> | null = null;

export function ensureWebAppTemplateFixture(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  // Memoized per test process — repeat calls within the same file (or via
  // Promise identity across files that happen to share a process) don't
  // re-run the upserts, but a second process (a separate `node --test` file
  // run) safely re-upserts the same rows.
  if (!cached) cached = seed();
  return cached;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

// Real race found running the full suite: many test files (16+) call this
// fixture, each in its own `node --test` process, all against the same
// shared dev database. templatesDB.setRequiredCapabilities/setMandatoryPacks
// and profilesDB.setOptionalPacks each DELETE their junction rows then
// loop-INSERT fresh ones — not atomic — so two files' concurrent calls could
// interleave, and a *third* file's findCandidateTemplates could catch
// enterprise-web-application with its required_capabilities junction rows
// transiently empty (DELETE already ran, INSERTs hadn't yet), making it
// briefly fail to satisfy any request. Fixed by checking first: only write
// when the junction tables don't already hold the fixture's exact target
// data. After the very first successful seed anywhere against a given
// database, every other file's call becomes a pure read, no DELETE+INSERT
// race window left to hit.
async function seed(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
  const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");

  const { data: template, error: templateErr } = await templatesDB.upsert({
    code: templateSeed.code,
    name: templateSeed.name,
    deliverableCatalogue: templateSeed.deliverableCatalogue,
  });
  if (templateErr || !template) throw templateErr ?? new Error(`template upsert failed: ${templateSeed.code}`);

  const { data: existingMandatory } = await templatesDB.getMandatoryPackCodes(template.id);
  if (!sameSet(existingMandatory ?? [], templateSeed.mandatoryPackCodes)) {
    await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes);
  }

  // CR-038 — requiredCapabilityCodes is derived from the real mandatory-Pack
  // selection now, same as the live authoring form and the SDLC seed script
  // both do, not read from the seed's own (now removed) hand-typed field.
  // 2026-08-25 — mandatoryPackCodes repointed from the dead
  // platform-core-engineering to 3 real, always-seeded OpenUP packs
  // (requirements-analysis/architecture-solution-design/development) —
  // briefly detoured onto their test-only twins the same day, then back (see
  // this file's own header: the twins duplicated these exact 3 capability
  // codes platform-wide, breaking capabilitiesDB.findByCodes wherever
  // requiredCapabilityCodes is used, well beyond this fixture). Resolves the
  // same 3 capability codes (and 28 other test files) already hardcoded —
  // requirements-analysis/architecture/development — rather than updating
  // every test file individually (owner's own call: fix the seed data, not
  // the tests, since Capability.code is free text with no Ontology
  // constraint blocking the rename). Reproduces the exact same 3 capability
  // codes core-engineering used to, just sourced from real Packs now.
  const derivedCapabilityCodes = await deriveCapabilityCodesFromPackCodes(templateSeed.mandatoryPackCodes);
  const { data: capabilities } = await capabilitiesDB.findByCodes(derivedCapabilityCodes);
  const requiredCapabilityIds = (capabilities ?? []).map((c) => c.id);

  const { data: existingRequired } = await templatesDB.getRequiredCapabilities(template.id);
  if (!sameSet((existingRequired ?? []).map((c) => c.id), requiredCapabilityIds)) {
    await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);
  }

  // CR-039/CR-041 — same guard as above: the seed's dependencyGraph never
  // changes across a run, so only materialise once (a non-empty result is
  // that "already holds the fixture's exact target data" state), avoiding
  // the same concurrent DELETE+INSERT race this file's own header warns
  // about (belt-and-braces alongside migration 075's real unique constraint).
  const { data: existingDependencyDefinitions } = await dependencyDefinitionsDB.findByOwner("Template", template.id);
  if (!existingDependencyDefinitions || existingDependencyDefinitions.length === 0) {
    await materialiseDependencyGraph({
      owningEntityType: "Template",
      owningEntityId: template.id,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
      dependencyGraph: templateSeed.dependencyGraph ?? [],
    });
  }

  const { data: profile, error: profileErr } = await profilesDB.upsert({
    code: profileSeed.code,
    name: profileSeed.name,
    baseTemplateId: template.id,
    environment: profileSeed.environment,
    configParameters: profileSeed.configParameters,
  });
  if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);

  const { data: existingOptional } = await profilesDB.getOptionalPackCodes(profile.id);
  const targetOptional = profileSeed.optionalPackCodes ?? [];
  if (!sameSet(existingOptional ?? [], targetOptional)) {
    await profilesDB.setOptionalPacks(profile.id, targetOptional);
  }

  return { template, profile };
}

// CR-058 follow-up — same class of gap as the Template/Profile fixture
// above, discovered the same way: platform-core-engineering's own 2 real
// Quality Gates (core-engineering.pack.json's qualityGates[]) were never
// actually recreated by any working seed path, and that Pack itself has no
// working bootstrap path at all (its own seed script was retired;
// validatePackSeed's capability-name check permanently rejects its code
// being republished). Several tests implicitly assumed these 2 gates
// already existed. Owner: "that just simply means the test scripts have to
// be aligned to the changes we make every time" — idempotent, memoized per
// process, same discipline as ensureWebAppTemplateFixture above.
// 2026-08-25 — repointed off platform-core-engineering entirely (69 CRs of
// real design work later, it's not the source of truth — owner) onto
// `development` (openup-development.pack.json), a real, always-seeded Pack —
// briefly detoured onto `test-development` (the test-only twin) the same
// day, then back onto the real `development` again (see this file's own
// header — the twin caused a worse, systemic capability-code duplication
// bug; test-development is deliberately never published at all now). These
// 2 Quality Gates are directly created here, not published through the
// Pack's own seed JSON (development doesn't declare them) — this function
// only needs a real Pack id to attribute them to, same as before.
let coreGatesCached: Promise<void> | null = null;

export function ensureCoreEngineeringQualityGates(): Promise<void> {
  if (!coreGatesCached) coreGatesCached = seedCoreGates();
  return coreGatesCached;
}

async function seedCoreGates(): Promise<void> {
  const { data: corePack } = await packsDB.findByCode("development");
  if (!corePack) throw new Error("development pack not found — seed baseline is missing entirely, not just its Quality Gates");

  await qualityGatesDB.upsert({
    name: "No Unresolved Obligations",
    category: "Review Evidence",
    entityType: "Deliverable",
    fromState: "In Progress",
    toState: "Approved",
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: corePack.id,
  });

  await qualityGatesDB.upsert({
    name: "Requires Accepted Evidence or Approved Decision",
    category: "Validation Evidence",
    entityType: "Deliverable",
    fromState: "Approved",
    toState: "Baselined",
    criteria: { type: "requires_accepted_evidence_or_approved_decision" },
    originatingPackId: corePack.id,
  });
}
