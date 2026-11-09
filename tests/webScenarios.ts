import "../src/domain/engine/eventBus.js";
// SEUs for the web tests, made through the app's own commissioning flow (initiate, validate, compose the EBM, validate and activate it) and never as hand-built rows.
// Only the schema entities (Packs, Template, Profile), the Objectives, the test Ontology and the badges are made directly.
//
//   rich       the web fixture Template and Profile, which carry Deliverables, Capabilities and Services. Its composition has conflicts that are settled when the SEU is driven. Used by tests that need an SEU with content.
//   clean      one Pack, so the composition finds no conflict. The SEU is Operational with its EBM.
//   unsettled  the composition finds conflicts that nobody has settled. The SEU stays Validated with no EBM and the composition report holds the open conflicts.
//   settled    the composition finds the same conflicts and they are settled by picks. The SEU is Operational.
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import type { SeuRow } from "../src/dblayer/seuTypes.js";
import { ensureFixtureTenant, buildStage4Fixtures, type Stage4Fixtures } from "./schemaFixtures.js";
import { initiateSeu } from "../src/routes/seu/core/commissioning.js";
import { compositionCompletedHandler } from "../src/domain/engine/compositionCompleted.js";
import { publishTestEvent } from "./engineFixtures.js";
import type { EbmRow } from "../src/dblayer/seuTypes.js";
import { getSystemActor, ensureSeuSystemParticipant } from "../src/dblayer/constants.js";
import {
  ensureWebAppTemplateFixture, ensureEventSubscriptionsLoaded, ensureActorParticipant, createActiveObjective, driveCommissioningToActive, initiateAndValidateSeu,
  uniqueTestPackVersion, TESTER_ALL_ID, PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE,
} from "./testFixtures.js";

export type CompositionScenario = "rich" | "clean" | "unsettled" | "settled";

export interface ScenarioSeu {
  seu: SeuRow;
  objectiveId: string;
  templateId: string;
  profileId: string;
  // Keys of the conflicts the composition found.
  conflictKeys: string[];
}

function failMissingSet(): never {
  throw new Error("webScenarios: a scenario with conflicts needs the conflictSet of the test file");
}

// A Template and a Profile that compose two Packs whose Authority Rules for the same transition name different roles, so the composition finds a conflict.
// The Pack codes are Ontology concepts, so each test file that composes conflicting Packs has a pair of its own and files running side by side never publish over each other.
export type ConflictSet = "objectives" | "entities" | "queue" | "kickoff" | "rows" | "branches" | "gates" | "transition" | "execution";

async function conflictingBase(run: string, set: ConflictSet, packs: "one" | "two"): Promise<{ templateId: string; profileId: string }> {
  const packOf = (code: string, role: string) => ({
    tenantId: PLATFORM_TENANT_ID, code: `schema-fixture-web-conflict-${set}-${code}`, name: `Web conflict ${code}`, category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: { authorityRules: [{ code: `web-auth-${code}-${run}`, governedTransition: `x.transition.${run}`, authorisedRole: role }] },
  });
  const a = packOf("a", "general");
  const b = packOf("b", "super");
  const used = packs === "one" ? [a] : [a, b];
  for (const pack of used) {
    const published = await publishPack({ seed: pack as never, actorId: TESTER_ALL_ID, activate: true });
    assert.ok(published.ok, published.ok ? "" : `the conflicting Pack does not publish: ${(published.errors ?? []).join("; ")}`);
  }
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `web-conflict-tpl-${run}`, name: "Web conflict Template", deliverableCatalogue: [] });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template.id, used.map((pack) => pack.code), ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  await templatesDB.setRequiredCapabilities(template.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `web-conflict-prof-${run}`, name: "Web conflict Profile", baseTemplateId: template.id, authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, environment: "development" });
  assert.ok(profile);
  return { templateId: template.id, profileId: profile.id };
}

// Takes the SEU through the app's commissioning flow for the scenario. Root becomes a Participant of the SEU so the web routes can act on it.
export async function commissionScenario(kind: CompositionScenario, label: string, options: { rootParticipant?: boolean; conflictSet?: ConflictSet } = {}): Promise<ScenarioSeu> {
  await ensureEventSubscriptionsLoaded();
  const run = randomUUID().slice(0, 8);
  const base = kind === "rich" ? await ensureWebAppTemplateFixture().then((f) => ({ templateId: f.template.id, profileId: f.profile.id })) : await conflictingBase(run, options.conflictSet ?? failMissingSet(), kind === "clean" ? "one" : "two");
  const { objective: strategic } = await createObjective({ statement: `${label} strategic ${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID });
  const { objective } = await createActiveObjective({ statement: `${label} ${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: strategic.id, requestedBy: TESTER_ALL_ID });

  const validated = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: base.profileId, actorId: TESTER_ALL_ID, tenantId: PLATFORM_TENANT_ID });
  assert.ok(validated.ok, validated.ok ? "" : `${validated.stage}: ${validated.reason}`);
  if (!validated.ok) throw new Error("unreachable");

  const driven = await driveCommissioningToActive({ seuId: validated.seu.id, actorId: TESTER_ALL_ID, leaveConflictsOpen: kind === "unsettled" });
  if (kind === "unsettled") {
    assert.equal(driven.ok, false, "open conflicts block the composition");
  } else {
    assert.ok(driven.ok, driven.ok ? "" : `${driven.stage}: ${driven.reason}`);
  }
  const { data: seu } = await seusDB.findById(validated.seu.id);
  assert.ok(seu);
  if (options.rootParticipant !== false) await ensureActorParticipant(seu.id, ROOT_ACTOR_ID);
  const report = seu.composition_report as { ebmConflicts?: Record<string, Array<{ key: string; notice?: boolean }>> } | null;
  const conflictKeys = Object.values(report?.ebmConflicts ?? {}).flat().filter((c) => !c.notice).map((c) => c.key);
  return { seu, objectiveId: objective.id, templateId: base.templateId, profileId: base.profileId, conflictKeys };
}

