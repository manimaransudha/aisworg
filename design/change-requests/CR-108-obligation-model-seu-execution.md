# CR-108 — Obligation Model (Ch.23) implementation for SEU execution

**Raised:** 2026-09-16 · **Origin:** follow-on from CR-107 (Execution Engine owns Deliverable kickoff) — building CR-107's SEU-blocked/per-Deliverable-Obligation checks surfaced several execution-side gaps in the Obligation model itself, deliberately deferred by earlier CRs rather than designed. **Status:** ✅ Built 

## Known gaps to read into first (grounding, not yet a design)

- **CR-062's own deferral (Chapter 5 §19.4, Pack contribution build):** `contributionObligationDefinitions[]` deliberately left Priority, Completion Criteria, and the five "Related *" fields (§8: Related Deliverable/Decision/Evidence/Policy/Authority-Rule) off the Definition — owner: "there is no way you can predefine [this]... whoever is opening an obligation during seu execution will have to specify this." Related Risks is moot (no Risk entity exists anywhere in the codebase). None of this execution-side half was ever built.
- **Obligation's own named lifecycle events (Ch.23 §15) — only 2 of 8 real**, per Chapter 5 §19.4's own audit note; the rest split out as CR-063, never picked up.
- **AttentionItem has no structural equivalent of Obligation's `blocked_from_state`/`blocked_to_state`.** Found live this session (CR-107): those two columns are what let `raiseObligationForBlockedTransition` and the resolution-triggered retry (`executionEngineKickoff.ts`) know exactly which hop an Obligation is blocking. AttentionItem carries no equivalent — if it's ever meant to function as a live gate alongside Obligation (not just a notification), it needs the same structural link, not yet designed.
- **The manual "Create Obligation" form (SEU detail page, Obligations tab) may not be a legitimate operation at all** — owner, live this session: "this is not aligned with the Obligation definition we have. I am unsure whether we need the ability to manually create an obligation." Deliberately left untouched pending this CR's own answer — Ch.23's own execution model may intend Obligations to only ever be raised systemically (off a blocked governed transition), never hand-created.

## Not yet designed

Everything — this CR only records where to start reading and what's already known to be incomplete. Read Chapter 23 (Obligation Model) itself thoroughly before designing anything (per standing practice: the code lags/diverges from spec, and chapters aren't always current here). Concretely open, in no particular order:

- Whether manual Obligation creation is real or should be removed/replaced.
- Whether AttentionItem needs Obligation's own `blocked_from_state`/`blocked_to_state` shape, and if so, whether it should also get its own resolution-triggered retry mechanism (mirroring `executionEngineKickoff.ts`) or something else.
- The execution-side shape of Priority/Completion Criteria/Related-* — who sets them, when, and whether that's a UI form, an automatic derivation off the raising context (the way `raiseObligationForBlockedTransition` already derives title/description from the blocking Policy), or both.
- CR-063's own remaining 6 lifecycle events — worth doing here, or still its own separate CR.
- Whether Obligation's per-entity-type reach (today: SEU and Deliverable, per CR-107) should generalize further, or stays scoped to those two.

## Related

- CR-107 — `design/change-requests/CR-107-execution-engine-owns-deliverable-kickoff.md`, the SEU-blocked/per-Deliverable-Obligation mechanism this CR's own gaps were found while building.
- CR-106 — `design/change-requests/CR-106-blocked-transition-obligation-attention-item.md`, the original Obligation-raising mechanism.
- CR-062/CR-063 — Chapter 5 (Pack Model) §19.4's own audit trail for the Obligation Definition contribution build and its split-out lifecycle-events follow-up.
- Chapter 23 — Obligation Model (`design/foundations/03_Book 3 (Refined)/`, exact Part/location not yet confirmed this session — locate and read first).



-----------

## To build 

1. Standalone Pack contributionObligationDefinitions[] — composed into the EBM, never read by anything at runtime.
 
