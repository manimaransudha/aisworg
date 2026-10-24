// CR-133: the Review and Finding birth rows and the governed hops.
//
//   - DEFINITION: the birth rows None -> Planned (Review) and None -> Open (Finding), the five Review hops and the three
//     Finding hops with their events and actions, and no version events.
//   - DRIVEN: creation writes the birth state and publishes the birth event; every hop publishes the row's event and
//     then <Entity>Transitioned with one correlation id; completing a Review also publishes its outcome event; a refused
//     hop writes and publishes nothing; an actor with no participant row in the SEU is refused; converting a Finding
//     moves it to Converted through its row and links the Obligation.
//   - GUARD: only the adapters write the status and no code names a birth event as a literal.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { reviewsDB } from "../src/dblayer/reviewsDB.js";
import { findingsDB } from "../src/dblayer/findingsDB.js";
import { transitionReview } from "../src/routes/seu/core/reviews.js";
import { transitionFinding, convertFindingToObligation } from "../src/routes/seu/core/findings.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { createReviewAsRoot, createFindingAsRoot, commissionFromFormSync, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations, TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

const REVIEW_HOPS = [
  { fromState: "Planned", toState: "Prepared", eventType: "ReviewPrepared", actionCode: null },
  { fromState: "Prepared", toState: "In Progress", eventType: "ReviewStarted", actionCode: null },
  { fromState: "In Progress", toState: "Completed", eventType: "ReviewCompleted", actionCode: "complete-review" },
  { fromState: "Completed", toState: "Accepted", eventType: "ReviewAccepted", actionCode: null },
  { fromState: "Accepted", toState: "Archived", eventType: "ReviewArchived", actionCode: null },
];
const FINDING_HOPS = [
  { fromState: "Open", toState: "Resolved", eventType: "FindingResolved", actionCode: null },
  { fromState: "Open", toState: "Waived", eventType: "FindingWaived", actionCode: null },
  { fromState: "Open", toState: "Converted", eventType: "FindingConverted", actionCode: "convert-finding" },
];

test("DEFINITION: the birth rows, the hop rows, their events and actions", async () => {
  for (const [entity, birthState, birthEvent, hops] of [["Review", "Planned", "ReviewPlanned", REVIEW_HOPS], ["Finding", "Open", "FindingCreated", FINDING_HOPS]] as const) {
    const { data: birth } = await transitionDefinitionsDB.findBirth(entity);
    assert.ok(birth, `the ${entity} birth row exists`);
    assert.equal(birth!.to_state, birthState);
    assert.equal(birth!.verb, "create");
    assert.equal(birth!.trigger, "governed");
    assert.equal(birth!.event_type, birthEvent);
    assert.equal(birth!.version_event, null);
    for (const hop of hops) {
      const { data: def } = await transitionDefinitionsDB.find(entity, hop.fromState, hop.toState);
      assert.ok(def, `no row for ${entity} ${hop.fromState} -> ${hop.toState}`);
      assert.equal(def!.event_type, hop.eventType, `${hop.fromState} -> ${hop.toState}: event_type`);
      assert.equal(def!.version_event, null);
      assert.equal(def!.action_code, hop.actionCode, `${hop.fromState} -> ${hop.toState}: action_code`);
    }
    const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = $1 AND to_state NOT LIKE 'qg-%'", [entity]);
    assert.equal(Number(rows[0].count), hops.length + 1, `unexpected extra/missing ${entity} rows (the hops plus the birth row)`);
  }
});

let seuId: string;
let deliverableId: string;

async function eventsFor(type: string, id: string) {
  const { data } = await eventsDB.findByOriginatingObject(type, id);
  return data ?? [];
}

async function freshReview(label: string) {
  return createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Architecture", name: `${label} ${randomUUID()}` });
}

