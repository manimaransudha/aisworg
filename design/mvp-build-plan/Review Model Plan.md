# Review Model — Plan (Phase 14)

*Produced 2026-08-11. Resolves item 3 / line 124 of `Spec Gap Analysis and Remaining Build Plan.md` (§3.2 Review Model, Ch.25). Planning document. Chapter references are to `03_Book 3 (Refined)/04_Part 4/Chapter 25.md`.*

## Resolved 2026-08-11 (decisions confirmed)

- **A — Synchronous governed entity.** A Review is created against an object and walked `Planned → … → Accepted` with an immutable outcome, the Evidence/Decision pattern; the reviewing Participant is recorded, not dispatched. (Async-dispatchable review is a clean later enhancement.)
- **B — Reuse the Quality Gate seam.** Required Reviews are Pack-contributed `quality_gates` with a new `requires_accepted_review` criteria type; composition-from-multiple-Packs is the deterministic gate composition that already exists — no dedicated requirements table.
- **C — Findings: auto-surface, manual convert.** A Finding is its own object (`Open → Resolved`/`Waived`); a High/Critical Finding auto-raises a deduped Attention Item and can be manually converted to an Obligation. No implicit auto-creation of Obligations.

These confirm the recommendations in §2/§5 below; the build follows the §4 sequence.

## 0. What Ch.25 is, and why it fits cleanly

A **Review** is a *governed evaluation* of an engineering object against declarative criteria. It **produces an outcome; it does not perform work and does not authorise it** (Ch.25 §1, RM-001). Governance **consumes** the outcome when evaluating a state transition (§3, §11) — exactly the shape the platform already uses for Evidence and Decisions. So the Review Model slots onto machinery that exists rather than introducing a new governance mechanism:

- It is one more **governed entity** with a polymorphic reviewed object and its own lifecycle — the same pattern as Obligation / Evidence / Decision (a table, a DB module, a `transitionReview` core function, `transition_definitions` rows, `TransitionEntityType` widened to a 13th value).
- Its integration with governance is one more **Quality Gate criteria type** — `requires_accepted_review` — evaluated by the `qualityGateEngine` that already runs before every transition. This is the "Governance consumes the Review outcome" seam (§3, §11), mirroring the existing `requires_accepted_evidence_or_approved_decision`.
- **Composition from multiple Packs (FR-25.7, §13)** rides on the existing Pack → `quality_gates` contribution: a Pack declares a gate whose criteria require a passing Review of a given category. Deterministic composition is already how gates compose.

The genuinely new pieces are the **Review entity + its immutable outcome**, **Findings** (independent traceable observations that can feed Obligations/Evidence/Decisions/follow-up Reviews, §12), and the **gate criteria type** that lets a Review outcome gate a transition.

## 1. Ch.25 → built-platform mapping

