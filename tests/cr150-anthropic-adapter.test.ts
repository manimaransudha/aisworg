// CR-150 step 8: the Anthropic AI adapter, run against the real dev database with the mock provider client (no network).
// A Participant is dispatched a real Work Item. The adapter then plays a scripted run: the tools provide Evidence and report status as the Participant,
// and a run that fails raises an Attention Item for the Participant. Dispatch and the Participant's adapter column are covered by participant-adapters.test.ts.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { anthropicAiAdapter, runAnthropicAssignment } from "../src/adapters/anthropicAiAdapter.js";
import { clearAiProviderClient, registerAiProviderClient } from "../src/adapters/aiProviderClient.js";
import { createMockAiProviderClient } from "../src/adapters/mockAiProviderClient.js";
import { PLATFORM_TOOLS } from "../src/adapters/aiTools.js";
import { AI_SKILL_BOOTSTRAP_TYPE, AI_SKILL_JOB_ANTHROPIC_TYPE, AI_SKILL_PROTOCOL_TYPE, ANTHROPIC_ADAPTER_KEY } from "../src/dblayer/constants.js";
import type { AssignmentOut } from "../src/adapters/participantAdapter.js";
import {
  ensureWebAppTemplateFixture, commissionFromFormSync, ensureEligibleParticipant, resolveDispatchRejectionObligations, waitForDispatchedWorkItem, waitUntilAsync,
  fulfilCapabilityAsRoot as fulfilCapability, emptyParticipantPool, getEmptyPoolTenantId, deactivateParticipants, deliverableByCode, grantBadge,
  ROOT_ACTOR_ID, TESTER_ALL_ID, PLATFORM_TENANT_ID,
} from "./testFixtures.js";

const SKILLS = { protocol: "PROTOCOL TEXT", bootstrap: "BOOTSTRAP TEXT", job: "ANTHROPIC JOB TEXT" };