test("DRIVEN setup: a real SEU and Deliverable to review", async () => {
  const result = await commissionFromFormSync({
    statement: `review-finding-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM deliverables WHERE seu_id = $1 LIMIT 1", [seuId]);
  deliverableId = rows[0].id;
});

test("DRIVEN: creating a Review and a Finding writes the birth state and publishes the birth event; a governed birth row offers no button", async () => {
  const review = await freshReview("birth");
  assert.equal(review.status, "Planned");
  assert.deepEqual((await eventsFor("Review", review.id)).map((e) => e.event_type), ["ReviewPlanned"]);
  assert.deepEqual((await nextActionsFor("Review", "Planned", TESTER_ALL_ID)).map((a) => a.verb), ["prepare"]);

  const finding = await createFindingAsRoot({ reviewId: review.id, severity: "Low", title: `birth ${randomUUID()}` });
  assert.equal(finding.status, "Open");
  assert.deepEqual((await eventsFor("Finding", finding.id)).map((e) => e.event_type), ["FindingCreated"]);
  assert.deepEqual((await nextActionsFor("Finding", "Open", TESTER_ALL_ID)).map((a) => a.verb).sort(), ["convert", "resolve", "waive"]);
});

test("DRIVEN: every Review hop publishes the row's event and then ReviewTransitioned with one correlation id; completion also publishes its outcome event", async () => {
  const review = await freshReview("hops");
  const steps: Array<{ target: string; events: string[]; outcome?: "Passed" | "Failed" }> = [
    { target: "Prepared", events: ["ReviewPrepared"] },
    { target: "In Progress", events: ["ReviewStarted"] },
    { target: "Completed", events: ["ReviewCompleted", "ReviewPassed"], outcome: "Passed" },
    { target: "Accepted", events: ["ReviewAccepted"] },
    { target: "Archived", events: ["ReviewArchived"] },
  ];
  for (const step of steps) {
    const before = (await eventsFor("Review", review.id)).length;
    const result = await transitionReview({ reviewId: review.id, targetState: step.target, actorId: TESTER_ALL_ID, outcome: step.outcome });
    assert.equal(result.ok, true, !result.ok ? `-> ${step.target} failed: ${JSON.stringify(result)}` : "assertion failed");
    const added = (await eventsFor("Review", review.id)).slice(before);
    assert.deepEqual(added.map((e) => e.event_type), [...step.events, "ReviewTransitioned"], `-> ${step.target}`);
    assert.equal(new Set(added.map((e) => e.correlation_id)).size, 1, "one correlation id per hop");
  }
  assert.equal((await reviewsDB.findById(review.id)).data!.outcome, "Passed");
});

test("DRIVEN: a failed Review publishes ReviewFailed and a deferred one ReviewDeferred; the outcome is required and immutable", async () => {
  for (const [outcome, event] of [["Failed", "ReviewFailed"], ["Deferred", "ReviewDeferred"]] as const) {
    const review = await freshReview(outcome);
    for (const target of ["Prepared", "In Progress"]) await transitionReview({ reviewId: review.id, targetState: target, actorId: TESTER_ALL_ID });
    const noOutcome = await transitionReview({ reviewId: review.id, targetState: "Completed", actorId: TESTER_ALL_ID });
    assert.equal(noOutcome.ok, false);
    if (!noOutcome.ok) assert.equal(noOutcome.reason, "outcome_required");
    assert.equal((await reviewsDB.findById(review.id)).data!.status, "In Progress");

    const done = await transitionReview({ reviewId: review.id, targetState: "Completed", actorId: TESTER_ALL_ID, outcome });
    assert.equal(done.ok, true, !done.ok ? JSON.stringify(done) : "assertion failed");
    assert.ok((await eventsFor("Review", review.id)).some((e) => e.event_type === event), `missing ${event}`);
  }
});

test("DRIVEN: a Finding hop publishes the row's event and then FindingTransitioned with one correlation id", async () => {
  const review = await freshReview("finding hops");
  for (const [target, event] of [["Resolved", "FindingResolved"], ["Waived", "FindingWaived"]] as const) {
    const finding = await createFindingAsRoot({ reviewId: review.id, severity: "Low", title: `${target} ${randomUUID()}` });
    const before = (await eventsFor("Finding", finding.id)).length;
    const result = await transitionFinding({ findingId: finding.id, targetState: target, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : "assertion failed");
    const added = (await eventsFor("Finding", finding.id)).slice(before);
    assert.deepEqual(added.map((e) => e.event_type), [event, "FindingTransitioned"]);
    assert.equal(added[0].correlation_id, added[1].correlation_id);
  }
});

test("DRIVEN: converting a Finding moves it to Converted through its row, links the Obligation and publishes FindingConverted then FindingTransitioned", async () => {
  const review = await freshReview("convert");
  const finding = await createFindingAsRoot({ reviewId: review.id, severity: "Medium", title: `convert ${randomUUID()}` });
  const result = await convertFindingToObligation({ findingId: finding.id, category: "Engineering", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : "assertion failed");
  const { data: after } = await findingsDB.findById(finding.id);
  assert.equal(after!.status, "Converted");
  if (result.ok) assert.equal(after!.obligation_id, result.obligationId);
  const types = (await eventsFor("Finding", finding.id)).map((e) => e.event_type);
  assert.deepEqual(types, ["FindingCreated", "FindingConverted", "FindingTransitioned"]);

  const resolved = await convertFindingToObligation({ findingId: finding.id, actorId: TESTER_ALL_ID });
  assert.equal(resolved.ok, false);
  if (!resolved.ok) assert.equal(resolved.reason, "already_converted");
});

test("DRIVEN: a refused hop writes and publishes nothing; an actor with no participant row in the SEU is refused", async () => {
  const review = await freshReview("refused");
  const before = (await eventsFor("Review", review.id)).length;
  const skip = await transitionReview({ reviewId: review.id, targetState: "Accepted", actorId: TESTER_ALL_ID });
  assert.equal(skip.ok, false);
  if (!skip.ok) assert.equal(skip.reason, "no_transition_definition");
  assert.equal((await eventsFor("Review", review.id)).length, before);

  await assert.rejects(
    transitionReview({ reviewId: review.id, targetState: "Prepared", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  assert.equal((await reviewsDB.findById(review.id)).data!.status, "Planned");

  const finding = await createFindingAsRoot({ reviewId: review.id, severity: "Low", title: `refused ${randomUUID()}` });
  await assert.rejects(
    transitionFinding({ findingId: finding.id, targetState: "Resolved", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  assert.equal((await findingsDB.findById(finding.id)).data!.status, "Open");
});

test("GUARD: only the adapters write the status and no code names a birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const writers = files.filter((f) => /(reviewsDB|findingsDB)\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(writers.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const literals = files.filter((f) => /["']ReviewPlanned["']|["']FindingCreated["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(literals, []);
});