| Ch.25 requirement | How it lands |
|---|---|
| Review is a governed evaluation, polymorphic object (FR-25.1/25.2) | New `reviews` table with `(related_object_type, related_object_id)` — same polymorphic pattern as `obligations`/`evidence`/`decisions`. Review = 13th `TransitionEntityType`. |
| Lifecycle `Planned → Prepared → In Progress → Completed → Accepted → Archived` (§9) | `transition_definitions` rows for `Review`; generic `transitionEngine` enforces it. |
| Declarative criteria (FR-25.3, §10) | `criteria` JSONB on the review (required Deliverables/Evidence/Policies/standards) — interpreted by a small Review criteria evaluator, same spirit as `quality_gates.criteria`. |
| Outcome ∈ Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred (§11), immutable (FR-25.5) | `outcome` column set once at `Completed`; never mutated afterward (enforced in `transitionReview`). |
| Mandatory vs optional (FR-25.4) | A required Review is expressed as a Pack-contributed Quality Gate (`requires_accepted_review`); an optional Review is just a review with no gate referencing it. |
| Governance consumes the outcome (§3, §11) | New `qualityGateEngine` criteria type `requires_accepted_review`: a transition is gated on an **Accepted** Review (lifecycle) with a **passing** outcome (Passed / Passed with Recommendations) for the entity. |
| Findings (§12) — independent, traceable, may raise Obligations/Evidence/Decisions/follow-up Reviews | New `findings` table `(review_id, seu_id, related_object, severity, status, description)`; a Finding can raise an Obligation (reuse `createObligation`) and surfaces via Attention. |
| Composition from multiple Packs (FR-25.7, §13) | Pack → `quality_gates` contribution already composes deterministically; a review-requirement is a gate with the new criteria type. No new composition engine. |
| Traceability (§14, RM-005) | Reviews + Findings become edges the just-built Ch.20 traceability query joins (extend `explainDeliverable` to list Reviews/Findings for the object). |
| Events (§15) | `ReviewPlanned/Started/Completed/Passed/Failed/Deferred`, `FindingCreated/Resolved` via the existing `eventBus`. |
| Independent of Participants (RM-002) | The Review is *defined* independent of who performs it; who performs it is a separate concern (see Decision A). |

## 2. Decisions (proposed — the load-bearing ones are flagged for confirmation)

