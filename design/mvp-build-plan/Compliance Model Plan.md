# Compliance Model — Plan (Phase 15)

*Produced 2026-08-12. Resolves item 4 / §3.1 of `Spec Gap Analysis and Remaining Build Plan.md` (Ch.27 Compliance Model). Planning document. Chapter references are to `03_Book 3 (Refined)/04_Part 4/Chapter 27.md`.*

## Resolved 2026-08-12 (decisions confirmed)

- **A — Declarative criteria, reusing the existing resolvers.** A Compliance Requirement carries a criteria JSONB the `complianceEngine` interprets by reusing the same predicates `qualityGateEngine` uses (obligations/evidence/decisions/reviews/policies), generalised to SEU scope. Literally CM-002/§8.
- **B — On-demand compute + immutable snapshot.** Evaluation is a pure function of current state, so computing on evaluate/report is continuous by construction (§12); each run persists an immutable snapshot for reproducible history (FR-27.6). Event-driven auto-eval is a later add.
- **C — Waivers + minimal conflict detection.** Waivers are in scope (they are the "Compliant with Exceptions" state); conflict detection is minimal (same requirement code with differing criteria, or explicit `conflictsWith`, reported not resolved).

These confirm the recommendations in §2/§5; the build follows the §4 sequence.

## 0. What Ch.27 is, and why it is mostly composition

Ch.27 is explicit that **Compliance is not a new object** (§4, CM-002): *"Compliance therefore composes existing architectural concepts rather than introducing new ones"* (§8), and is *"an emergent capability of the platform rather than an isolated subsystem"* (§1). A Compliance Pack contributes **Policies, Authority Rules, Review Requirements, Quality Gates, Obligations, Evidence Requirements** (§8) — every one of which the platform already has, most of them already Pack-contributed. Compliance status is *evaluated from the combined governance model* (§3) and *derived from engineering state rather than maintained separately* (§12).

So Phase 15 is small at its core and adds only what genuinely does not exist yet:

- A **declarative Compliance Requirement** grouped into a **Compliance Framework**, contributed through Packs (FR-27.1) — the one new persisted model.
- A **Compliance Evaluation engine** that maps each applicable requirement onto existing engineering state (resolved Obligations, Accepted Evidence, passing Reviews, satisfied Quality Gates, approved Decisions) and rolls the results up into an SEU **Compliance Status** with rationale (§9, §10). It **reuses the resolvers the `qualityGateEngine` already uses** — it does not re-implement governance.
- **Immutable evaluation snapshots** for reproducible history (FR-27.6) + the compliance **events** (§15).
- **Waivers** (§9 "applicable waivers", §15 `ComplianceWaiverGranted`) — what turns an unsatisfied requirement into "Compliant with Exceptions."
- A **report** derived from the evaluation (§12) and **traceability** (§13).
- Minimal **conflict detection** (FR-27.7).

The evaluation **never modifies engineering state** (§9) — exactly like the Review Model's outcome, and unlike a Quality Gate it does not *block* a transition; it *observes and reports*.

## 1. Ch.27 → built-platform mapping

