// Fixtures for the tests of the engine's event handlers and engines (src/domain/engine). Each helper builds a plain SEU row, an EBM or an event
// directly, so a handler can be called with exactly the data its branch needs. Rows are not deleted, as in the other tests that create SEUs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { seusDB } from "../src/dblayer/seusDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { ensureSeuSystemParticipant, getSystemActor } from "../src/dblayer/constants.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import type { EbmRow, EventRow, SeuLifecycleState, SeuRow } from "../src/dblayer/seuTypes.js";
import { ensureWebAppTemplateFixture, seuBirthState, ensureActorParticipant, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

export interface TestSeu { seu: SeuRow; systemParticipantId: string; systemActorId: string }

// A plain SEU row (not commissioned through the pipeline) with its system participant, and root as a participant of it unless `rootParticipant` is false. `base` names the Template and Profile of the SEU, which are the shared fixture ones otherwise. `tenantId` names its tenant, the Platform tenant otherwise.
export async function createTestSeu(label: string, lifecycleState: SeuLifecycleState | undefined, options: { rootParticipant?: boolean; tenantId: string; base?: { template: { id: string }; profile: { id: string } } }): Promise<TestSeu> {
  const { template, profile } = options.base ?? (await ensureWebAppTemplateFixture());
  const { objective } = await createObjective({ statement: `${label} ${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const { data: seu, error } = await seusDB.create({
    lifecycleState: lifecycleState ?? (await seuBirthState()), authorBadge: ROOT_ACTOR_BADGE, objectiveId: objective.id, templateId: template.id, profileId: profile.id,
    tenantId: options.tenantId, requestedBy: ROOT_ACTOR_ID,
  });
  assert.ok(seu && !error, error?.message ?? "the SEU is created");
  const systemParticipantId = await ensureSeuSystemParticipant(seu.id);
  if (options.rootParticipant !== false) await ensureActorParticipant(seu.id, ROOT_ACTOR_ID);
  return { seu, systemParticipantId, systemActorId: (await getSystemActor(seu.id)).actorId };
}

// An EBM of the SEU with the given behaviours. Set as the SEU's active EBM when `activate` is true. `withSource` records the Deliverable source (the SEU's own
// Template, with no dependency rows) that the dependency and catalogue readers need from an active EBM.
export async function createTestEbm(seu: SeuRow, behaviors: Record<string, unknown> | null, activate = false, withSource = false): Promise<EbmRow> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("EBM");
  assert.ok(birth, "the EBM has a birth row");
  const { data: ebm, error } = await ebmsDB.create({
    seuId: seu.id, templateId: seu.template_id, profileId: seu.profile_id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    status: birth.to_state as never, composedPacks: [], compositionReport: (withSource ? { deliverableSource: { type: "Template", id: seu.template_id, dependencyDefinitionIds: [] } } : {}) as never, behaviors,
  });
  assert.ok(ebm && !error, error?.message ?? "the EBM is created");
  if (activate) await seusDB.setActiveEbm(seu.id, ebm.id);
  return ebm;
}

// Records an event as root without dispatching it: no handler runs even when the process has event subscriptions loaded.
export async function recordTestEvent(input: { eventType: string; originatingObjectType: string; originatingObjectId: string; seuId?: string | null; payload?: Record<string, unknown> }): Promise<EventRow> {
  const { data, error } = await eventsDB.append({
    eventType: input.eventType, originatingObjectType: input.originatingObjectType, originatingObjectId: input.originatingObjectId, seuId: input.seuId ?? null,
    correlationId: randomUUID(), actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, payload: input.payload ?? {},
  });
  if (error || !data) throw error ?? new Error(`failed to record event ${input.eventType}`);
  return data;
}

// Publishes an event as root. Event subscriptions are not loaded in a handler test, so no handler runs; the test calls the handler with the row.
export async function publishTestEvent(input: { eventType: string; originatingObjectType: string; originatingObjectId: string; seuId?: string | null; payload?: Record<string, unknown>; correlationId?: string }): Promise<EventRow> {
  return eventBus.publish({
    eventType: input.eventType, originatingObjectType: input.originatingObjectType, originatingObjectId: input.originatingObjectId, seuId: input.seuId ?? null,
    correlationId: input.correlationId ?? randomUUID(), actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, payload: input.payload ?? {},
  });
}