1. **[NEEDS DECISION — A] Review execution model: synchronous governed entity, or async dispatchable Work Item.**
   - **Option A1 — synchronous governed entity (like Evidence/Decision).** A Review is created against an object and walked through its lifecycle by the acting user via transition calls; the reviewing Participant is *recorded* (provenance) but the Review is not dispatched. Smallest; exactly the Evidence/Decision pattern; ships fastest.
   - **Option A2 — async dispatchable (reuse the Participant Integration seam).** A Review's `In Progress` is a dispatchable Work Item assigned to a reviewer Participant, who reports the outcome through the same `result-in` callback. Coherent with the async engine just built (a review *is* work a reviewer performs), and RM-002 supports it (the review is defined independent of the reviewer). Larger; introduces a "review" capability/execution-target dimension.
   - *Recommendation:* **A1 for this phase.** It fully satisfies Ch.25 (which is about the evaluation and its outcome, not about dispatch), keeps Phase 14 "modest" as the gap analysis scoped it, and leaves A2 as a clean later enhancement (a Review's lifecycle transition could itself become dispatchable under the existing Model-A machinery without reshaping the Review entity).

2. **[NEEDS DECISION — B] Review-requirement composition: reuse the Quality Gate seam, or a dedicated `review_requirements` table.**
   - *Recommendation:* **reuse the Quality Gate seam.** A Pack that requires "Architecture Review before Architecture Document reaches Baselined" contributes a `quality_gates` row with criteria `requires_accepted_review` (category `Architecture`). Composition-from-multiple-Packs (FR-25.7) is then the composition the gate engine already does, deterministically. No new requirements table, no second composition path.

3. **[NEEDS DECISION — C] Findings → downstream objects.**
   - *Recommendation:* a Finding is its own governed object with a small lifecycle (`Open → Resolved`, and `Waived`). A **blocking-severity** Finding (High/Critical) auto-raises an **Attention Item** (surfacing, deduped like the other Attention paths) and can be **manually converted to an Obligation** (`createObligation`) — rather than auto-creating Obligations, which would couple two governed lifecycles implicitly. Evidence/Decision links from a Finding are recorded but not auto-created.

4. **Outcome gates on Accepted + passing.** For `requires_accepted_review`, a review satisfies the gate only when its lifecycle is `Accepted` **and** its outcome ∈ {Passed, Passed with Recommendations}. `Rework Required`/`Failed` never satisfy; `Not Applicable` is treated as "no such requirement" (does not itself satisfy a *required* review — a required Architecture Review can't be dismissed as N/A); `Deferred` blocks. (Confirm the N/A semantics under Decision B's mandatory-review framing.)

5. **Category is Pack-extensible free text**, seeded with the eight Ch.25 §7 categories as the known set — same posture as every other `category` field (Obligation/Evidence/Decision) and consistent with "additional categories may be introduced through Packs."

6. **No new states beyond Ch.25 §9.** The six-state lifecycle is seeded through the Transition Definition SDK (authorable), not hardcoded — same as every other entity.

## 3. What is new vs. extension

**Extension of existing machinery:** the generic `transitionEngine` + `transition_definitions` (Review is a new entity type), the `qualityGateEngine` (one new criteria type), Pack → `quality_gates` contribution (composition), the `eventBus`, the polymorphic `(related_object_type, related_object_id)` pattern, the Ch.20 traceability query (extended to include Reviews/Findings), and `createObligation`/`raiseAttentionItem` for Findings.

**Genuinely new:** the `reviews` table + DB module + `transitionReview` core (with immutable-outcome enforcement); the `findings` table + DB module + `transitionFinding`/`resolveFinding`; the `requires_accepted_review` Quality Gate criteria type; Review/Finding API + a web surface; the Review criteria evaluator (declarative criteria interpreted at Completion).

## 4. Build sequence

Naming continues the phase scheme (Phase 14).

**Standing check (every step):** a Review never modifies the reviewed object (RM-001, §17); a completed Review's outcome is immutable (FR-25.5); Findings are independently traceable (§12, §17). Any step that violates one of these fails regardless of whether the feature "works."

1. **Review entity + lifecycle.** `reviews` table (polymorphic object, `criteria` JSONB, `outcome`, `status`, `version`, provenance), `Review` as the 13th `TransitionEntityType`, `transition_definitions` for the six-state lifecycle, `transitionReview` core (sets/*freezes* the outcome at `Completed`; rejects any outcome change afterward). Events. *Done when:* a Review can be created against a Deliverable, walked `Planned → … → Accepted` with an immutable outcome, and never mutates the Deliverable.
2. **Quality Gate integration (`requires_accepted_review`).** New criteria type in `qualityGateEngine`; a transition gated on it blocks until an Accepted+passing Review of the required category exists for the entity. *Done when:* a Deliverable transition with a required Architecture Review is blocked without it and allowed once the Review is Accepted+Passed — independently of Evidence/Decisions.
3. **Findings.** `findings` table + lifecycle (`Open → Resolved`/`Waived`), raised during/after a Review; a High/Critical Finding auto-raises an Attention Item and can be converted to an Obligation. *Done when:* a Review can generate a Finding, the Finding is traceable to its Review and object, and a blocking Finding surfaces on the Attention inbox.
4. **Pack-contributed review requirements (FR-25.7 composition).** A Pack declares a required Review via a `quality_gates` contribution with `requires_accepted_review`; multiple Packs compose deterministically. *Done when:* two Packs each requiring a Review on the same transition compose into both being required, on one core.
5. **Traceability + API + web surface.** Extend `explainDeliverable` to list the object's Reviews and Findings; Review/Finding REST endpoints; a web page to plan/run/accept a Review and manage Findings. *Done when:* Ch.20's "explain this Deliverable" shows the Reviews that gated it and the Findings they produced.

## 5. Open decisions (for confirmation before build)

- **A — Review execution: synchronous (recommended) or async-dispatchable?** Determines whether Phase 14 stays modest or pulls the reviewer-as-dispatched-Participant tie-in forward.
- **B — Composition: reuse the Quality Gate seam (recommended) or a dedicated `review_requirements` table?**
- **C — Findings: auto-raise Attention + manual→Obligation (recommended), or auto-create Obligations?**
- **Scope of a Review's declarative criteria evaluator (§10):** how much the platform *interprets* (e.g., "required Evidence present") vs. records for the reviewer to judge. Recommend: record criteria + let the reviewer set the outcome for MVP; auto-interpret only "required Evidence attached" as a light structural check.