- Pack Obligation definition same as Policy scope=eligibility. 
    - src/dblayer/seuTypes.ts:344 — Pack's obligationDefinitions contribution type now carries applicabilityDeliverables?: PolicyApplicabilityDeliverable[], the identical type Policy's own Eligibility-scope condition uses.
    - src/dblayer/migrations/249_pack_obligation_definition_applicability_deliverables.sql — new migration adding the applicabilityDeliverables field to Pack's contributionObligationDefinitions[] schema (name sourced from the real Authority Vocabulary noun list, transitions from transition-definition), fixed to the noun source (no scope toggle, since a Pack is never Deliverable-targeted).
    - src/routes/seu/core/packs.ts — validatePackSeed now validates each applicabilityDeliverables row (name is a real active noun, transitions belong to that noun), mirroring validateConditions's Eligibility-branch in policyDefinitions.ts exactly.
    - No change to EBM composition.
    - src/routes/seu/core/obligations.ts — new raiseObligationsForPackDefinitions(): scans the EBM's behaviors.pool for obligationDefinition::* entries, matches each definition's applicabilityDeliverables[].name/transitions against the governed transition being attempted, and idempotently raises/reuses a real Obligation (+ Attention Item) per match — same check-existing-before-create pattern as raiseObligationForBlockedTransition, and deliberately generic (no origin-keyed branching) so it's reusable from any governed-transition call site, not just this one.
    - src/routes/seu/core/commissioning.ts — attemptSeuCommenceWork now calls it right after the Policy-block check, for SEU|Activated|Operational: if any Pack-declared Obligation Definition matches that hop, the SEU stays at Activated (same as a blocked Policy) instead of flipping to Operational.
    - No change to execution engine logic


2. AttentionItem has no blocked_from_state/blocked_to_state — can't act as a structural gate like Obligation does.

AttentionItem (Ch.34) isn't a governed entity in the Execution Engine's sense at all — it's the platform's mechanism for directing scarce human attention (§1, AM-001 "demand-driven," AM-002 "minimised... only situations requiring intervention"). Per the chapter's own architecture (§3): Events → Attention Evaluation → Attention Items → Routing → Participants/Users/External Systems. It's a notification/routing decision, always a downstream side effect of something else happening (an Obligation being raised, a blocked Quality Gate, a runtime failure) — never itself the thing that blocks a transition. That's exactly why it has no blocked_from_state/blocked_to_state: there's no "AttentionItem reaches its next state" hop for raiseObligationsForPackDefinitions to gate, because AttentionItem was never designed to gate anything.

    - qualityGateEngine.ts — new RESOLVED_ATTENTION_STATUSES = new Set(["Resolved", "Closed"]) (Ch.34 §9's own two terminal-enough states), alongside the existing Obligation one.
    - executionEngineKickoff.ts — new handleAttentionItemTransitioned: on a Resolved/Closed hop, looks up the AttentionItem, and if it's related to a SEU, re-attempts attemptSeuCommenceWork. No blocked_from_state/blocked_to_state filter (AttentionItem has none — that's structural, per Ch.34) — attemptSeuCommenceWork's own self-check makes an extra call safe.
    - deliverableKickoff.ts — same event now also triggers its existing blanket per-Deliverable rescan, gated by the new resolved-status set.
    - eventSubscriptions.json — registered AttentionItemTransitioned (was real, published, but never catalogued) and wired both executionEngineKickoff and deliverableKickoff as subscribers, mirroring ObligationTransitioned's existing two rows exactly.
    - No changes needed to attentionItems.ts itself — AttentionItemTransitioned was already published on every hop.


3. Manual "Create Obligation" form — still live on the SEU detail page; legitimacy never decided.

~~4. Participant can't raise an Obligation — completeWorkItem on blocked/failed raises an AttentionItem directly instead, contradicting CR-109's own settled design.~~

