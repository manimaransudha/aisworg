// Dispatch Strategies (src/domain/engine/dispatchStrategies.ts): loadAvailableCandidates and selectParticipant with each of the seven strategies.
//
//   - The test builds its own data: two Participants-master rows with different cost, competency and organisation, one with no cost, an SEU with an
//     active EBM that settles the organisation preference, two Retired SEUs (one under the same Objective as the SEU, one under another) that hold
//     past engagements, and Work Items that load the Participants.
//   - Participants are born Available through participantsDB.create. A Participant that is not selectable is moved with the same governed hop
//     the Dispatch Engine uses (applyParticipantHop, as the SEU's system actor).
//   - Rows are not deleted, as in the other tests that create SEUs. The master rows carry no Capability, so no Capability lookup finds them.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { seusDB } from "../src/dblayer/seusDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { ensureSeuSystemParticipant, getSystemActor } from "../src/dblayer/constants.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { applyParticipantHop } from "../src/routes/seu/core/participants.js";
import { loadAvailableCandidates, selectParticipant, type DispatchCandidate } from "../src/domain/engine/dispatchStrategies.js";
import type { ParticipantMasterRow, ParticipantRow, SeuRow } from "../src/dblayer/seuTypes.js";
import { ensureWebAppTemplateFixture, seuBirthState, PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const organisationCode = `zz-org-${run}`;

let seu: SeuRow;
let pastSameObjectiveSeu: SeuRow;
let pastOtherObjectiveSeu: SeuRow;
let systemParticipantId: string;
let systemActorId: string;

let alphaMaster: ParticipantMasterRow; // cost 50, holds the wanted Organisation, no Expert proficiency
let bravoMaster: ParticipantMasterRow; // cost 20, Expert proficiency, no Organisation
let charlieMaster: ParticipantMasterRow; // no cost, no competency
let alpha: ParticipantRow;
let bravo: ParticipantRow;
let charlie: ParticipantRow;

const candidate = (participant: ParticipantRow, master: ParticipantMasterRow): DispatchCandidate => ({ participantId: participant.id, master });

async function createSeu(objectiveLabel: string, lifecycleState: SeuRow["lifecycle_state"], objectiveId?: string): Promise<SeuRow> {
  const { template, profile } = await ensureWebAppTemplateFixture();
  const id = objectiveId ?? (await createObjective({ statement: `dispatch-strategies ${run} ${objectiveLabel}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID })).objective.id;
  const { data, error } = await seusDB.create({
    lifecycleState, authorBadge: ROOT_ACTOR_BADGE, objectiveId: id, templateId: template.id, profileId: profile.id, tenantId: PLATFORM_TENANT_ID, requestedBy: ROOT_ACTOR_ID,
  });
  assert.ok(data && !error, error?.message ?? "the SEU is created");
  return data;
}

async function createMaster(label: string, fields: { cost?: number | null; competency?: ParticipantMasterRow["competency"] }): Promise<ParticipantMasterRow> {
  const { data, error } = await participantsMasterDB.create({ tenantId: PLATFORM_TENANT_ID, type: "Human", displayName: `dispatch-strategies ${run} ${label}`, userId: null, ...fields });
  assert.ok(data && !error, error?.message ?? "the participants_master row is created");
  return data;
}

async function createParticipant(seuId: string, master: ParticipantMasterRow): Promise<ParticipantRow> {
  const { data, error } = await participantsDB.create({ seuId, type: "Human", displayName: master.display_name, participantId: master.id });
  assert.ok(data && !error, error?.message ?? "the participant is created");
  return data;
}

// An active Work Item for the Participant: a Command of the SEU, a Work Item of the Command, assigned to the Participant.
async function loadParticipant(participantId: string, status?: "Completed"): Promise<void> {
  const { data: command, error } = await commandsDB.create({
    seuId: seu.id, entityType: "Deliverable", entityId: randomUUID(), commandType: `zz-load-${run}`, fromState: "Defined", toState: "In Progress",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  });
  assert.ok(command && !error, error?.message ?? "the Command is created");
  const { data: workItem, error: workItemError } = await workItemsDB.create({ commandId: command.id, authorId: systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(workItem && !workItemError, workItemError?.message ?? "the Work Item is created");
  await workItemsDB.assign(workItem.id, participantId, "capability-match");
  if (status) await workItemsDB.updateStatus(workItem.id, status);
}

before(async () => {
  seu = await createSeu("current", await seuBirthState());
  // The index on seus.objective_id allows a second SEU under the same Objective only when it is not in an active state.
  pastSameObjectiveSeu = await createSeu("past-same", "Retired", seu.objective_id);
  pastOtherObjectiveSeu = await createSeu("past-other", "Retired");
  systemParticipantId = await ensureSeuSystemParticipant(seu.id);
  systemActorId = (await getSystemActor(seu.id)).actorId;

  const { data: ebmBirth } = await transitionDefinitionsDB.findBirth("EBM");
  assert.ok(ebmBirth, "the EBM has a birth row");
  const { data: ebm, error: ebmError } = await ebmsDB.create({
    seuId: seu.id, templateId: seu.template_id, profileId: seu.profile_id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    status: ebmBirth.to_state as never, composedPacks: [], compositionReport: {} as never,
    behaviors: { settled: { profileConfiguration: { result: [{ parameter: "participatingOrganisationCodes", value: [organisationCode] }] } } },
  });
  assert.ok(ebm && !ebmError, ebmError?.message ?? "the EBM is created");
  await seusDB.setActiveEbm(seu.id, ebm.id);

  alphaMaster = await createMaster("alpha", { cost: 50, competency: { Organisation: [{ code: organisationCode, proficiency: "Novice" }] } });
  bravoMaster = await createMaster("bravo", { cost: 20, competency: { Skill: [{ code: "zz-skill", proficiency: "Expert" }] } });
  charlieMaster = await createMaster("charlie", {});
  alpha = await createParticipant(seu.id, alphaMaster);
  bravo = await createParticipant(seu.id, bravoMaster);
  charlie = await createParticipant(seu.id, charlieMaster);
  // Past engagements: Bravo worked in the SEU of the same Objective and in the other one, Alpha only in the other one.
  await createParticipant(pastSameObjectiveSeu.id, bravoMaster);
  await createParticipant(pastOtherObjectiveSeu.id, bravoMaster);
  await createParticipant(pastOtherObjectiveSeu.id, alphaMaster);
});

test("loadAvailableCandidates keeps the Available and Idle Participants that have a master row, in the order asked, and skips the rest", async () => {
  const busy = await createParticipant(seu.id, await createMaster("busy", {}));
  const assigned = await applyParticipantHop({ participantId: busy.id, targetState: "Assigned", actorId: systemActorId });
  assert.equal(assigned.ok, true, JSON.stringify(assigned));
  const withoutMaster = (await participantsDB.create({ seuId: seu.id, type: "Human", displayName: `dispatch-strategies ${run} no master`, participantId: null })).data;
  assert.ok(withoutMaster);

  const ids = [alpha.id, busy.id, randomUUID(), withoutMaster.id, bravo.id];
  const available = await loadAvailableCandidates(ids);
  assert.deepEqual(available.map((c) => [c.participantId, c.master.id]), [[alpha.id, alphaMaster.id], [bravo.id, bravoMaster.id]]);

  const idle = await applyParticipantHop({ participantId: busy.id, targetState: "Idle", actorId: systemActorId });
  assert.equal(idle.ok, true, JSON.stringify(idle));
  assert.deepEqual((await loadAvailableCandidates(ids)).map((c) => c.participantId), [alpha.id, busy.id, bravo.id], "an Idle Participant is selectable");
  assert.deepEqual(await loadAvailableCandidates([]), []);
});

test("selectParticipant selects nobody from an empty list", async () => {
  assert.equal(await selectParticipant([], [{ strategy: "capability-match", order: 1 }], seu.id), null);
});

test("selectParticipant uses capability-match when no strategy is declared, orders the strategies by their order and skips a strategy it does not know", async () => {
  const all = [candidate(charlie, charlieMaster), candidate(bravo, bravoMaster), candidate(alpha, alphaMaster)];
  assert.deepEqual(await selectParticipant(all, [], seu.id), { participantId: charlie.id, strategy: "capability-match" });

  const reversed = [{ strategy: "cost-optimisation", order: 2 }, { strategy: "capability-match", order: 1 }];
  assert.deepEqual(await selectParticipant(all, reversed, seu.id), { participantId: charlie.id, strategy: "capability-match" }, "the lowest order is tried first");

  const unknownFirst = [{ strategy: `zz-unknown-${run}`, order: 1 }, { strategy: "cost-optimisation", order: 2 }];
  assert.deepEqual(await selectParticipant(all, unknownFirst, seu.id), { participantId: bravo.id, strategy: "cost-optimisation" });

  const noWinner = [{ strategy: `zz-unknown-${run}`, order: 1 }, { strategy: "specialist-preference", order: 2 }];
  assert.equal(await selectParticipant([candidate(alpha, alphaMaster)], noWinner, seu.id), null, "every strategy declined");
});

test("specialist-preference selects the first candidate that holds an Expert proficiency", async () => {
  const strategies = [{ strategy: "specialist-preference", order: 1 }];
  assert.deepEqual(await selectParticipant([candidate(alpha, alphaMaster), candidate(bravo, bravoMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "specialist-preference" });
  assert.equal(await selectParticipant([candidate(alpha, alphaMaster), candidate(charlie, charlieMaster)], strategies, seu.id), null);
});

test("cost-optimisation selects the lowest cost among the candidates that have one", async () => {
  const strategies = [{ strategy: "cost-optimisation", order: 1 }];
  assert.deepEqual(await selectParticipant([candidate(alpha, alphaMaster), candidate(charlie, charlieMaster), candidate(bravo, bravoMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "cost-optimisation" });
  assert.deepEqual(await selectParticipant([candidate(bravo, bravoMaster), candidate(alpha, alphaMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "cost-optimisation" }, "a dearer later candidate does not replace the cheaper one");
  assert.equal(await selectParticipant([candidate(charlie, charlieMaster)], strategies, seu.id), null, "no candidate has a cost");
});

test("confidence-optimisation selects the candidate with the most engagements, and nobody when none has any", async () => {
  const strategies = [{ strategy: "confidence-optimisation", order: 1 }];
  // Bravo has three Participant rows (this SEU and the two past SEUs), Alpha two, Charlie one.
  assert.deepEqual(await selectParticipant([candidate(alpha, alphaMaster), candidate(bravo, bravoMaster), candidate(charlie, charlieMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "confidence-optimisation" });
  assert.deepEqual(await selectParticipant([candidate(bravo, bravoMaster), candidate(alpha, alphaMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "confidence-optimisation" }, "a later candidate with fewer engagements does not replace it");

  const newcomerMaster = await createMaster("newcomer", {});
  const newcomer: DispatchCandidate = { participantId: randomUUID(), master: newcomerMaster };
  assert.equal(await selectParticipant([newcomer], strategies, seu.id), null, "a candidate with no engagement is not selected");
});

test("load-balancing selects the candidate with the fewest active Work Items, and ignores finished Work Items", async () => {
  const loadBravo = await createParticipant(seu.id, await createMaster("load-bravo", {}));
  const loadAlpha = await createParticipant(seu.id, await createMaster("load-alpha", {}));
  const loadCharlie = await createParticipant(seu.id, await createMaster("load-charlie", {}));
  await loadParticipant(loadBravo.id);
  await loadParticipant(loadBravo.id);
  await loadParticipant(loadAlpha.id);
  await loadParticipant(loadAlpha.id, "Completed");
  const masterOf = async (p: ParticipantRow) => (await participantsMasterDB.findById(p.participant_id!)).data!;
  const candidates = [candidate(loadBravo, await masterOf(loadBravo)), candidate(loadAlpha, await masterOf(loadAlpha)), candidate(loadCharlie, await masterOf(loadCharlie))];

  const strategies = [{ strategy: "load-balancing", order: 1 }];
  assert.deepEqual(await selectParticipant(candidates, strategies, seu.id), { participantId: loadCharlie.id, strategy: "load-balancing" }, "no active Work Item");
  assert.deepEqual(await selectParticipant(candidates.slice(0, 2), strategies, seu.id), { participantId: loadAlpha.id, strategy: "load-balancing" }, "one active Work Item against two");
  assert.deepEqual(await selectParticipant([candidates[1], candidates[0]], strategies, seu.id), { participantId: loadAlpha.id, strategy: "load-balancing" }, "the first of the fewest stays");
});

test("locality-preference selects a candidate that worked in another SEU of the same Objective", async () => {
  const strategies = [{ strategy: "locality-preference", order: 1 }];
  assert.equal(pastSameObjectiveSeu.objective_id, seu.objective_id);
  assert.deepEqual(await selectParticipant([candidate(alpha, alphaMaster), candidate(bravo, bravoMaster), candidate(charlie, charlieMaster)], strategies, seu.id), { participantId: bravo.id, strategy: "locality-preference" });
  assert.equal(await selectParticipant([candidate(alpha, alphaMaster), candidate(charlie, charlieMaster)], strategies, seu.id), null, "Alpha's past SEU has another Objective, and its row in this SEU is skipped");
  assert.equal(await selectParticipant([candidate(bravo, bravoMaster)], strategies, randomUUID()), null, "an SEU that does not exist");
});

test("organisation-preference selects the first candidate that holds an Organisation the EBM names", async () => {
  const strategies = [{ strategy: "organisation-preference", order: 1 }];
  assert.deepEqual(await selectParticipant([candidate(bravo, bravoMaster), candidate(alpha, alphaMaster)], strategies, seu.id), { participantId: alpha.id, strategy: "organisation-preference" });
  assert.equal(await selectParticipant([candidate(bravo, bravoMaster), candidate(charlie, charlieMaster)], strategies, seu.id), null, "no candidate holds the Organisation");
  assert.equal(await selectParticipant([candidate(alpha, alphaMaster)], strategies, pastSameObjectiveSeu.id), null, "an SEU with no EBM names no Organisation");
});
