# CR-107 — Execution Engine must own deciding when a Deliverable is eligible to start (Book 3 Ch.31/Ch.33), so a blocking Obligation actually gates engineering work

**Raised:** 2026-09-15 · **Origin:** split out of CR-106 while verifying its Obligation-raising mechanism live — an SEU blocked at its own commence-work hop (a real, open Obligation on record) still let its head-of-chain Deliverable move `Defined -> In Progress`, because nothing in the codebase connects the two. **Status:** 🟡 Raised — findings recorded, design not started.

## ✅ Built — 2026-09-16

All 11 design points below are implemented, not just designed. Summary:

- `SEU|Activated|Operational` → `trigger: "governed"`; the Execution Engine (`attemptSeuCommenceWork`, `commissioning.ts` + `executionEngineKickoff.ts`) is the sole master of that hop, off `SEUActivated` and `ObligationTransitioned` — replaces `retrySeuCommenceWork` and `obligationResolvedHandler` entirely.
- `finalizeCommissioning` reordered: Create Engineering Assets now runs before `Activated`, and the function ends at the `SEUActivated` publish — the "no code after event publish" violation is gone.
- The original bug itself: `transitionDeliverable`'s governance chain gained the SEU-blocked and per-Deliverable-Obligation checks (item 6) — a head-of-chain Deliverable can no longer start while its owning SEU sits blocked.
- Item 7's full physical relocation: all of `transitionDeliverable`'s governance (dependency, Quality Gate, Policy, Authority, plus the two new checks) now lives in `domain/engine/executionEngine.ts`'s `evaluateDeliverableTransition`; `transitionDeliverable` is a thin wrapper.
- Item 10's `transitionEngine.evaluate` narrowing is done for both SEU and Deliverable — Authority is checked directly (`badgeAuthorityEngine`) in both places now, not through the bundled call.
- Real dev-DB test coverage added: `tests/cr107-execution-engine-deliverable-kickoff.test.ts` (block + resolve-and-unblock).
- Follow-on manual-testing/UI work done in the same pass: SEU detail page's Events tab now shows every event for the SEU (not a curated subset), a real Attention Items tab was added, Obligation rows open a user-friendly modal instead of raw JSON, and every tab's Transition control now uses a real button for the single-next-state case (was a fake-looking dropdown) — same fix as the Deliverables tab already had, propagated everywhere. A minimal `cr104-demo-minimal` Template/Ontology-category and a background-check-cleared Participant subset were added so the whole CR-107 scenario is manually exercisable in the browser via the CR-104 demo profile.

Full detail in "Proposed fix" below — every item there is now a "what was built" record, not a plan.

## Observation (found live, in code)

