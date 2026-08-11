// Shared test-only fixture — NOT part of any production seed pipeline
// (seedSeu.ts, cleanSlate.ts). Several tests were written against
// template-web-application/profile-default-development, which used to be
// seeded ambiently by seedSeu.ts; db:clean-slate deliberately no longer
// recreates them (the intended path post-reset is authoring through the SDK
// UI, not a pre-seeded demo — see Database Clean Slate — Instructions.md).
// That's the right call for the real database, but it left these tests
// depending on ambient state nothing guarantees anymore.
//
// Fix: reuse the exact original seed data (web-application.template.json /
// default-development.profile.json — never deleted, only the DB rows were)
// via one idempotent, test-scoped helper, instead of each test file
// re-deriving its own throwaway Template and losing the specific shape
// (dependsOnCapabilityServiceCodes wiring, mandatoryPackCodes) some of these
// tests are specifically about. Safe to call from many test files/processes
// concurrently (upsert, not create) and safe to leave in place after a real
// db:clean-slate run — it recreates itself the next time tests run, the
// same way seedSdkAuthoringBootstrap.ts does for the SDK's own bootstrap
// rows.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { transitionDeliverable, type TransitionDeliverableResult } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import type { DeliverableRow, ProfileRow, TemplateDeliverableSeed, TemplateRow } from "../src/dblayer/seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "dblayer", "seed", "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  name: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters: Record<string, unknown>;
  optionalPackCodes?: string[];
}

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
  const dispatched = await transitionDeliverable(input);
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
// template-web-application with its required_capabilities junction rows
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

  const { data: capabilities } = await capabilitiesDB.findByCodes(templateSeed.requiredCapabilityCodes);
  const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
  const requiredCapabilityIds = templateSeed.requiredCapabilityCodes.map((code) => {
    const id = capabilityIdByCode.get(code);
    if (!id) throw new Error(`template ${templateSeed.code} requires unknown capability ${code}`);
    return id;
  });

  const { data: existingRequired } = await templatesDB.getRequiredCapabilities(template.id);
  if (!sameSet((existingRequired ?? []).map((c) => c.id), requiredCapabilityIds)) {
    await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);
  }

  const { data: existingMandatory } = await templatesDB.getMandatoryPackCodes(template.id);
  if (!sameSet(existingMandatory ?? [], templateSeed.mandatoryPackCodes)) {
    await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes);
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