test("the Anthropic adapter acts as the dispatched Participant: its tools provide Evidence and report status, and a failed run raises an Attention Item", async (t) => {
  t.after(await emptyParticipantPool(await getEmptyPoolTenantId()));
  const run = randomUUID().slice(0, 8);
  await ensureWebAppTemplateFixture();
  let participantMasterId!: string;
  try {
    const result = await commissionFromFormSync(
      { statement: `cr150-adapter-${run}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID, tenantId: PLATFORM_TENANT_ID },
      async (seuId) => {
        const detail = await getSeuDetailView(seuId);
        const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
        assert.ok(capability);
        participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
        // The badges the tools resolve for this Participant. The Participant row is test-owned and deactivated in finally.
        await grantBadge(participantMasterId, "evidence_collect");
        await grantBadge(participantMasterId, "attentionitem_raise");
        await fulfilCapability({ seuId, capabilityId: capability!.capabilityId, participantMasterId });
      }
    );
    assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
    if (!result.ok) throw new Error("unreachable");
    const seuId = result.seu.id;
    const deliverable = await deliverableByCode(await getSeuDetailView(seuId), "requirements-analysis-model");
    assert.ok(deliverable);
    await resolveDispatchRejectionObligations(seuId);
    await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: deliverable!.id, targetState: "In Progress", actorId: TESTER_ALL_ID });
    const { workItem } = await waitForDispatchedWorkItem(deliverable!.id, "Defined", "In Progress");
    assert.ok(workItem.participant_id, "dispatch assigned the Work Item to the Participant");

    const assignment: AssignmentOut = {
      workItemId: workItem.id, participantId: workItem.participant_id!, seuId, tenant: { id: PLATFORM_TENANT_ID, code: null }, vcsBinding: {},
      deliverable: { id: deliverable!.id, name: deliverable!.name }, transition: { fromState: "Defined", toState: "In Progress" }, targetCompletionAt: null, inputReferences: [],
      executionContext: workItem.execution_context,
    };

    // A scripted run: the Participant provides Evidence and then reports Completed with it.
    const client = createMockAiProviderClient([
      { tool: "provide_evidence", input: { category: "Analytical Evidence", title: `CR-150 AI evidence ${run}`, description: "Produced by the scripted run." } },
      { tool: "report_status", input: (earlier) => ({ status: "completed", evidence_ids: [/id: (\S+)/.exec(earlier[0]!.content)![1]] }) },
    ]);
    await runAnthropicAssignment(assignment, SKILLS, client);

    const [evidenceResult, statusResult] = client.runs[0]!.results;
    assert.equal(evidenceResult!.ok, true, evidenceResult!.content);
    assert.equal(statusResult!.ok, true, statusResult!.content);
    const evidence = (await evidenceDB.findByRelatedObject("Deliverable", deliverable!.id)).data ?? [];
    assert.ok(evidence.some((e) => e.title === `CR-150 AI evidence ${run}`), "the Evidence the AI provided is recorded on the Deliverable");

    const { system, prompt, tools } = { ...client.runs[0]!.request };
    for (const text of Object.values(SKILLS)) assert.ok(system.includes(text), `the system prompt holds ${text}`);
    assert.ok(prompt.includes(deliverable!.name), "the prompt names the Deliverable");
    assert.deepEqual(tools.map((tool) => tool.name), PLATFORM_TOOLS.map((tool) => tool.name));

    // A rule failure reaches the model as text. The Deliverable is Completed above, so a second run cannot report again without an outstanding Work Item.
    const rejecting = createMockAiProviderClient([{ tool: "report_status", input: { status: "blocked" } }]);
    await runAnthropicAssignment(assignment, SKILLS, rejecting);
    assert.equal(rejecting.runs[0]!.results[0]!.ok, false);

    // A failed run is raised as an Attention Item for the Participant. The context carries the three skills here, so the adapter accepts the assignment.
    const withSkills: AssignmentOut = {
      ...assignment,
      executionContext: {
        ...workItem.execution_context!,
        engineeringCapital: [
          ...(workItem.execution_context?.engineeringCapital ?? []).filter((e) => ![AI_SKILL_PROTOCOL_TYPE, AI_SKILL_BOOTSTRAP_TYPE, AI_SKILL_JOB_ANTHROPIC_TYPE].includes(e.type ?? "")),
          { packCode: "test", type: AI_SKILL_PROTOCOL_TYPE, url: SKILLS.protocol }, { packCode: "test", type: AI_SKILL_BOOTSTRAP_TYPE, url: SKILLS.bootstrap }, { packCode: "test", type: AI_SKILL_JOB_ANTHROPIC_TYPE, url: SKILLS.job },
        ],
      },
    };
    registerAiProviderClient(ANTHROPIC_ADAPTER_KEY, createMockAiProviderClient([], { failWith: new Error("the provider is unreachable") }));
    try {
      const delivered = await anthropicAiAdapter.deliverAssignment(withSkills, { mode: ANTHROPIC_ADAPTER_KEY, adapterEndpoint: null, adapterAuthRef: null });
      assert.equal(delivered.delivered, true);
      await waitUntilAsync(async () => ((await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverable!.id)).data ?? []).some((a) => a.title === "The AI run failed"));
      const raised = ((await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverable!.id)).data ?? []).find((a) => a.title === "The AI run failed");
      assert.ok(raised, "a failed run raises an Attention Item on the Deliverable");
      assert.match(raised!.description ?? "", /provider is unreachable/);
    } finally {
      clearAiProviderClient(ANTHROPIC_ADAPTER_KEY);
    }

    // A Work Item with no job skill, or an adapter with no client, is refused at delivery and not in a run nobody awaits.
    await assert.rejects(() => anthropicAiAdapter.deliverAssignment(assignment, { mode: ANTHROPIC_ADAPTER_KEY, adapterEndpoint: null, adapterAuthRef: null }), /holds no/);
    await assert.rejects(() => anthropicAiAdapter.deliverAssignment(withSkills, { mode: ANTHROPIC_ADAPTER_KEY, adapterEndpoint: null, adapterAuthRef: null }), /no AI provider client/);
  } finally {
    clearAiProviderClient(ANTHROPIC_ADAPTER_KEY);
    if (participantMasterId) await deactivateParticipants([participantMasterId]);
  }
});
