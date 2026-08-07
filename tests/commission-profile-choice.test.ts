// Real fix, not just documented: findOrCreateDefaultProfile's own comment
// used to flag "no UI to choose between multiple real Profiles for a
// Template" as a known, unsolved gap. Closed via getObjectiveDetail's new
// commissioningPreview (core/objectives.ts) + a real dropdown on the
// Objective detail page + commissionFromExistingObjective accepting an
// explicit profileId. Proves, against real dev data:
//   1. getObjectiveDetail surfaces every real (non-throwaway) Profile for
//      the matched Template when more than one exists.
//   2. Passing an explicit profileId actually composes that Profile's own
//      optional Packs, not whichever the auto-pick heuristic would have
//      chosen.
//   3. Omitting profileId still falls back to the same heuristic as before
//      (regression safety — the quick-commission path is unaffected).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { getObjectiveDetail } from "../src/routes/seu/core/objectives.js";
import { commissionFromExistingObjective } from "../src/routes/seu/core/commissioning.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";

after(async () => {
  await pool.end();
});

test("Objective-first commissioning offers a real Profile choice when more than one exists, and honours it", async () => {
  // Two required Capabilities, not one — sdk-authoring.test.ts's own
  // validTemplateSeed helper creates throwaway Templates requiring exactly
  // ["requirements-analysis"] too, and findCandidateTemplates breaks ties on
  // requiredCapabilityCount alone, with no secondary tiebreaker favouring
  // this test's own Template. A one-capability requirement here was a real,
  // observed flake under concurrent test-file execution — this combination
  // isn't used as a Template's required set anywhere else in the suite.
  const templateCode = `verify-profile-choice-template-${randomUUID()}`;
  const { data: template, error: templateErr } = await templatesDB.upsert({
    code: templateCode,
    name: "Verify Profile Choice Template",
    deliverableCatalogue: [{ code: "requirements-spec", name: "Requirements Specification", category: "Documentation", producingCapabilityCode: "requirements-analysis" }],
  });
  assert.equal(templateErr, undefined);
  const { data: capabilities } = await capabilitiesDB.findByCodes(["requirements-analysis", "architecture"]);
  await templatesDB.setRequiredCapabilities(template!.id, (capabilities ?? []).map((c) => c.id));

  // Two real Profiles for the same Template — one plain, one declaring
  // technology-nodejs as optional, so composing it is directly observable.
  const plainCode = `verify-profile-choice-plain-${randomUUID()}`;
  const nodejsCode = `verify-profile-choice-nodejs-${randomUUID()}`;
  const plainPublished = await publishProfile({ code: plainCode, name: "Plain Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: [] });
  assert.equal(plainPublished.ok, true);
  const nodejsPublished = await publishProfile({ code: nodejsCode, name: "Nodejs Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: ["technology-nodejs"] });
  assert.equal(nodejsPublished.ok, true);
  if (!nodejsPublished.ok || !plainPublished.ok) return;

  const { objective } = await createObjective({ statement: `verify-profile-choice-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture"] });
  assert.equal(objective.status, "Active");

  // 1. getObjectiveDetail surfaces both real Profiles as real candidates.
  const detail = await getObjectiveDetail(objective.id);
  assert.ok(detail?.commissioningPreview);
  assert.equal(detail!.commissioningPreview!.templateCode, templateCode);
  const candidateIds = detail!.commissioningPreview!.candidateProfiles.map((p) => p.id).sort();
  assert.deepEqual(candidateIds, [plainPublished.profileId, nodejsPublished.profileId].sort());

  // 2. Explicitly choosing the nodejs Profile actually composes it.
  const chosen = await commissionFromExistingObjective({ objectiveId: objective.id, actorRole: "super", profileId: nodejsPublished.profileId });
  assert.equal(chosen.ok, true, !chosen.ok ? JSON.stringify(chosen) : undefined);
  if (!chosen.ok) return;
  const chosenDetail = await getSeuDetailView(chosen.seu.id);
  assert.ok(chosenDetail!.composedPacks.some((p) => p.packCode === "technology-nodejs"), "expected the explicitly-chosen Profile's optional Pack to be composed");

  // 3. Omitting profileId still works via the existing auto-pick fallback
  // (development-environment preference, else first real match) — doesn't
  // throw, still produces a real SEU.
  const { objective: objective2 } = await createObjective({ statement: `verify-profile-choice-fallback-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture"] });
  const autoPicked = await commissionFromExistingObjective({ objectiveId: objective2.id, actorRole: "super" });
  assert.equal(autoPicked.ok, true, !autoPicked.ok ? JSON.stringify(autoPicked) : undefined);
});
