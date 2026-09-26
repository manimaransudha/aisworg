# CR-113 Item 6 — ConceptCreated approval flow — working notes

Scratch/whiteboard file for this item's design discussion. Not the CR itself — see
[CR-113](CR-113-ontology-composition-from-packs.md) item 6 for the raised requirement.

**Status:** 🟢 Built and closed. 28-09-2026 

## Settled

- No HANDLER_REGISTRY / event_subscriptions subscriber for `ConceptCreated`. Approve/Reject
  is a same-entity (Ontology Concept) state change, not a cross-entity effect — per CLAUDE.md's
  subscriber rule, no real subscriber is warranted. Visibility comes from querying
  `ontology_concepts` where `status = 'Draft'`, not from anything a subscriber writes.
- Approve/Reject surfaces as a tab, gated by `route_authority` requiring badge `ontology_approve`,
  listing Draft concepts with Accept/Reject buttons.
- Both buttons come through the standard mechanism: `transition_definitions` rows for
  `entityType: "Ontology"`, `trigger === "manual"`, core computes `possibleNextStates`, web
  filters by `hasOntologyApproveBadge` — not a bespoke route. (Ontology currently has zero
  manual/badge-gated transitions — only automatic ones — so this is new wiring, not reuse.)
- Approve: `Draft → Active`, needs its own `eventType`/`versionEvent` per Version Feature Plan.
- Reject: `Draft → Draft` (self-transition, stays Draft), own `eventType` (e.g. `ConceptRejected`).
  Modeled as a real transition row so it appears as a `possibleNextStates` option alongside Approve.
- Reject requires a mandatory comment/note, following the Objective reject precedent (CR-073,
  `src/routes/seu/core/objectives.ts:1031-1038`): Reject is excluded from the generic manual-
  transition list/button loop, gets its own dedicated UI path with a required comment field,
  server-side validated (`comment_required` if missing), and the comment is stored and shown
  as the rejection reason (cf. `RejectedObjectiveListItem`, `objectives.ts:913`).
- `ontology_concepts_status_check` already includes `Draft` (migration 277, already applied) —
  no new migration needed for the status value.
- `ConceptCreated`/`ConceptUpdated` publishing (item 5) already implemented in
  `src/routes/seu/core/ontology.ts` (`emitConceptCreated`, line 216).

## Still open

- `ontology_approve` badge doesn't exist yet — needs an `authorityVocabulary.json` entry and
  `requiredAuthorityRuleCode`/policy wiring on the new transition rows, plus a `route_authority`
  row for the new tab route.
- Exact comment-storage mechanism for the reject note (a dedicated table/column, or reuse
  whatever Objective's reject-comment storage uses) — not yet confirmed against
  `objectives.ts`'s actual comment persistence path.
- Where the new tab lives in the nav (Ontology Management area presumably) and its route path.