Commissioning an SEU against a Policy that blocks `SEU|Activated|Operational` (CR-106's own mechanism) correctly raises a real Obligation and leaves the SEU at `Activated`. But separately, the SEU's own Requirements Analysis Model (head-of-chain Deliverable, no incoming `dependency_definitions` row) still reached `In Progress` — the block had no effect on it at all.

Traced why:

- `transitionDeliverable` (`routes/seu/core/deliverables.ts`) checks dependency readiness, Quality Gates, Policy, and Authority for *that Deliverable's own* hop — it never reads the owning SEU's `lifecycle_state`, and never checks for an open blocking Obligation on the SEU.
- Nothing subscribes to `ObligationCreated` to prevent anything.
- Grepped every real call site of `transitionDeliverable`: only a web route (`web/seus.ts`) and an API route (`api/deliverables.ts`) call it — both directly, human/API-triggered. Nothing event-driven decides a Deliverable is now eligible and fires it.
- `executionEngine.ts`/`dispatchEngine.ts` (Ch.31/Ch.33's "minimal instance") never run *before* a Deliverable transition to decide whether it should happen — `executionEngine.ts`'s own header says governance is "evaluated by the caller before this runs"; both engines only react *after* a transition has already been applied, generating the resulting Command/Work Item/dispatch.

## Grounding: what the specification actually assigns this to

Checked Chapter 31 (Execution Engine) and Chapter 33 (Dispatch Engine) directly before writing this, per the owner's standing correction on CR-106 (a new mechanism must be checked against the spec first, not invented in code and discovered afterward).

**Chapter 31 §4 (Definition):** the Execution Engine "determin[es] the next valid engineering actions based upon the current engineering state" — observes Events, evaluates readiness, generates Commands. It "shall not execute engineering activities directly."

**Chapter 31 §7 (Execution Inputs)** — the deciding evidence for this CR — explicitly lists:

> Deliverable state; Dependency Graph; Transition Definitions; **active Policies; active Obligations**; Review outcomes; Quality Gates; Engineering Behavior Model; incoming Events.

**Chapter 31 §9 (Execution Cycle):** `Observe Events → Evaluate Engineering State → Identify Eligible Transitions → Evaluate Governance → Request Capabilities → Generate Commands → Wait for Events` — reactive and continuous, never a one-off manual trigger. EE-006: "Execution shall never bypass governance."

**Chapter 33 §1 (Dispatch Engine) explicitly disclaims this responsibility:** *"The Dispatch Engine does not determine **what** should be executed. That responsibility belongs to the Execution Engine."* Dispatch's own Inputs (§7) also name "active Obligations," but for a narrower, later question — given a Command already exists, *who* (which eligible Participant) executes the resulting Work Item now. That is downstream of the kickoff decision, not the kickoff decision itself.

**Conclusion, settled before design starts:** the Execution Engine owns "should this Deliverable start now," including evaluating active Obligations as a real gate — not the Dispatch Engine (an earlier working hypothesis, corrected against the spec text above), and not a direct, ungated `transitionDeliverable` call from a human/API caller.

## The gap against current code

Today's `executionEngine.ts`/`dispatchEngine.ts` are real but scoped narrower than Ch.31/Ch.33 describe: they are downstream Command/Work-Item/Dispatch generators invoked *after* a governed transition already succeeded, not the reactive component that decides a transition should be attempted in the first place. Specifically:

- No component observes SEU/Deliverable state and decides "this head-of-chain Deliverable's dependencies are satisfied, generate a Command for it."
- Nowhere in the codebase is "active Obligations" evaluated as an Execution Input, despite Ch.31 §7 naming it explicitly.
- The manual `transitionDeliverable` call sites (web/API) bypass all of this — they are today's only mechanism for a Deliverable to ever start, gated on that Deliverable's own dependency/governance state alone, never the owning SEU's.

## Not yet designed

This CR records the finding and the spec grounding only. Still open:

- Whether the fix is (a) adding an SEU-lifecycle-state/open-Obligation check directly inside `transitionDeliverable` (minimal, but doesn't build the reactive "Execution Engine decides eligibility" component Ch.31 actually describes), or (b) building the real event-driven Execution Engine cycle (observe events, evaluate Dependency Graph + Governance including active Obligations, generate Commands) that Ch.31 specifies, with the manual `transitionDeliverable` call sites re-scoped to whatever role remains for them (e.g. authority override, or removed once the Engine owns kickoff) — a materially larger build.
- How "active Obligations" is evaluated concretely: scoped to the SEU as a whole (any open blocking Obligation on the SEU stops all its Deliverables) or per-Deliverable (only an Obligation whose `blocked_from_state`/`blocked_to_state` names that specific entity)? CR-106's own Obligations are SEU-scoped (`related_object_type: "SEU"`), which doesn't obviously narrow to "which Deliverable does this block."
- Whether this closes CR-104's own still-open "first kickoff" design note (`SEU_operationalise`'s own transition-application code should have the side effect of transitioning every head-of-chain Deliverable `Defined -> In Progress`) or supersedes it with the more general Execution Engine mechanism instead.

## Related

- CR-106 — the Obligation-raising mechanism this CR's own gap was found verifying; CR-106's scope stayed at "raise the Obligation," this CR is "make it actually gate engineering work."
- CR-104 — `design/change-requests/CR-104-seu-transition-to-operational.md`, its own "Current behavior" section already described head-of-chain kickoff as a manual click, and its "Summary of fixes" item 6 (giving `SEU_operationalise` the side effect of auto-starting head-of-chain Deliverables) was never actually built — confirmed by this CR's own grep of `commissioning.ts`.
- Chapter 31 – Execution Engine, Chapter 33 – Dispatch Engine (`design/foundations/03_Book 3 (Refined)/05_Part 5/`).

## Current behavior

SEU|Activated|Operational transition has a blocking policy - what happens?

The Commissioned -> Activated transition_definitions row carries event_type: "SEUActivated". It's published from finalizeCommissioning's PRE_ASSETS_STEPS loop (routes/seu/core/commissioning.ts:374-385):


for (const [from, to] of PRE_ASSETS_STEPS) {
  const step = await transitionEngine.evaluate({ entityType: "SEU", fromState: from, toState: to, ... });
  await seusDB.updateLifecycleState(seu.id, to);
  previousStepEvent = await eventBus.publish({
    eventType: step.eventType ?? `SEU${to}`, ...
  });
}
So concretely: SEUActivated is published by finalizeCommissioning itself, mid-cascade, as the SEU walks Pending → Configured → Commissioned → Activated in a straight-line loop (not via a subscriber) — the event's name comes from that transition's own transition_definitions.event_type column (migration-seeded), not a hardcoded string.
 
n finalizeCommissioning (commissioning.ts:472-486):


const commenceWorkPolicy = await policyEngine.evaluate({ entityType: "SEU", ..., fromState: "Activated", toState: "Operational", ... });
if (commenceWorkPolicy.outcome === "Blocked") {
  return { ok: false, stage: "transition_Activated_to_Operational", reason: ..., blockedByPolicyCode: commenceWorkPolicy.policyCode };
}
The function returns before ever calling seusDB.updateLifecycleState toward Operational — the SEU's lifecycle_state was already set to Activated earlier, in the PRE_ASSETS_STEPS loop, and nothing here changes it further. ebmActivatedHandler (the caller) then routes that ok: false + blockedByPolicyCode result to blockCommissioning, which raises the CR-106 Obligation and deliberately does not touch seusDB at all — its own comment says this explicitly: "never touches seus.lifecycle_state — the SEU stays exactly where finalizeCommissioning left it (Activated)."

So the SEU sits at Activated indefinitely — not Failed, not Operational — until obligationResolvedHandler sees the Obligation resolved and calls retrySeuCommenceWork, which re-runs the same Activated -> Operational check.

This is exactly the state CR-107 found: the SEU is visibly stuck at Activated with an open Obligation, but nothing stops its own head-of-chain Deliverables (which check only their own dependency_definitions readiness, never the owning SEU's lifecycle_state) from proceeding to In Progress anyway.


## Proposed fix

1. **`SEU|Activated|Operational` transition_definitions row → `trigger: "governed"`.** No functional risk: no `transitionSeu` function exists, and no view renders an "Operational" button off `seuPossibleNextStates` — this row has never actually been manually clickable, so this only makes the schema honest.

2. **The Execution Engine is the sole master of this hop.** It subscribes to the events that can change eligibility (`SEUActivated` to attempt it the first time, `ObligationTransitioned` to retry after a block resolves) and evaluates governance itself (Transition Engine + Policy Engine) before issuing a Command — matching Ch.31 §9's cycle, not a bespoke retry function.
   - `obligationResolvedHandler` (`domain/engine/obligationResolved.ts`) loses its SEU-specific branch — it stops calling `retrySeuCommenceWork` directly. Whatever resolves an Obligation just publishes `ObligationTransitioned` (already does, via `transitionObligation`); no new event type is needed. The Execution Engine becomes the subscriber to `ObligationTransitioned` instead, and does its own evaluation + Command issuance.
   - **`retrySeuCommenceWork` (`commissioning.ts:527-576`) is removed outright**, not merged or kept as a fallback — it was a second, parallel implementation of the exact same Transition-Engine → Policy-Engine → publish logic already inline in `finalizeCommissioning` (462-486, 501-513). Both are replaced by one Engine-owned "attempt SEU `Activated -> Operational`" function, called from every relevant event. No second copy of this logic survives anywhere.

3. **The "no code after event publish" violation in `finalizeCommissioning` is deliberate-until-now and now needs to go.** Today, `SEUActivated` is published inside the `PRE_ASSETS_STEPS` loop (line 381-384), but Create Engineering Assets (387-456) and the `Activated -> Operational` check (462-486, 501-513) all run synchronously afterward, in the same function. New order for `finalizeCommissioning`:
   1. `Pending -> Configured` (publish `SEUConfigured`)
   2. `Configured -> Commissioned` (publish `SEUCommissioned`)
   3. Create Engineering Assets (materialize the EBM's Deliverable Catalogue/Capabilities into real rows) — runs here, before `Activated`
   4. `Commissioned -> Activated` (publish `SEUActivated`) — **the function's last statement; `finalizeCommissioning` returns immediately**

   The Engine's `SEUActivated` handler then owns the `Activated -> Operational` attempt from there. Create Engineering Assets shifts one step earlier than today's placement ("right before Ready for Execution," i.e. right before `Activated -> Operational`) to right before `Activated` itself — its body (`commissioning.ts:387-456`) only reads `seu.id`/`ebm`/`templates`/`tenantId`, nothing keyed off `lifecycle_state`, so the earlier placement doesn't change its own logic.

4. **Attention Items stay out of scope for now** — manual, not yet designed as a construct on this platform. Not part of the Engine's inputs for this CR; the interaction between a manual click and an Engine refusal (item 8) is deliberately deferred until Attention Items exist.

5. **Statelessness (EE-005) vs. "which events to watch."** `eventBus`'s subscription table (`event_subscriptions`) routes strictly by `event_type` — no predicate/wildcard registration exists (confirmed: `subscribersByEventType` is keyed only by event type). So "only act for SEUs currently in `Activated` state" cannot be a subscription-time filter; it has to be a **self-filter inside the handler body**, re-checking the SEU's live `lifecycle_state` on every event it receives — the same pattern `obligationResolvedHandler` already uses (checks `blocked_from_state`/`blocked_to_state` per event). This keeps the Engine stateless: no maintained watch-list, just a live DB check per incoming event.

6. **Deliverable-level gating (the original CR-107 bug) — same mechanism, not a new one.** `transitionDeliverable` already runs a governance chain per Deliverable: dependency readiness → Quality Gate → Policy → Authority. The bug is a missing fifth check: is the owning SEU itself currently blocked. That check is the same Engine, asked one more question — load the SEU fresh by `seu_id`, check `lifecycle_state`/open Obligations — before letting the Deliverable's transition proceed. No new engine, no new event type.

7. **Scope decision, confirmed: the Engine owns all transition decisions; `transitionDeliverable` becomes a thin from/to declaration.** Today's actual architecture is the opposite — `executionEngine.ts`'s own header comment states explicitly: "Governance (dependencyEngine + transitionEngine) is evaluated by the caller before this runs." `transitionDeliverable` currently runs all governance itself and only calls `executionEngine.execute` at the end, purely for Command/Work-Item/Dispatch generation, after governance already passed (Chapter 31 §19.1's own recorded gap).
   - **Confirmed scope: all 4 existing checks (dependency readiness, Quality Gate, Policy, Authority) move into the Engine, alongside the new SEU-blocked check (item 6) — not just the new one added on top.** `transitionDeliverable` shrinks to supplying `entityType`/`fromState`/`toState`/context and asking the Engine "should this happen"; the Engine runs every check and either issues the Command or refuses/defers.
   - **Built.** `domain/engine/executionEngine.ts` gained `evaluateDeliverableTransition` — dependency readiness, the SEU-blocked + per-Deliverable-Obligation checks (item 6), Quality Gate, Policy, and Authority (still via `transitionEngine.evaluate`, see item 10's own note below), plus every side effect item 11 lists, all physically relocated there. `transitionDeliverable` (`deliverables.ts`) is now genuinely thin: load the Deliverable, call `evaluateDeliverableTransition`, resolve the acting badge (attribution, not governance), call `execute()`. No circular import: confirmed `telemetry.ts`/`attentionItems.ts`/`obligations.ts` (the core files `executionEngine.ts` now calls into) don't import `deliverables.ts` or `executionEngine.ts` themselves. The earlier hesitation to do this (Ch.30's "engine layer never calls back into core") was a misapplication — that boundary protects the *pure* decision engines (policyEngine, qualityGateEngine, transitionEngine, dependencyDefinitionEngine) so they stay reusable and side-effect-free; `executionEngine.ts` was never one of those — it already had side effects (Command/Work-Item/event writes) before this CR, the same orchestrator category as `ebmActivated.ts`/`executionEngineKickoff.ts`, which already call into core.

8. **Simple rule, final: within an SEU, the Execution Engine is the governing authority on every transition, irrespective of `trigger`.** `trigger` only ever decides whether a human must click to *initiate* an attempt (`manual`) or the Engine initiates it itself off an event (`governed`) — it never decides *who evaluates governance*. That's always the Engine, for any SEU-scoped entity (item 9's second bucket), full stop. No hop needs its `trigger` value changed for the Engine's checks to apply. **This will be refined further once Attention Items are designed** — the mechanics of a manual click reaching the Engine, and of a human being notified when the Engine refuses one, stay open until then.

9. **Scope boundary: SEU-scoped vs definition-only entity types.** Full `TransitionEntityType` union checked (`seuTypes.ts:1008`). Two buckets:
   - **Definition-only, no `seu_id`, stays on the existing `transitionEngine`-called-directly pattern permanently, never Engine territory:** Objective, Pack, Template, Profile, Service (Definition), Policy (Definition — CR-089's own comment confirms entity-direct authoring identical to Template/Profile/Service), Ontology, **DeliverableDefinition** (confirmed `deliverableDefinitions.ts:150`: `seuId: null, // platform catalog entity, not SEU-scoped`).
   - **`Deliverable` and `DeliverableDefinition` are the same noun, two different lifecycles.** A Deliverable *within* a commissioned SEU (the real runtime instance, materialized from the catalog at commissioning) is Engine-owned; a Deliverable *outside* an SEU (`DeliverableDefinition`, authored on a Template's own catalogue, no owning SEU) is a manual hop on the permanent definition-only side, same as Objective/Pack/Template.
   - **SEU-scoped, carries `seu_id`, "engineering execution within a commissioned SEU" (Ch.31 §1) — Engine territory over time:** SEU, Deliverable, Obligation, Evidence, Knowledge, Decision, KnowledgeScope, AttentionItem, ExternalInteraction, Participant, Review, Finding, EBM. This CR itself only touches SEU and Deliverable; the rest of this list isn't in this build's scope, just settled as to where they'll land later.

10. **Correction: `transitionEngine.evaluate` cannot be reused as-is for the Engine's governance step — it already bundles governance decisions, and doesn't do the mechanical apply.** Checked `transitionEngine.ts:58-197` directly. It is not a "move state + publish event" function: it runs Authority (`badgeAuthorityEngine`), the submit-gate check (`triggerEngine`), Policy (the definition row's own `required_policy_ids`), and Quality Gate (`required_quality_gate_ids`) — four governance decisions bundled into one call — and only returns `{allowed, eventType, versionEvent, createsObligation, authorityBadge}`. It never touches `lifecycle_state`/`status` and never publishes the transition's own event; every caller today (`commissioning.ts`, `deliverables.ts`, ...) does `XDB.updateLifecycleState(...)` + `eventBus.publish(...)` itself, separately, after `evaluate()` returns allowed. That's backwards from what "transition definition inside the Execution Engine" should be.
    - **Fix, built for SEU — narrower than first stated.** Policy was never part of this fix: `policyEngine.evaluate` reading `ebm.seu_scoped_policy_ids` directly, independent of `transitionEngine.evaluate`, is CR-104's own pre-existing mechanism (`policyEngine.ts`'s own header comment: `transitionEngine.evaluate`'s `required_policy_ids` "is populated for zero real production transitions" — already dead for this purpose, unrelated to this CR). The one real change: `attemptSeuCommenceWork` (`commissioning.ts`) drops the `transitionEngine.evaluate` call this hop used to make for Authority (a no-op regardless, since the row declares no verb) and replaces it with a direct `transitionDefinitionsDB.find` + conditional `badgeAuthorityEngine.authorise`, then applies + publishes itself as the function's own last steps.
    - **Built for Deliverable too — the earlier "deferred" call was wrong, retracted.** Checked directly: `completeWorkItem` (`workItems.ts`) never calls `transitionEngine.evaluate` at all — it does its own independent `transitionDefinitionsDB.find` lookup, only to read `.verb` for the accountability badge string, and publishes a hardcoded `"DeliverableTransitioned"` regardless of how Authority was checked at dispatch time. So narrowing `evaluateDeliverableTransition`'s own Authority check doesn't touch `completeWorkItem` at all. `evaluateDeliverableTransition` now calls `transitionDefinitionsDB.find` + `badgeAuthorityEngine.authorise` (+ `triggerEngine.hasBeenSubmitted` if a row ever sets `submit_verb`, none do today) directly, same pattern as SEU. The bundled `required_policy_ids`/`required_quality_gate_ids` checks `transitionEngine.evaluate` also ran are dropped, not replicated — confirmed empty on every real Deliverable row (Deliverable already runs its own real Policy/Quality-Gate checks earlier in the same function), so this is deliberate simplification, not lost coverage. Verified against the exact test this touches: `badge-model.test.ts`'s Authority test (`deliverable_create`/`deliverable_approve`/root bypass via `transitionDeliverableSync`) calls the identical underlying `badgeAuthorityEngine.authorise`, just reached directly now instead of through `transitionEngine.evaluate`'s wrapper — behavior unchanged, no test update needed.
    - **Item 10 is now fully built, for both SEU and Deliverable.** Nothing left open on this item.
    - **Correction: not a duplication to resolve — three legitimately separate consumers, already correctly scoped once the SEU-scoped/definition-only line (item 9) is drawn precisely.** (1) `transitionEngine.evaluate`'s own `required_policy_ids` check stays exactly as-is, unchanged, for the definition-only entities (item 9's first bucket: Objective, Pack, Template, Profile, Service, Policy Definition, Ontology) that never become Engine territory. (2) `policyEngine.evaluate`'s SEU-scoped `applicable_policy_ids` check becomes the Execution Engine's own explicit step, for SEU-scoped entities (SEU, Deliverable, ...). (3) `PolicyRow.scope === "Eligibility"` (`seuTypes.ts`) governs Participant selection (Ch.12/33's "who's eligible for this Capability," `governed_transition` null, checked against the candidate's own `behaviour_context`) — Dispatch Engine territory, untouched by any of this. Nothing removed; each consumer already picks the check that corresponds to its own scope.

11. **Resolved (item 7's follow-on) — `transitionDeliverable`'s governance-adjacent side effects each travel with the check that produces them, into the Engine.** Same rule as item 10's Policy resolution: whichever check now lives in the Engine, its side effect lives there too, not left behind as a separate concern.
    - `raiseObligationForBlockedTransition` (Policy block) → moves with the Policy check.
    - `checkSustainedQualityGateBlocking` + `raiseAttentionItem` (Quality Gate block) → moves with the Quality Gate check.
    - `DeliverableBlocked` event publish (dependency block) → moves with the Dependency check.
    - Empty-centre presence check ("cannot approve nothing") → a Deliverable-state check, one of §7's own named Execution Inputs — Engine territory, same bucket as the others.
    - `resolveAutoActingBadge` is the one exception: not a governance decision, it's attribution bookkeeping (which badge grant gets recorded on the resulting Command/event) — same category as the `authorityBadge` value `transitionEngine.evaluate` already returns. Belongs with the narrowed apply/publish step (item 10), not the governance step.

### Open questions

None remaining at the conceptual level. The last candidate — "how does a human learn the Engine refused a manual click" — isn't a real gap: a manual click is a synchronous HTTP request; `transitionDeliverable` asks the Engine, waits, and returns the answer in that same response, exactly as `transitionDeliverable` already returns `{ok: false, reason: ...}` today. No Attention Item involved. Attention Items only matter for the separate, already-handled case of a *governed* (event-driven) retry finding it's still blocked with no human synchronously waiting (`raiseObligationForBlockedTransition` + `raiseAttentionItem`, pre-existing).

This CR is ready to move from design discussion to a build plan whenever the owner signs off.