| Ch.27 requirement | How it lands |
|---|---|
| Requirements contributed through Packs (FR-27.1); Frameworks (§7); compose existing primitives (§8) | New `compliance_frameworks` + `compliance_requirements` tables, Pack-contributed via `PackContributions` (a Compliance-category Pack already exists as a `PackCategory`). A requirement carries a **declarative criteria** JSONB (the composition), not new governance. |
| Multiple frameworks simultaneously (FR-27.2) | Frameworks are independent rows; an SEU's applicable set is the union contributed by its composed Packs. |
| Deterministic evaluation (FR-27.3); evaluated from the combined governance model (§3, §9) | A `complianceEngine` that, per requirement, runs a declarative criteria evaluator **reusing the obligations/evidence/decisions/reviews/quality-gate resolvers** already in `qualityGateEngine`. Pure function of current state → deterministic. |
| Never modifies engineering state (§9) | The engine only reads; it writes only its own snapshot/status records. |
| Compliance status ∈ Compliant / Compliant with Exceptions / Partially Compliant / Non-Compliant / Compliance Unknown, with rationale (§10) | Roll-up rule over per-requirement results + active waivers; rationale is the list of satisfied/unsatisfied/waived requirements. |
| Continuously evaluated throughout the SEU lifecycle (FR-27.4, CM-004) | Evaluation is a **pure function of current state**, so an on-demand evaluate/report always reflects "now" (continuous by construction). [Decision B: whether to also auto-evaluate on events.] |
| Reproducible for any historical point in time (FR-27.6); immutable history (§13) | Each evaluation persists an **immutable snapshot** (`compliance_evaluations`) with its per-requirement results + status + timestamp. |
| Waivers (§9, §15) | New `compliance_waivers` (requirement + SEU + rationale + who + optional expiry); an active waiver moves an unsatisfied requirement to "waived," driving "Compliant with Exceptions." |
| Conflicts detected & reported (FR-27.7) | Minimal: two applicable requirements with the same `code` but differing criteria (or an explicit `conflictsWith`) are reported. [Decision C.] |
| Compliance evidence references Reviews/Deliverables/Decisions/Policies/Gates/Obligations/Evidence/Traceability (§11); reporting (§12); traceability (§13) | The evaluation snapshot records, per requirement, *which* engineering records satisfied it (ids) — that is both the evidence and the traceability, and the report is a projection of it. |
| Events (§15) | `ComplianceEvaluated / ComplianceSatisfied / ComplianceViolationDetected / ComplianceWaiverGranted / ComplianceStatusChanged / ComplianceReportGenerated` via the `eventBus`. |
| Independent of specific frameworks (CM-006) | Frameworks/requirements are pure data + declarative criteria; no framework (GDPR/SOC2/…) is hardcoded. |

## 2. Decisions (proposed — load-bearing ones flagged)

1. **[NEEDS DECISION — A] How a Compliance Requirement's satisfaction is expressed.**
   - **A1 — declarative criteria reusing the existing resolvers (recommended).** A requirement carries a criteria JSONB interpreted by the `complianceEngine`, reusing the exact predicates the `qualityGateEngine` already has, generalised to SEU scope: e.g. `no_unresolved_obligations` (optionally by category), `requires_accepted_evidence`, `requires_accepted_review` (by category), `requires_approved_decision`, `quality_gate_passed` (by gate code), `policy_present`. This is CM-002/§8 literally ("composes existing concepts"), maximises code reuse, and stays framework-independent. New criteria types are additive.
   - **A2 — a requirement is a reference to an existing Quality Gate / Obligation type.** Simpler but less expressive and couples compliance to gate rows.
   - *Recommendation: A1.*

2. **[NEEDS DECISION — B] Continuous evaluation (FR-27.4): on-demand + snapshots, or also event-driven auto-evaluation.**
   - **B1 — on-demand compute + snapshot on evaluate/report (recommended).** Because evaluation is a pure function of current state, computing it when queried/reported always reflects "now" — that satisfies "continuously evaluated" and "derived from engineering state" (§12), and each run persists an immutable snapshot (FR-27.6). Lightest; no scheduler/subscriber.
   - **B2 — also auto-evaluate on key events.** An `eventBus` subscriber re-evaluates + snapshots + emits `ComplianceStatusChanged` when a relevant event fires (DeliverableTransitioned, ObligationTransitioned, EvidenceTransitioned, ReviewPassed, …). More "active," but adds a subscriber and re-evaluation cost per event.
   - *Recommendation: B1 for this phase* (on-demand is genuinely continuous for a state-derived model); B2 is a clean later add on the same engine, and `ComplianceStatusChanged` can be emitted when an on-demand evaluation differs from the last snapshot.

3. **[NEEDS DECISION — C] Scope of Waivers and Conflict detection (FR-27.7).**
   - **C1 — Waivers now, minimal conflict detection now (recommended).** Waivers are load-bearing (they are the whole "Compliant with Exceptions" state) so they are in scope. Conflict detection is scoped minimally: two applicable requirements sharing a `code` with differing criteria, or an explicit `conflictsWith`, are reported (not resolved). Deep semantic conflict analysis is deferred.
   - **C2 — Waivers now, defer conflict detection entirely.**
   - *Recommendation: C1.*

