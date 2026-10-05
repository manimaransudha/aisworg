# Chapter 25 – Review Model: Implementation Traceability

**Date of report: 4-10-2026**

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review evaluates whether an engineering object may progress to its next lifecycle state, without performing or authorising engineering work itself<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:1-10, 408-415 (chapter §20 "19.1")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>UPDATE</code> to any reviewed-object table (<code>deliverablesDB</code> etc.) exists in <code>core/reviews.ts</code>/<code>core/findings.ts</code>; only <code>reviews</code>/<code>findings</code> rows themselves are mutated. The evaluative role is structurally real (no side effects on the object), but the *evaluation* itself is not computed — see RM-006 row below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review outcomes are produced for consumption by the Governance Model, not to directly drive the engineering object's own state<br> Ref: §1 Purpose, Architectural Position §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/qualityGateEngine.ts:129-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>requires_accepted_review</code> criteria type blocks a governed transition unless an <code>Accepted</code> Review with a qualifying outcome exists. Governance, not the Review, gates the transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-001: Reviews are evaluations (no side effects)<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts (no UPDATE outside <code>reviews</code> table)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as Purpose row above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-002: Reviews are independent of Participants<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts <code>ReviewRow.reviewer</code> (free text); <code>transition_definitions WHERE entity_type='Review'</code> → <code>required_authority_rule_id</code> NULL on all rows</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reviewer</code> is a free-text field, not a Participant FK, and no authority rule gates the Review lifecycle. Independence holds, but only because no coupling was ever built, not because an enforced boundary exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-003: Reviews are repeatable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reviews</code> table schema — no unique constraint on <code>(related_object_type, related_object_id)</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Reviews against the same object are structurally unconstrained.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-004: Reviews are composable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1032-1061, reviewGatesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seedContributions</code> processes <code>seed.contributions.reviewGates</code>, upserting into a real <code>review_gates</code> table with <code>originating_pack_id</code>. Composition is override-on-collision per <code>(entity_type, from_state, to_state, code)</code> slot, not a union-merge of multiple Packs' Review Gates for the same slot.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-005: Reviews preserve complete traceability<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts <code>ReviewRow</code>; <code>findings.review_id</code> reverse FK</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the 8 traceability fields named in §14, 4 are real (reviewed object, criteria-as-stored, generated Findings, timestamp); supporting Evidence, related Decisions, reviewing Participants, and EBM version have no column/FK.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RM-006: Review outcomes are reproducible<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:144-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>outcome</code> is supplied directly by the API caller at the Completed transition (<code>completeWithOutcome</code>); nothing derives it from <code>criteria</code> or any other input. A Review is a recorded verdict, not a computed, reproducible evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.1: every Review has a globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (<code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Standard UUID primary key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.2: Reviews support multiple engineering object types<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>related_object_type</code>/<code>related_object_id</code> typed as <code>TransitionEntityType</code>; src/routes/seu/core/qualityGateEngine.ts:136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Polymorphic in schema and consumed generically, but live data is 100% <code>Deliverable</code> (66/66 rows) — the polymorphism is unexercised in practice.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.3: Review criteria are declarative<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>criteria JSONB</code> column; grep confirms only a write-on-create and pass-through, no interpreter</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Structured, declarative *storage* exists. No schema is enforced for its shape and nothing reads it back to interpret it — declarative storage without a declarative engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.4: Reviews may be mandatory or optional<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reviews</code> table schema</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>mandatory</code>/<code>is_optional</code> column exists anywhere on <code>reviews</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.5: Review outcomes remain immutable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:144-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>completeWithOutcome</code> is the only write path for <code>outcome</code>; a transition is rejected with <code>outcome_immutable</code> once <code>outcome</code> is already set.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.6: Reviews preserve complete provenance<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ReviewRow.reviewer</code>/<code>created_at</code>/<code>updated_at</code>/<code>version</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reviewer</code>, timestamps, and <code>version</code> are captured on the row itself; there is no actor-ID chain on the Review row (only on the transition event that produced it).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-25.7: Reviews support composition from multiple Packs<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1032-1061; migration <code>097_review_gate_table.sql</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>PackContributions.reviewGates</code> is seeded in ~20 Pack JSON files and now processed by <code>seedContributions</code> (CR-059), upserted into <code>review_gates</code> with <code>originating_pack_id</code>. Previously a documented gap (type defined, seeded, parsed by SDK authoring, never read); now wired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Illustrative Review Categories are an open, Pack-extensible set<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts (no <code>assertCanonicalCategory</code> call); <code>ontology_concepts</code> has no <code>category:review</code> concept type</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>reviews.category</code> is free <code>TEXT</code>, the one categorized entity in the codebase with no Ontology backing (unlike Deliverable/Obligation/Knowledge/Decision/Evidence, which all validate category). The authoring form hardcodes the chapter's 8 category names in a plain <code><select></code>. Settled as by-design under CR-059: the one place category needed disambiguating power (Quality Gate's <code>requires_accepted_review</code>) was rebuilt to key off <code>deliverableName</code>/<code>review_gates.code</code> instead, so category itself was deliberately left unmigrated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review Gate names the governed transition requiring a Review, and may reference Checklists scoped to its own Pack<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">migration <code>097_review_gate_table.sql</code>; src/dblayer/checklistsDB.ts <code>findByPackCode</code>; src/routes/seu/core/packs.ts <code>validateChecklistIds</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>review_gates</code> carries <code>checklist_ids UUID[]</code>/<code>recommended_checklist_ids UUID[]</code>; <code>validateChecklistIds</code> resolves an entry only against a Checklist whose owning Pack's <code>code</code> matches the gate's own Pack <code>code</code>. Referential integrity is enforced at publish time (<code>validatePackSeed</code>), not by a DB-level array FK.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Checklist is a Pack-contributed ordered set of verification statements; executing it produces Evidence, not a direct Governance reference; it has no independent version/lifecycle<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">migration <code>100_checklist_table.sql</code>; src/dblayer/checklistsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>checklists</code> table has no <code>version</code>/<code>is_active</code>/lifecycle column by design — both inherited from the originating Pack. Live item shape is <code>{"statement": "..."}</code> only (migration <code>104_checklist_item_simplified.sql</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">checklistIds is AND-required, recommendedChecklistIds is advisory-only, and a Checklist shared by multiple gates executes once for all of them<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">migrations <code>101_gate_checklist_ids.sql</code>, <code>103_gate_recommended_checklist_ids.sql</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Columns exist on both <code>review_gates</code> and <code>quality_gates</code>. No direct evidence was found in this pass of the "AND" gating logic or single-execution-satisfies-all-gates consumption path (outside this chapter's own cited scope); not independently re-traced here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Review transitions through Planned → Prepared → In Progress → Completed → Accepted → Archived, and historical Reviews remain permanently available<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transition_definitions WHERE entity_type='Review'</code> (5 rows, exact chain); src/dblayer/reviewsDB.ts (no delete function)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Live transition rows match the chapter's 6-state chain exactly. No delete path exists anywhere in <code>reviewsDB.ts</code>, so permanence holds by omission of any delete capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review criteria are interpreted by the Review service<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">grep of <code>criteria</code> usage across <code>core/reviews.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a write-on-create and a pass-through parameter exist; no code reads <code>criteria</code> back to interpret it. The interpretation that does exist (<code>qualityGateEngine.ts</code>'s <code>requires_accepted_review</code>) consumes a Review's <code>outcome</code>, not its <code>criteria</code> field — a different mechanism than the one the chapter describes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review produces one of six defined outcomes, consumed by Governance when evaluating a state transition<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>CHECK (outcome IS NULL OR outcome IN (...))</code> constraint; src/routes/seu/core/qualityGateEngine.ts:129-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 6 outcomes are enforced by a DB constraint; <code>requires_accepted_review</code> blocks a transition unless an <code>Accepted</code> Review has a qualifying outcome. Live data exercises 3 of 6 plus NULL.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Findings are independent, traceable engineering objects, and may lead to new Obligations, Evidence requests, Decisions, or follow-up Reviews<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/findingsDB.ts; src/routes/seu/core/findings.ts:113-130 (<code>convertFindingToObligation</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Finding is a real, separate first-class entity with its own table, lifecycle (<code>Open→Resolved</code>, <code>Open→Waived</code>), and API. Finding→Obligation is a real, idempotency-guarded, human-triggered path. Finding→Evidence requests, Finding→Decisions, and Finding→follow-up Reviews have no code path at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Review requirements (from multiple Packs) compose deterministically into effective requirements<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1032-1061; <code>review_gates</code> unique active-slot index shared with <code>quality_gates</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition exists as override-on-collision per <code>(entity_type, from_state, to_state, code)</code> slot (last upsert wins) via a deactivate-then-insert transaction — deterministic, but not a union-merge of multiple Packs' requirements for the same slot.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Review preserves reviewed object, criteria, supporting Evidence, generated Findings, related Decisions, reviewing Participants, timestamp, and EBM version; history is immutable<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts <code>ReviewRow</code>; <code>findings.review_id</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">4 of 8 fields are real (reviewed object, criteria-as-stored, generated Findings via reverse FK, timestamp). No FK/link exists to Evidence or Decisions; reviewing Participants is free-text only; no EBM-version column exists. History immutability holds (no delete path, outcome immutable once set).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewPlanned, ReviewStarted, ReviewCompleted, ReviewPassed, ReviewFailed, ReviewDeferred, FindingCreated, FindingResolved<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:43,121-123,129,151-153; src/routes/seu/core/findings.ts:39,94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 8 named events are real, distinct literals, each via <code>eventBus.publish</code>. Live query confirms 7 of 8 have fired at least once (<code>ReviewDeferred</code> is code-real but unexercised).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review Model supports deterministic execution, multiple review types, complete traceability, concurrent Reviews, and independence from Participant implementations<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">reviews.ts (outcome caller-supplied); reviews.category free text; ReviewRow fields; no uniqueness constraint; <code>reviewer</code> free text</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No execution logic exists to be deterministic (outcome is caller-supplied, not computed). Multiple review types exist but are free-text, not Ontology-governed. Traceability is 4 of 8 fields. Concurrent Reviews and Participant-independence both hold structurally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Reviews evaluate without modifying the reviewed object; criteria are declarative; outcomes are immutable; Findings are traceable; multiple Review Packs compose; history remains permanently available<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each criterion individually holds only in the qualified sense documented in its own row above (e.g. criteria is declarative-as-stored but not interpreted; composition is override-on-collision, not union-merge).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 25
- Fully met: 9
- Partially met: 12
- Not met: 3
- Not verifiable: 1

## Major Implementation Gaps

1. **Review is not actually an evaluation.** `outcome` is supplied directly by the API caller; `criteria` is stored but never interpreted by anything (RM-006, FR-25.3, §11). The chapter's central framing — that a Review *determines* whether criteria are satisfied — does not hold; Governance's own `requires_accepted_review` mechanism consumes outcome, not criteria.
2. **Review Category has no Ontology backing**, the only categorized entity in the codebase in this position. Settled by design decision (CR-059): the one place category needed disambiguating power was rebuilt to key off `deliverableName` instead, so this is a deliberate, not overlooked, gap.
3. **§8 Review Structure is 5 of 13 fields short** (no Scope, Required Evidence, Required Participants, Recommendations column; Version exists but is never incremented).
4. **Finding's richer outcomes are 2 of 4 unbuilt** (Evidence requests and follow-up Reviews have no code path; only Obligation conversion and automatic Attention Items exist).
5. **Composition (RM-004, §14) is override-on-collision, not a union-merge** — multiple Packs contributing a Review Gate for the same slot do not get merged effective requirements, the later one simply wins.
6. Positive: **Findings** (own entity, lifecycle, table) and **Events** (all 8 named events real, 7 of 8 live-exercised) both match the chapter's intent closely.