// The SEU of a scenario with its system participant, for the tests that act as the engine does.
export interface CommissionedSeu extends ScenarioSeu { systemParticipantId: string; systemActorId: string }

export async function commissionedSeu(label: string, kind: CompositionScenario = "rich", options: { rootParticipant?: boolean; conflictSet?: ConflictSet } = {}): Promise<CommissionedSeu> {
  const scenario = await commissionScenario(kind, label, options);
  // An SEU whose composition is blocked is not Commissioned, so its system participant is not made yet.
  if (kind === "unsettled") await ensureSeuSystemParticipant(scenario.seu.id);
  const system = await getSystemActor(scenario.seu.id);
  return { ...scenario, systemParticipantId: system.authorId, systemActorId: system.actorId };
}

// An SEU commissioned on the schema fixture Profile, which selects the maximal fixture Pack and a Pack of every category. The EBM composed from it carries the
// Pack's policies, gates, authority rules, checklists, capital and the Profile's configuration. The schema fixtures are the only hand-built part.
export interface FixtureSeu extends CommissionedSeu { tenantId: string; fixtures: Stage4Fixtures }

export async function commissionFixtureSeu(label: string): Promise<FixtureSeu> {
  await ensureEventSubscriptionsLoaded();
  const tenantId = await ensureFixtureTenant(label);
  const fixtures = await buildStage4Fixtures(tenantId);
  const run = randomUUID().slice(0, 8);
  const { objective: strategic } = await createObjective({ statement: `${label} strategic ${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID });
  const { objective } = await createActiveObjective({ statement: `${label} ${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: strategic.id, requestedBy: TESTER_ALL_ID });
  const validated = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: fixtures.profile.id, actorId: TESTER_ALL_ID, tenantId });
  assert.ok(validated.ok, validated.ok ? "" : `${validated.stage}: ${validated.reason}`);
  if (!validated.ok) throw new Error("unreachable");
  const driven = await driveCommissioningToActive({ seuId: validated.seu.id, actorId: TESTER_ALL_ID });
  assert.ok(driven.ok, driven.ok ? "" : `${driven.stage}: ${driven.reason}`);
  const { data: seu } = await seusDB.findById(validated.seu.id);
  assert.ok(seu);
  await ensureActorParticipant(seu.id, ROOT_ACTOR_ID);
  const system = await getSystemActor(seu.id);
  return { seu, objectiveId: objective.id, templateId: seu.template_id, profileId: seu.profile_id, conflictKeys: [], systemParticipantId: system.authorId, systemActorId: system.actorId, tenantId, fixtures };
}

// An SEU as the app leaves it right after "Initiate SEU": in its first state, on an Active leaf Objective and the fixture Profile. Root is a Participant of it.
export async function initiatedSeu(label: string): Promise<ScenarioSeu> {
  const run = randomUUID().slice(0, 8);
  const { template, profile } = await ensureWebAppTemplateFixture();
  const { objective: strategic } = await createObjective({ statement: `${label} strategic ${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID });
  const { objective } = await createActiveObjective({ statement: `${label} ${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: strategic.id, requestedBy: TESTER_ALL_ID });
  const initiated = await initiateSeu({ objectiveId: objective.id, profileId: profile.id, actorId: TESTER_ALL_ID, tenantId: PLATFORM_TENANT_ID });
  assert.ok(initiated.ok, initiated.ok ? "" : initiated.reason);
  if (!initiated.ok) throw new Error("unreachable");
  await ensureActorParticipant(initiated.seu.id, ROOT_ACTOR_ID);
  return { seu: initiated.seu, objectiveId: objective.id, templateId: template.id, profileId: profile.id, conflictKeys: [] };
}

// The EBM the app makes from a stashed composition: the composition is stashed on the SEU and the Composition Completed handler, which commissioning runs, makes the EBM.
export async function ebmFromComposition(seuId: string, composition: Record<string, unknown>): Promise<EbmRow> {
  await seusDB.setCompositionReport(seuId, composition);
  const event = await publishTestEvent({ eventType: "CompositionCompleted", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, payload: { seuId, authorBadge: ROOT_ACTOR_BADGE } });
  await compositionCompletedHandler(event);
  const { data: seu } = await seusDB.findById(seuId);
  assert.ok(seu?.active_ebm_id, "the composition made the EBM");
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  assert.ok(ebm);
  return ebm;
}
