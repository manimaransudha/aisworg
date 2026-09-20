# CR-097 — Review queue for `OntologyComposed` proposals (Accept/Reject)

**Raised:** 2026-09-11 · **Origin:** owner, working from Ch.18 §14's own named events (SemanticConflictResolved selected in the IDE): "We now have to create a consumer for OntologyComposed. The list has to show the details of the originator. Right now, only packs are contributing to ontology, but this may expand later. The actions have to be to accept or reject. If rejecting, use SemanticConflictDetected. Add a reject note; no versioning. If accepting the very first time, OntologyValidated event, Versioned. If accepting after rejections, then SemanticConflictResolved, Versioned. The user proposing the ontology should be able to see the proposed ontology and status." · **Status:** ❌ **Closed 2026-09-11** — not built. Design reasoning below kept as-is (not deleted) for whenever this is picked up again; Events and Lifecycles.md's own Chapter 18 table (rows 8-10) and Version Feature Plan.md's entry 7 both already point back to this CR as the reference for that gap.

## The gap

`OntologyComposed` already publishes today, from two places:
- `core/ontology.ts`'s `composeConcept` (CR-095/CR-096) — a tenant directly Specializing/Overriding a concept through the Ontology Management UI. `originatingObjectType: "Ontology"`.
- `core/sdkAuthoring.ts`'s `emitOntologyComposedIfUnregistered` (CR-079 step (d), corrected same-day from the wrong `ConceptCreated` name) — fires whenever a Pack's own contribution (a Quality Gate category, Obligation category/origin, Service code, or any of `core/packs.ts`'s other 8 Ontology checks) references a code with no matching concept. `originatingObjectType: "Pack"`.

Nothing consumes either. The event lands in the `events` table and nothing ever looks at it again — no list, no decision, no notification to whoever holds the authority to fold that code into the real vocabulary. This is Ch.18 §18.12's own "wired to zero internal consumers" gap, but one level further: unlike `resolveLabels`/`resolveLabel` (an API with zero callers), `OntologyComposed` today has no reader *at all*, not even an API endpoint.

This CR is about the **second**, `originatingObjectType: "Pack"` case specifically — an unreviewed external proposal that needs a real human decision before it becomes a canonical concept. `composeConcept`'s own `OntologyComposed` (`originatingObjectType: "Ontology"`) is a tenant's own deliberate, already-reviewed action — it writes the concept immediately today and should keep doing so; it is **not** in scope for a review queue (see "Not in scope" below).

## Design — settled by the owner

- **Consumer**: a list of pending `OntologyComposed` proposals (`originatingObjectType` other than `"Ontology"` — see "Not in scope"). Each row shows **the originator's own details** — today that means resolving the Pack (code, name, tenant) behind `originatingObjectId`, not a bare UUID.
- **Generic over originator type**: only Packs contribute today, but the mechanism must not hardcode "Pack" — a future originator kind should slot in without a rewrite (a small per-`originatingObjectType` resolver, not a `switch` special-cased to one type).
- **Two actions**: Accept, Reject.
  - **Reject** → publish `SemanticConflictDetected`. Requires a **reject note** (why). **No versioning** — nothing is written to `ontology_concepts`; the proposal never became a real concept, so there's nothing to version.
  - **Accept, the very first time** (no prior rejection on this same proposal) → publish `OntologyValidated`. **Versioned** — the concept is actually created (a real `ontology_concepts` row, through the existing versioned write path).
  - **Accept, after one or more rejections** → publish `SemanticConflictResolved` instead of `OntologyValidated` (same proposal, the earlier conflict is now resolved rather than freshly validated). **Versioned**, same as above.
- **Proposer visibility**: "The user proposing the ontology should be able to see the proposed ontology and status" — a second, proposer-facing view (not just the reviewer's queue) showing what they've proposed and its current state (pending / rejected / accepted).

## Design — proposed mechanics (not owner-confirmed; to settle when this is picked up)

These fill the gaps the owner's own spec leaves open, reasoned from how the rest of this codebase already does the equivalent thing — flagged as proposals, not decisions:

- **No new table — status is event-sourced**, the same discipline Version history already uses (migration 183's own "a read, not a write path"): a proposal's identity is `(originatingObjectType, originatingObjectId, conceptType, code)`; its status is whichever of `OntologyComposed` / `SemanticConflictDetected` / `OntologyValidated` / `SemanticConflictResolved` is the *latest* event for that identity. Rejected is not terminal — the same proposal can still be Accepted later (that's precisely what makes "Accept after rejections" meaningful as a state, not a dead end).
- **Causal chain via `causationId`** (an existing, currently-unused `events` column, `eventBus.ts`'s own `PublishInput`): the Accept/Reject decision event's `causationId` points at the original `OntologyComposed` event (or the prior rejection, for a second look) — lets a reader reconstruct one proposal's full history without inventing a new foreign key.
- **Accept needs more than a click**: `emitOntologyComposedIfUnregistered`'s own payload today is just `{code, conceptType}` — no `defaultLabel`, which the real write path (`addConcept`) requires. Accept's own UI needs at least a label field (pre-fillable from the code, editable) before it can call the existing `createConceptVersion` path — this is *reuse*, not a new write mechanism: accepting fires the same `addConcept`/`createConceptVersion` this CR's own predecessors (CR-095/CR-096) already built, so `ConceptCreated` (or `ConceptUpdated`, if the code already has a Deprecated/Retired history) still fires from there exactly as it does for a direct add — `OntologyValidated`/`SemanticConflictResolved` is a *second*, additional event describing the proposal's own review outcome, not a replacement for it.
- **Authority**: who can Accept/Reject isn't decided. The obvious default is the existing `ontology_define`/root gate (same as every other Ontology Management action) — but a proposal review arguably deserves its own noun_verb pair (`ontology_accept`/`ontology_reject`?) for a real accountability record distinct from plain authoring, matching this codebase's "every transition: real actor + badge" discipline. Needs a decision.
- **"The proposing user"**: the owner's own phrasing is "the user proposing the ontology" — for a Pack-originated proposal there is no single "proposing user" recorded today (`emitOntologyComposedIfUnregistered` publishes with no `actorId` at all). Whose view is "the proposer's own"? Candidates: the Pack's own `authored_by`, or anyone holding authoring rights on that Pack's tenant. Needs a decision — and probably means threading a real `actorId` into `emitOntologyComposedIfUnregistered`'s own publish call, which it doesn't do today.

## Open questions

- Should a Pack be blocked from Publishing/Activating while it has an unresolved (Pending or Rejected-not-yet-Accepted) proposal? Not raised by the owner; not assumed here either way.
- Where does this queue live in the nav — its own "Ontology > Proposals" entry (parallel to the new "Metadata" entry, CR-096), or folded into the existing Ontology Management page as another tab? Not decided.
- Does rejecting or accepting need its own badge-gated transition through `transitionEngine` (matching the real governed-transition discipline CR-095 built for concept lifecycle), or is a lighter, ungoverned action (like `updateConceptMeta`'s own plain check) enough, given there's no `ontology_concepts` row to gate a transition on before Accept actually creates one? Leans toward the latter (nothing to transition until Accept writes the row), but not settled.

## Not in scope

- `composeConcept`'s own `OntologyComposed` (`originatingObjectType: "Ontology"`) — a tenant's direct, already-reviewed Specialization/Override action; it keeps writing immediately, no review queue.
- CR-056's own gap (how a Pack *declares* a new category concept in the first place, e.g. `pack.contributions.ontologyCategories`) — a different, still-fully-undesigned problem one layer upstream of this one. This CR assumes the proposal already exists as an `OntologyComposed` event (which `emitOntologyComposedIfUnregistered` already produces today for the 9 existing Ontology-checked Pack fields) and is only about reviewing it.
- `OntologyComposed`'s own emission logic itself — already built (CR-079 step (d), event-name-corrected this session) — this CR is entirely about the missing consumer/reader side.


# OntologyConsumer Design

OntologyCompose should read the EventBus and create a decision record for creating the alternative. 
OntologyConsumer should follow the DecisionLifecycle. And if the decision is approved, insert a record in the Ontology. This should allow transition to publish. 