- Remove the SEU-detail form/route. - Add a Participant-facing "Raise Obligation" form on quickview/participant.ejs (their own Deliverables only, via getParticipantHomeView's already-computed myDeliverableIds). Fields: Category, Title, Description, Severity, governing Condition  Files: seus.ts, detail.ejs, participantHome.ts, one new web route, participant.ejs. No evidence field. No origin label. 
- src/routes/seu/web/seus.ts — removed POST /seus/:id/obligations (manual create route) and its now-unused createObligation import; kept the transition route.
- src/views/seu/seus/detail.ejs — removed the Create-Obligation form from the SEU detail page's Obligations tab.
- src/routes/seu/core/participantHome.ts — new raiseMyObligation(): re-derives the caller's own myDeliverableIds for the given SEU (same logic scopeToParticipant already uses) and rejects if the named Deliverable isn't actually assigned to them, before calling createObligation.
- src/routes/web/public.js — new POST /quickview/seus/:seuId/obligations, mirroring the existing work-item-completion route's shape/auth.
- src/views/quickview/participant.ejs — new "Raise Obligation" form per engagement's Obligations tab, Deliverable dropdown restricted to that engagement's own scoped list. Fields: Category, Title, Description, Severity, Governing Condition (free text, stored on the existing completion_criteria column — no schema change). No evidence field, no origin label, as decided.


5. CR-063's remaining 6 named Obligation lifecycle events — only the generic ObligationTransitioned exists.

## db structure changes

- Migration 251_obligation_version_originating_assigned.sql adds to the real obligations table (execution instance, not the Definition):
    - version INTEGER NOT NULL DEFAULT 1
    - originating_entity_type TEXT, 
    - originating_entity_id UUID
    - assigned_entity_type TEXT, - assigned_entity_id UUID

- Code:
    - seuTypes.ts — ObligationRow carries all 5 new fields.
    - obligationsDB.ts — create accepts and inserts the new originating/assigned pairs; updateStatus bumps version on every transition.
    - core/obligations.ts — createObligation now defaults originatingEntityType/originatingEntityId to ("EBM", <SEU's active_ebm_id>) when the caller doesn't supply a more specific one. Wired real values at both raise-on-block paths: raiseObligationForBlockedTransition → ("Policy", policy.id); raiseObligationsForPackDefinitions → ("Pack", <the raising Pack's real id>, read off the EBM pool's own source.id, which the previous code was discarding).
    - participantHome.ts — raiseMyObligation → ("Participant", engagement.id).
    - telemetry.ts — the 3 sustained-pattern callers now pass their existing originatingObjectType/originatingObjectId (QualityGate, Policy, Capability) straight through as the originating entity.
    - knowledge.ts — Acquisition Scope promotion → ("Knowledge", knowledgeItem.id).
    - assigned_entity_type/assigned_entity_id are added as plain nullable columns with no auto-population anywhere — real assignment workflow is a separate, not-yet-built question (Ch.23 §19.10), so I only added the column pair as asked, not invented assignment semantics.
    - Category/Severity dropdowns fixed (quickview/participant.ejs's Raise Obligation form) — no longer hardcoded arrays; public.js now loads category:obligation and category:obligation-severity from Ontology (same concept types the SDK authoring form already uses) and passes them to the view.
    - New fields added to UI:
    Participant-facing table (participant.ejs) — added Origin and Assigned columns showing originating_entity_type/assigned_entity_type.
    Admin-facing detail modal (seu/seus/detail.ejs) — added Version, Originating entity (type (id)), and Assigned to rows, following the same data-* attribute + modal pattern already used for Origin/Priority/Completion Criteria.

- Obligation service updates:

Call sites: 
- redispatch.ts:75
- dispatchEngine.ts:58
- knowledge.ts:251
- telemetry.ts:204
- participantHome.ts:178
- obligations.ts:184 (inside raiseObligationForBlockedTransition)
- obligations.ts:295 (inside raiseObligationsForPackDefinitions)
- findings.ts:119
- api/obligations.ts:18 (generic manual API)
- seuId is not required in the createObligation call. relatedObjectType/relatedObjectId should hold this informaton. 

- Migration src/dblayer/migrations/252_obligation_event_version_reopen_escalate.sql (not yet applied — direct DB write was blocked by sandbox; run it yourself): populates event_type/version_event on the 7 existing Obligation rows, adds Closed→Reopened, Reopened→In Progress, and 6 →Escalated rows, adds obligations.revision_history (JSONB).
- src/dblayer/seed/data/transitionDefinitions.json updated to match, for a future db:clean-slate.
- src/routes/seu/core/obligations.ts: transitionObligation now publishes the named event_type and ObligationTransitioned on every hop, same correlation id; new reviseObligation (pure Revision — diffs against the live row, appends only changed fields to revision_history, no event, no status/version change).
- src/dblayer/obligationsDB.ts: new update() — one atomic write of the changed fields plus the appended history entry.
API (PATCH /obligations/:id) and web (POST /seus/:id/obligations/:obligationId/revise) routes added.
- seus/detail.ejs: Obligation modal's Description/Severity/Priority/Completion Criteria are now editable with a Save button.