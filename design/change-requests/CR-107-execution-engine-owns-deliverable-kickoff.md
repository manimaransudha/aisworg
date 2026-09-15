# CR-107 — Execution Engine must own deciding when a Deliverable is eligible to start (Book 3 Ch.31/Ch.33), so a blocking Obligation actually gates engineering work

**Raised:** 2026-09-15 · **Origin:** split out of CR-106 while verifying its Obligation-raising mechanism live — an SEU blocked at its own commence-work hop (a real, open Obligation on record) still let its head-of-chain Deliverable move `Defined -> In Progress`, because nothing in the codebase connects the two. **Status:** 🟡 Raised — findings recorded, design not started.

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