4. **Compliance is per-SEU and read-only.** Evaluation runs for one SEU against its composed Packs' requirements, over that SEU's engineering objects. It observes and reports; it never blocks a transition (that is the Quality Gate's job) and never mutates state (§9). A framework may *also* have contributed real Quality Gates that DO block — but that is the gate doing its job, separate from the compliance read-out.

5. **Requirement lifecycle (§14).** `Defined → Composed → Evaluated → Satisfied → Superseded → Archived` applies to the *requirement definition's* lifecycle (Pack authoring/versioning), largely mirroring how Pack-contributed objects already version. For MVP the requirement rows are Pack-managed (Composed when a Pack is published, Superseded/Archived on new versions) — the rich per-requirement lifecycle governance is a light follow-up; the *evaluation* (not the definition) is the active surface.

## 3. What is new vs. extension

**Extension of existing machinery:** the resolvers behind `qualityGateEngine` (obligations/evidence/decisions/reviews), the Pack contribution pipeline (`PackContributions` + `publishPack`), the `eventBus`, the polymorphic patterns, the Ch.20 traceability query, and the existing Policy/Authority/Quality-Gate/Obligation/Evidence/Review models compliance composes.

**Genuinely new:** `compliance_frameworks` + `compliance_requirements` (Pack-contributed, declarative) + `compliance_waivers` + immutable `compliance_evaluations` snapshots; the `complianceEngine` (deterministic evaluator + status roll-up, reusing existing resolvers); compliance criteria types; the compliance report projection; conflict detection; the API + a web surface; the compliance events.

## 4. Build sequence

Naming continues the phase scheme (Phase 15).

**Standing check (every step):** evaluation never modifies engineering state (§9); evaluation is deterministic (FR-27.3); an evaluation snapshot is immutable (§13); no regulatory framework is hardcoded (CM-006).

1. **Compliance Framework + Requirement model, Pack-contributed.** Tables + DB + `PackContributions` extension + `publishPack` wiring; a Compliance-category Pack contributes a framework and its requirements (declarative criteria). *Done when:* publishing a compliance Pack registers a framework and its requirements; two Packs' frameworks coexist (FR-27.1/27.2).
2. **Compliance evaluation engine + status.** `complianceEngine.evaluate(seuId)` → per-requirement satisfied/unsatisfied (reusing existing resolvers), rolled up to a status (§10) with rationale; deterministic; read-only. *Done when:* an SEU with an unresolved Security obligation evaluates Non-Compliant/Partially Compliant against a Security framework, and Compliant once resolved — deterministically, without touching engineering state.
3. **Immutable snapshots + events + reproducible history.** Persist each evaluation; emit `ComplianceEvaluated`/`ComplianceStatusChanged`/`ComplianceViolationDetected`/`ComplianceSatisfied`. *Done when:* successive evaluations leave an immutable, timestamped history a query can reproduce (FR-27.6).
4. **Waivers.** Grant a waiver against a requirement for an SEU (rationale, actor, optional expiry) → the requirement reads "waived" and the SEU rolls up to "Compliant with Exceptions"; emit `ComplianceWaiverGranted`. *Done when:* a waived unsatisfied requirement moves the status from Non-Compliant to Compliant with Exceptions, traceably.
5. **Conflict detection (FR-27.7).** Report applicable requirements that conflict (same code, differing criteria, or explicit `conflictsWith`). *Done when:* two frameworks contributing a conflicting requirement surface a reported conflict without breaking evaluation.
6. **Report + traceability + API + web surface.** A compliance report projection (§12); extend Ch.20 traceability where useful; REST endpoints; a web page (framework list + per-requirement status + waivers + report). *Done when:* a report generated purely from engineering state lists applicable frameworks, satisfied/outstanding requirements, waivers, and supporting record ids (§11/§12), with `ComplianceReportGenerated` emitted.

## 5. Open decisions (for confirmation before build)

- **A — Requirement satisfaction: declarative criteria reusing existing resolvers (recommended) vs. requirement-as-gate-reference?**
- **B — Continuous evaluation: on-demand + snapshots (recommended) vs. also event-driven auto-evaluation?**
- **C — Waivers now + minimal conflict detection (recommended) vs. waivers now + defer conflict detection?**
- **Reporting surface depth:** JSON report + a web page (recommended) — any specific report fields/format a first framework needs, or is the §12 field list sufficient for MVP?
