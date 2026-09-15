# CR-106 — A blocked governed transition should raise an Obligation/Attention Item, not hard-fail the entity

**Raised:** 2026-09-13 · **Origin:** CR-104's own SEU-scoped Policy validation (commissioning an SEU against the CR-104 demo Profile, whose Policy blocks Activated -> Operational by design). **Status:** ✅ Closed 2026-09-15 — Option C's step 1 (raise a real Obligation instead of hard-failing) built and verified live; scope narrowed and the rest split into CR-107 (see Built banner below).

## Built (2026-09-15)

Option C, scoped to the one concrete, reproduced case (SEU's own commence-work hop) plus the sibling Deliverable-Policy-block gap next to the existing Quality-Gate precedent:

- Migration 226 — `obligations` gains `origin`/`priority`/`completion_criteria` (closing the execution-side gap vs. the Definition-side `ObligationDefinition` shape) and `blocked_from_state`/`blocked_to_state` (nullable — set only when an Obligation is raised from a blocked transition).
- `raiseObligationForBlockedTransition()` (`routes/seu/core/obligations.ts`) — raises a real Obligation per entry in the blocking condition's own declared `relatedObligations[]` (Ch.23 §8 content, drawn from the Policy Definition itself — falls back to one generic Obligation when none is declared), plus a matching Attention Item each. Correctly resolves the originating Policy Definition and condition index even when `packs.ts` has fanned a multi-condition Policy out into several materialized rows (`parseMaterializedPolicyCode`).
- Wired into `commissioning.ts`'s SEU-scoped commence-work check and `deliverables.ts`'s Policy block (previously silent, unlike its Quality-Gate sibling).
- `ebmActivatedHandler` (`ebmActivated.ts`) branches on a new `blockedByPolicyCode` discriminant: raises the Obligation and leaves `seus.lifecycle_state` at `Activated` — never the hard, terminal `Failed` a genuinely broken commission still uses. **No new event type** — Chapter 8's own Subsystem Events list is closed (confirmed against `Events and Lifecycles.md`) and doesn't include anything for this; an earlier pass introduced `CommissionBlocked` without checking that first and it was removed the same day once caught — the real Obligation record is the only signal now.
- `obligationResolved` subscriber (`domain/engine/obligationResolved.ts`, on the real, pre-existing `ObligationTransitioned` event) — re-attempts the SEU's commence-work hop once the Obligation reaches Verified/Closed/Archived, via `retrySeuCommenceWork()` (a standalone re-check, deliberately not a re-run of `finalizeCommissioning`'s own asset-creation cascade, which isn't idempotent).
- UI: SEU detail page shows a second `state-Blocked` pill next to the lifecycle badge when an open blocking Obligation exists (`getSeuDetailView`'s new `blockedTransition`).
- `policy-cr104-demo-seu-commence-work.json` updated to actually declare a `relatedObligations[]` entry, so the demo fixture exercises the real authored-content path, not just the generic fallback.

**Deliberately not done** (moved to CR-107 rather than silently left as an implicit gap): the Obligation correctly blocks the SEU's own `Activated -> Operational` hop, but nothing connects that block to whether the SEU's Deliverables can actually start. `transitionDeliverable` never checks the owning SEU's lifecycle state or open Obligations, and no component in the current codebase plays the reactive "decide a Deliverable is now eligible" role Chapter 31 (Execution Engine) specifies. Raising the Obligation was this CR's whole scope; making it actually gate engineering work is CR-107's.

## Observation

Commissioning an SEU against a Profile carrying an unsatisfied SEU-scoped Policy on `SEU|Activated|Operational` produces this event trail:

```
CommissionRequested -> CommissionValidated -> CompositionCompleted ->
SEUConfigured -> SEUCommissioned -> SEUActivated -> CommissionFailed
```

The SEU's `lifecycle_state` lands on `Failed` — the same terminal state a genuinely broken commission (e.g. a missing Template/Profile row) reaches. Traced to `ebmActivated.ts`'s `failCommissioning`:

```ts
async function failCommissioning(seuId: string, event: EventRow, reason: string): Promise<void> {
  await seusDB.updateLifecycleState(seuId, "Failed");
  await eventBus.publish({ eventType: "CommissionFailed", ... });
}
```

Every reason `finalizeCommissioning` can fail for — a real data-integrity error, or a Policy simply not yet satisfied — is collapsed into the same call. Per the existing "Retry after a failed commission" behaviour, `Failed` is treated as genuinely terminal: retrying means creating a **brand new SEU**; the old one is never revived.

## Why this is wrong

Owner's concrete example: an SEU is set up for a change request, and customer approval is required before it may become Operational. That is not a broken commissioning — it is a legitimate, expected gate that will very plausibly be satisfied later (the customer approves). Forcing a whole new SEU into existence every time a real-world approval hasn't landed yet is wrong UX and misrepresents the platform's own audit trail: a `Failed` SEU sitting next to a "successful" retry SEU, when nothing was ever actually broken.

A Policy block and a genuine error are semantically different outcomes and must be handled differently.

## Grounding: reuse what's already built, not a new mechanism

Owner: *"This should issue an Obligation or Attention Item — I am repeating. The design and solutions have to be firmly based on the platform we have built, not a technical solution."*

The platform already has exactly this shape, one layer over: `qualityGateEngine.ts`'s `"no_unresolved_obligations"` criteria blocks a transition while a real Obligation on the entity is unresolved, and lets it through once that Obligation reaches `Verified`/`Closed`/`Archived` (Ch.23 §12). Nothing about a customer-approval gate is different in kind — it should be modelled the same way, not as a new lifecycle state or a parallel blocking mechanism.

Attention Items already have the matching precedent too: "a blocked Quality Gate and a failed External Interaction both surface real Attention Items on the platform-wide inbox" (existing, built behaviour) — the same should hold for a blocked Policy, otherwise a raised Obligation sits silently, unseen.

## Decision: Option C (generalised, not SEU-only)

Three options were laid out; owner chose the full one. This is **not** scoped to the one SEU `Activated -> Operational` hop — any governed transition blocked by a Policy or Quality Gate, anywhere on the platform, should:

1. Raise a real Obligation on the blocked entity, describing what's needed (drawn from the blocking Policy/Gate itself), instead of forcing a hard terminal failure state.
2. Raise a real Attention Item surfacing it on the platform-wide inbox, so a human actually sees it needs action — mirroring the existing blocked-Quality-Gate precedent.
3. Automatically re-attempt the blocked transition once the Obligation is resolved (`Verified`/`Closed`/`Archived`) — a real event subscriber off the Obligation's own resolution transition (a genuine cross-entity-type effect, per the platform's own subscriber rule), not a manual retry button and not a new polling mechanism.
4. Reserve the hard `Failed` terminal state for what it already correctly means today: a genuinely broken commission (missing/invalid referenced rows, thrown exceptions) — never a Policy/Gate that is simply not yet satisfied.

## Not yet designed

This CR records the finding, the concrete motivating example, and the agreed direction (Option C) only. Still open, to be designed properly before building:

- Which entity types/transitions this generalises across in practice (SEU's own hops confirmed in scope via CR-104; Deliverable/AttentionItem/etc. already route through `qualityGateEngine`/`policyEngine` — does this replace or sit alongside their existing block handling?).
- The exact shape of the auto-generated Obligation (category, description, which Policy/Gate fields populate it) and Attention Item.
- The new subscriber's own trigger (Obligation's `Verified` transition specifically, or any of `Verified`/`Closed`/`Archived`?) and exactly which transition it re-attempts (re-derived from context on the Obligation, or recorded explicitly at block time?).
- Where `ebmActivated.ts`'s `failCommissioning` (and any equivalent call sites elsewhere) needs to branch: Policy/Gate-blocked vs. genuinely broken.

## Follow-on: Obligation Model (Ch.23) gap closure

Before CR-106 can raise a real Obligation as designed above, Ch.23 §8's own Obligation Structure has gaps against the live `obligations` table (full audit in Ch.23 §19.5). This session closed on the following, not yet built:

- **Definition vs Execution split applies to Obligation**, same pattern as elsewhere on the platform. When an Obligation is declared inside a Policy or Pack, only the *Definition* part is specified, stored as JSONB within that Policy's/Pack's own definition — schema must match Ch.23's own field list. The *Execution* instance (the real `obligations` row, created at SEU-runtime) carries the rest.
- **Origin (§8) = §10 Obligation Sources**, Ontology-driven. Already real at the Definition level (`category:obligation-origin`, CR-062, 11 seeded values). Gap: not captured on the execution instance — no `origin` column exists on `obligations` today.
- **Priority**: new field. Values Very High / High / Medium / Low. Ontology-driven — new concept type `category:obligation-priority`. No column exists today.
- **Severity**: currently free-text `severity?: string` (`obligations.ts:27`, `obligationsDB.ts:20`), hardcoded default `"Medium"` — not Ontology-driven today (also a hardcoded-constant violation). New concept type — `category:obligation-severity`.
- **Lifecycle status**: already matches §9 exactly (8-state chain, `transition_definitions`) — no gap.
- **Completion Criteria**: must be present. No column exists today.
- **Related Deliverables / Related Decisions / Related Evidence / Related Risks / Related Policies / Related Authority Rules / Traceability References**: all Execution-side, to live in the `obligations` table (or related tables) — not part of the Definition's declared JSONB.
- **Definition-side JSONB shape** (extends `contributionObligationDefinitions[]`, CR-062's precedent, which already carries `category`/`origin`): Category, Title, Description, Origin, Priority, Severity, Completion Criteria. Everything else in §8 (Identifier, Status, all Related-*/Traceability) is execution-only, on the real `obligations` row, never in this JSONB.

Build tasks (decided, not yet built):

Still open, not yet designed:

- Storage shape for the Related Deliverables/Decisions/Evidence/Risks/Policies/Authority Rules/Traceability References fields: keep the existing generic polymorphic pair (`related_object_type`/`related_object_id`, one relation per row), or move to real typed columns/join tables per relation kind, since the chapter's own §8 fields are plural (e.g. "Related Deliverables") and the current mechanism supports only a single relation.

## Related

- [CR-104](CR-104-seu-transition-to-operational.md) — the SEU-scoped Policy mechanism this finding surfaced through, and the real, non-bypassed Policy Definition -> Pack adoption path (`publishPack` no longer overriding a Definition's own `scope`/`governedTransition`/`governingCondition`) built the same day as this CR was raised.

## Observations and Findings 

- Gaps in Obligation implementation have to be closed. 

## Fixes to be done

### Summary of the Ontology-composition feature:

- Schema: new x-ontology-composable flag (formGenerator.ts) — per-field opt-in, not automatic for every x-ontology field. Migration 209 sets it on Policy's applicabilityEnvironments/applicabilityDeliverableNames.
- Generic mechanism (ontology.ts): emitOntologyComposed (generalized from the old Pack-only emitOntologyComposedIfUnregistered, now callable for any kind) and proposeComposableOntologyValues (scans a schema's composable fields, proposes each unregistered entered value). Payload carries tenantId, originatingEntityCode, conceptType, fieldName, proposed code; originator id/badge go on the event envelope's own actorId/authorityBadge fields, matching the platform's standing convention.
- Draft vs. publish split: validatePolicyDefinitionSeed gained a draft flag — skips assertCanonicalCategory on the two composable fields at draft-save (proposes instead), still enforces it at Publish (blocks). Mirrors Pack's existing behavior exactly.
- UI: new chip-based widget (composableMultiSelect.js + CSS) for any referential-multi-select + composable field — pick existing options or type new ones; unregistered chips show a ⚠ flag.
- Also closed a real gap along the way: saveAuthoringDraft never captured actorId at all before this — now it does, for every kind, not just Policy.


### Policy definition

- Order the fields in the schema so the policy registry and policy authoring show the fields in correct order. (Fix the schema registry and remove hardcoded group items) *[Remarks: complete]*
- applicabilityDeliverableLifecycle now stores/offers real transition edges (Deliverable|From|To), not bare state names — sourced live from transition_definitions via listDeliverableLifecycleTransitions() (policyDefinitions.ts), removing the old 4-state hardcoded Set and the ambiguity between Deliverable's two lifecycles sharing entity_type='Deliverable'.
- Naming multiple transitions fans out into one materialized policies row per transition (packs.ts's governedTransitionsFor + rewritten materialization loop), with policyIdByCode now multi-valued and resolvePolicyCodes flat-mapping across all fanned-out rows.
applicabilityDeliverableNames is now actually enforced at runtime — a new policies.
- applicability_deliverable_names column (migration 211), copied onto every fanned-out row unchanged (a filter, not an identity reusing qualityGateEngine.ts's exact mechanism), and policyEngine.ts now filters candidates by the real Deliverable's own name when set.
- Migration 212: moves scope into the Applicability tab (x-group), sets field order to Applicable Environment → Scope → Deliverable Names → Lifecycle, and adds x-referential-source-by-value to applicabilityDeliverableNames.
- formGenerator.ts: new x-referential-source-by-value marker — a discrete switch (not a suffix-derivation) between an Ontology source and a plain Registry source, keyed by a sibling field's current value. Wired into both generateFields (render-time resolution) and ontologyComposableFieldsIn (so a submitted noun code is never mistakenly proposed as an unregistered deliverable-name Ontology concept).
- Web route: new "noun" registry key (listActiveNouns(), the same real Authority Vocabulary source the Authority admin page uses).
- policyDefinitions.ts: validatePolicyDefinitionSeed now validates applicabilityDeliverableNames against the real noun list when scope === "Eligibility", and against deliverable-name Ontology otherwise.
- Widget resolves correctly on load/reload based on the currently-saved scope; flipping scope live in the browser without saving doesn't yet swap the widget instantly (flagged as a deliberate smallest-change scope call).

- generateFields's top-level select/enum branch never read def.default at all (unlike the item-level default it already honors) — so a brand-new draft's scope dropdown rendered on the blank option, and since a native <select> submits whichever option is marked selected, an untouched form silently created the Draft with scope="". Fixed generically (migration 213 supplies "default": "Transition"; the code fix benefits any enum field with a declared default, not just this one).

scope/governedTransition/governingCondition were missing from all three places that build form/validation content from the real policy_definitions row (getAuthoringDraft, and the publish-time validator), despite being real columns since migration 207 — contradicting those functions' own "real columns always win" comments. The publish-time one was worse: it spread draft_content after the explicit real-column fields, so stale draft content could silently override code/name/category too, not just scope. Both fixed.
- Migration 215_policy_condition_structure_redesign.sql — seeds 3 new Ontology concept types (category:policy-condition-severity, category:obligation-priority, category:obligation-severity) and rebuilds Policy's conditions field from raw JSON into a structured referential-list matching Ch.24 §8 exactly.

New form-generator capability (formGenerator.ts): nested-object (a single fixed sub-object inside a list row — requiredEvidence) and generated (system-assigned, read-only — exceptionRules[].identifier), both reusing the existing recursive buildItemFields/buildRow/parseReferentialListField machinery that Checklist's items nested-list already proved out, per your instruction to check that precedent.

Edit UI (_referentialListGroup.ejs): generic (schema-driven, not name-detected) support added for nested-object rendering and for referential-multi/generated one level inside a nested-list — needed for exceptionApprovers and identifier.

View UI: a dedicated isConditions card block (same established per-field-name pattern as Checklists/Quality Gates/Obligation Definitions), since the existing "generic" nested-list view cell is actually hardcoded to Checklist's own field names.

Types/validation: PolicyCondition in seuTypes.ts rebuilt with PolicyRequiredEvidence/PolicyRelatedObligation/PolicyExceptionRule; sdkAuthoring.ts's toPolicyConditions rewritten to assemble/normalize the new shape and assign identifier via randomUUID() when blank; policyDefinitions.ts's validateConditions rewritten async, enforcing Ontology on severity/category/origin/priority/severity throughout (unconditionally — none of these are composable) and validating exceptionApprovers against the real, active authority_noun_verbs badge list via a new "authority-badge" referential source in web/sdkAuthoring.ts.

- All the code changes for moving applicabilityDeliverables/governingCondition into each condition (and dropping governedTransition entirely) are in — migration 216_policy_applicability_and_governing_condition_into_conditions.sql, seuTypes.ts, policyDefinitionsDB.ts, policyDefinitions.ts's validation, sdkAuthoring.ts's round-trip, packs.ts's materialization (now fans out per-condition, each with its own real severity/governingCondition — no more highestConditionSeverity reduction), templates.ts's Exposable Parameters, profileCompositionUnravel.ts, the registry list view, and the authoring form (new nested referential-by-scope/json field kinds, plus fixed a real pre-existing bug along the way: the clone handlers were initializing widgets before inserting the clone into the DOM, so .closest('form') always failed — moved insertion first in both the top-level and nested "+Add" handlers).

One real regression I found while verifying, not something to silently fix given "don't touch seed data now": src/dblayer/seed/data/policy-cr104-demo-seu-commence-work.json is a functional validation fixture (not one of the 34 real policy definitions — it's CR-104's own end-to-end proof that a blocked governed transition works) that relies on the now-dropped governedTransition: "SEU|Activated|Operational" override, with empty applicabilityDeliverableNames. Without that override, it'll silently fall back to the default Deliverable|Approved|Baselined instead of actually governing the SEU's commence-work hop — breaking what the fixture is meant to demonstrate. The sibling cr104-demo-background-check.json (Eligibility-scoped) is unaffected.
- Migration 218: rebuilds it as a nested-object with 5 fields — type (always_true/field_in/comparison/threshold), field, operator (gt/gte/lt/lte/eq/neq), values (comma-separated, field_in only), value (comparison/threshold only) — each of the last four only shown once type picks a real condition type, and only the ones that type actually uses.
- New capability: x-show-when-values (formGenerator.ts) — extends the existing x-show-when mechanism ("show only when a named sibling field is non-empty") to "show only when the sibling's current value is one of these." Reuses edit.ejs's existing generic [data-show-when] delegated listener rather than a new widget; fixed the one new gap it needed (cloning a condition row now also fixes up the data-show-when attribute's row index, the same way name attributes already are).
- sdkAuthoring.ts's toPolicyGoverningCondition assembles the structured form fields back into the real {"type": ...} shape the evaluators expect (splitting values on commas), while still accepting the real object directly for seed/inherit/copy paths.
- policyDefinitions.ts's validation now checks each type's own real requirements (field_in needs field+values; comparison/threshold need field+operator+value; threshold's operator is restricted to gte/gt).

migration 219:

Reorder: each condition's fields are now statement, severity, applicabilityDeliverables, requiredEvidence, relatedObligations, exceptionRules.
governingCondition moved into applicabilityDeliverables: each {name, transitions} row now carries its own governingCondition — a condition naming several deliverables/transitions can give each one a different real governing rule instead of one rule shared by all of them. This is the first three-level-deep nested field in the codebase (nested-object inside a nested-list row); built the minimal dispatch it needs (enum + plain string, since that's all type/field/operator/values/value ever use) rather than duplicating the full generic dispatch chain.
Updated end-to-end: seuTypes.ts (governingCondition moved to PolicyApplicabilityDeliverable), sdkAuthoring.ts (toApplicabilityDeliverables now assembles it per row), policyDefinitions.ts (validation extracted into a reusable validateGoverningCondition helper, called per applicability row), packs.ts (governedTransitionsFor now carries each row's own rule through to materialization — no more "one rule for the whole condition"), the seed-fold script, and both the edit and view UI. Also fixed the two clone-handlers' data-show-when index fix-up for the new depth (row-clone still targets the first bracket; the nested "+Add item" handler now targets the last one, matching how name attributes already handle each case).

- Migration 220: exceptionStatement already covered justification, exceptionApprovers already covered approving authority — added the three that were missing: duration, exceptionScope (named to avoid confusion with Policy's own top-level scope), and reviewRequirements. The whole exceptionRules field also gets x-show-when: "constraintType" / x-show-when-values: ["Policy"].

New capability: extended the x-show-when/x-show-when-values mechanism up to the top item-field level too (_referentialListGroup.ejs's outer per-field wrapper) — this case was simpler than the nested ones since constraintType is a bare, unindexed top-level field, so no row-path computation was needed, just a direct name reference.

Updated end-to-end: seuTypes.ts (PolicyExceptionRule), sdkAuthoring.ts (toPolicyExceptionRules), policyDefinitions.ts (validateConditions now takes constraintType and rejects any exceptions declared on a "Standard"), and the view-mode display.

- Updated Versioning and transitions 

### Obligations

- Add `priority`/`severity` columns, Ontology-enforced via `assertCanonicalCategory` against the two new concept types (values seeded by migration, same as `category:obligation-origin`).
- Add `origin` column, Ontology-enforced against `category:obligation-origin`.
- Add `completion_criteria` column.
- Extend `contributionObligationDefinitions[]` with Priority/Severity/Completion Criteria, alongside its existing Category/Origin fields.
- one shared ObligationDefinition model now backs both:

seuTypes.ts: new ObligationDefinition interface (category, title, description, origin, priority, severity, completionCriteria — Ch.23 §8's Definition-side fields, Category/Origin/Priority/Severity Ontology-backed). PolicyRelatedObligation is now just type PolicyRelatedObligation = ObligationDefinition.
Migration 222: Pack's contributionObligationDefinitions[] reshaped to match — added title/priority/severity/completionCriteria, renamed statement→description (same concept, Ch.23's own name). code and the §20 verifiable-item execution fields (classification/prompt/participant/outputContract/assurance/externalEvidence) stay unchanged — they sit outside Ch.23 §8 entirely, layered on top of the shared shape rather than replaced by it.
_referentialListGroup.ejs: verifiableFieldsBlock (shared by Quality Gate/Review Gate/Obligation Definitions) now takes the statement-field name as a parameter instead of hardcoding "statement" — Obligation Definitions pass "description", the other two are unaffected. View-mode card also now shows title/priority/severity/completionCriteria.
No validation logic added for the new fields — category/origin were never enforced at declaration time either (a pre-existing gap, not something this change should quietly fix), and no runtime code anywhere consumes contributionObligationDefinitions[] by field name, so this was a low-risk, contained rename.one shared ObligationDefinition model now backs both:

seuTypes.ts: new ObligationDefinition interface (category, title, description, origin, priority, severity, completionCriteria — Ch.23 §8's Definition-side fields, Category/Origin/Priority/Severity Ontology-backed). PolicyRelatedObligation is now just type PolicyRelatedObligation = ObligationDefinition.
Migration 222: Pack's contributionObligationDefinitions[] reshaped to match — added title/priority/severity/completionCriteria, renamed statement→description (same concept, Ch.23's own name). code and the §20 verifiable-item execution fields (classification/prompt/participant/outputContract/assurance/externalEvidence) stay unchanged — they sit outside Ch.23 §8 entirely, layered on top of the shared shape rather than replaced by it.
_referentialListGroup.ejs: verifiableFieldsBlock (shared by Quality Gate/Review Gate/Obligation Definitions) now takes the statement-field name as a parameter instead of hardcoding "statement" — Obligation Definitions pass "description", the other two are unaffected. View-mode card also now shows title/priority/severity/completionCriteria.
No validation logic added for the new fields — category/origin were never enforced at declaration time either (a pre-existing gap, not something this change should quietly fix), and no runtime code anywhere consumes contributionObligationDefinitions[] by field name, so this was a low-risk, contained rename.

## Evidence

- Cleanup categories in the Ontology and remove the filter associated in the quality gates to remove the non-canonical ones. 
- ObligationDefinition.requiredEvidence: EvidenceDefinition, declaring what evidence would satisfy/close that obligatio. 
- Policy's own per-condition requiredEvidence (currently {evidenceType, evidenceFormat}) gets upgraded to this same EvidenceDefinition shape. 
- Summary of the EvidenceDefinition build-out:

seuTypes.ts: new EvidenceDefinition (title, category, description, collectionMethod — Ch.17 §8's Definition-side fields, category Ontology-backed against category:evidence). ObligationDefinition gains requiredEvidence: EvidenceDefinition; PolicyCondition.requiredEvidence now uses it directly, replacing the old ad-hoc {evidenceType, evidenceFormat} shape.
Migration 224: rebuilds the schema at all three points — Policy's condition-level requiredEvidence, relatedObligations[].requiredEvidence, and Pack's contributionObligationDefinitions[].requiredEvidence — identically.
New EJS capability: added the missing referential+ontology branch to the third-nesting-level dispatch (needed now that EvidenceDefinition.category sits two levels deep inside relatedObligations[]), plus markdown/full-width handling for description.
sdkAuthoring.ts: toEvidenceDefinition (renamed/generalized from the old toPolicyRequiredEvidence), used at both call sites.
policyDefinitions.ts: validateEvidenceDefinition extracted and called for both the condition's own requiredEvidence and each relatedObligations[].requiredEvidence; dead EVIDENCE_TYPES set removed.
packs.ts: fixed DEFAULT_CONDITION's now-stale requiredEvidence literal to match the new shape.
View-mode rendering updated in all three places (condition, related obligation, Pack's own obligation definition card).

