# Spec Gap Analysis & Remaining Build Plan — SEU Commissioning Platform

*Produced 2026-08-11 by cross-referencing `03_Book 3 (Refined)` (all 46 chapters, by current file-name numbering) against the actual repo at `/Volumes/Chennai/gitrepo/aisworg` (migrations `002`–`021`, `src/domain/engine`, `src/routes/seu`, `src/dblayer`, `tests/`), plus the `mvp-build-plan/` phase docs. Read-only: no code was written, no application was run. This is a planning document.*

## 0. Method and confidence

Built-state was established three ways and only claimed where two agree: the numbered migrations (each phase added a numbered SQL file, so the migration list is a near-authoritative "what has a schema"), the engine/route/dblayer file inventory, and the test suite (25 test files). Where all three are silent on a chapter's feature, it is reported as **Absent**. Where the schema/data exists but the chapter's *functional requirements* aren't realised, it is reported as **Partial** with the specific FR. This was not verified by running the app — see §6 for the one place that matters.

The Post-MVP Build Sequence doc stops at Phase 9 with markers; the repo has moved well past it (migrations to `021`). Phases 10 (Dual Authority / Badge Model, `012`), SDK Authoring/UI (`013`–`016`), a Metric-Registry Telemetry expansion (`017`–`020`), and Participant Lifecycle Governance (`021`) are all built and tested, confirming "everything prior to Phase 11/12 is complete." The gaps below are therefore of three kinds: **(a)** whole models the completed phases deliberately deferred, **(b)** partial realisations inside "done" phases, and **(c)** the two known pending phases.

## 1. Chapter coverage map (all 46)

| Ch | Model | Status | Delivered by |
|---|---|---|---|
| 1 | Objective | ✅ Built | MVP + Phase 1 (`003`) |
| 2 | SEU | ✅ Built | MVP (`002`) |
| 3 | Engineering Behavior Model | 🟡 Partial | MVP (`ebms`) — see §4.1 |
| 4 | Composition Engine | ✅ Built | MVP (`compositionEngine`) |
| 5 | Pack Model | ✅ Built | MVP + Phase 9 (`010`) |
| 6 | Template Model | ✅ Built | MVP |
| 7 | Profile Model | ✅ Built | MVP |
| 8 | SEU Commissioning | ✅ Built | MVP |
| 9 | Dependency Engine | ✅ Built | MVP + Phase 2 |
| 10 | Capability Model | ✅ Built | MVP |
| 11 | Service | ✅ Built | MVP + Phase 2 (`004`) |
| 12 | Capability Fulfilment | ✅ Built | MVP |
| 13 | Participant Model | ✅ Built | MVP + Participant Lifecycle (`021`) |
| 14 | Engineering Collaboration | ✅ Built | Phase 5 (descriptive; satisfied by eventBus) |
| 15 | Deliverable Model | ✅ Built | MVP + Phase 5 |
| 16 | Knowledge Model | ✅ Built | Phase 5 + Phase 6 (`007`,`008`) |
| 17 | Evidence Model | ✅ Built | Phase 5 (`007`) |
| **18** | **Ontology Model** | **❌ Absent** | deferred Phase 5 — see §3.3 |
| 19 | Decision Model | ✅ Built | Phase 5 (`007`) |
| **20** | **Traceability Model** | **🟡 Partial** | data exists; query capability absent — see §3.4 |
| 21 | Governance Model | 🟡 Partial | sum of parts; umbrella FRs partial — see §4.2 |
| 22 | Authority Model | ✅ Built | Phase 4 + Phase 10 (`006`,`012`) |
| 23 | Obligation Model | ✅ Built | Phase 4 (`006`) |
| 24 | Policy Model | ✅ Built | Phase 4 |
| **25** | **Review Model** | **❌ Absent** | deferred Phase 4 — see §3.2 |
| 26 | Quality Gate Model | 🟡 Partial | built; can't gate Pack/Objective — see §4.3 |
| **27** | **Compliance Model** | **❌ Absent** | deferred Phase 4 — see §3.1 |
| 28 | Runtime Kernel | ✅ Built | Phase 3 |
| 29 | State Management | ✅ Built | MVP (`transition_definitions`) |
| 30 | Event Model | ✅ Built | MVP (`events`) |
| 31 | Execution Engine | 🟡 Partial | pipeline built; no real runtime — see §3.5 |
| 32 | Work Item Model | ✅ Built | Phase 3 (`005`) |
| 33 | Dispatch Engine | 🟡 Partial | trivial strategy only — see §4.4 |
| 34 | Attention Management | 🟡 Partial | no routing/escalation — see §4.5 |
| 35 | Engineering Telemetry | ✅ Built | Phase 7 + Metric Registry (`017`–`020`) |
| 36 | External Interaction | 🟡 Partial | manual only, no adapters — see §4.6 |
| 37 | SEU Lifecycle Mgmt | ✅ Built | MVP |
| 38 | Pack Platform Arch | 🟡 Partial | no signatures/PKI — see §4.7 |
| 39 | Pack SDK Arch | ✅ Built | Phase 9 + SDK Authoring (`013`–`016`) |
| 40 | Security Architecture | ✅ Built | Phase 10 Dual Authority (`012`) |
| 41 | Version Management | 🟡 Partial | object-level immutability not generalised — see §4.8 |
| **42** | **Multi-Tenancy** | **❌ Absent (Phase 12)** | tenant stub only (`012`) — see §3.7 |
| **43** | **Deployment Architecture** | **❌ Absent (Phase 11)** | — see §3.6 |
| **44** | **Reliability & Continuity** | **❌ Absent (Phase 11)** | — see §3.6 |
| 45 | Reference Architecture | 📖 Descriptive | consolidation, not a build target — §5 |
| 46 | Platform Evolution Strategy | 📖 Descriptive | principles; overlaps Ch.41 — §5 |

**Summary:** 30 Built, 10 Partial, 4 Absent-substantive (18, 25, 27, and the query half of 20), 3 Absent-pending-phase (42, 43, 44), 2 Descriptive. The autonomous runtime gap (§3.5) cross-cuts and is the single most consequential item.

## 2. How to read the plan

The gaps are ordered below by **what unblocks what**, not by chapter number. Two of them (§3.5 autonomous runtime, §3.1 Compliance) are large enough to be their own phases. The rest cluster naturally. Every deferral was a deliberate, documented decision in its originating phase — none is a bug or an oversight; the question this plan answers is only *what is left and in what order it is worth taking up*.

## 3. Substantive gaps (whole models / foundational)

### 3.1 Compliance Model (Ch.27) — Absent — largest object-model gap
No compliance module, table, or route exists (`grep` for compliance modules returns nothing). Ch.27 specifies a full model: Compliance Frameworks and Requirements **contributed through Packs** (FR-27.1), **multiple frameworks simultaneously** (FR-27.2), **continuous evaluation throughout the SEU lifecycle** (FR-27.4), traceable compliance evidence (FR-27.5), **reproducible historical compliance status for any point in time** (FR-27.6), and conflict detection (FR-27.7). This is the compliance behaviour category the EBM (Ch.3 §7) already names but nothing fulfils. Sizeable: a new object model plus a continuous-evaluation engine plus a Pack contribution type. Depends on Evidence (built) and reads cleanly onto the Quality Gate mechanism, but is genuinely new scope.

### 3.2 Review Model (Ch.25) — Absent
No review module/table. Ch.25 specifies Architecture/Security/Code/Design Reviews as governed behavioural patterns that produce outcomes feeding governance (a Review that gates a transition, or produces a Decision). Phase 4 explicitly cut it: Quality Gates reference Obligations directly instead of Review outcomes. Smaller than Compliance; slots onto the existing Quality Gate + Decision machinery (a Review is close to a governed entity whose completed outcome a Quality Gate can require, exactly as it already requires an accepted Evidence or approved Decision).

### 3.3 Ontology Model (Ch.18) — Absent
No ontology module/table. Every `category` field across Deliverable/Evidence/Knowledge/Decision/Obligation is free text. Ch.18 specifies a shared concept vocabulary so multiple Packs don't contribute conflicting terminology. Phase 5 deferred it explicitly with the correct trigger: revisit "only if multiple Packs contributing conflicting terminology becomes a real problem." Low priority until there are enough independent Packs for terminology to actually collide — which is itself downstream of the Pack platform maturing and multi-org use (Multi-Tenancy).

### 3.4 Traceability Model query capability (Ch.20) — Partial
The *data* for traceability exists everywhere (FK relationships across every entity, the append-only `events` log with correlation/causation ids). What is **absent** is the queryable capability Ch.20's FRs require: **forward navigation** (FR-20.3), **backward navigation** (FR-20.4), **impact analysis** (FR-20.5), permanent relationship provenance (FR-20.7), historical relationship queries (FR-20.6) — the "single logical Engineering Knowledge Graph" its opening Decision names. There is no traceability engine, query surface, or UI. This is a read-model/query build over data that already exists, not a new persistence model, so it is comparatively cheap for the governance value it unlocks (impact analysis especially).

### 3.5 Autonomous Participant runtime (Ch.31 execution) — Partial — the foundational gap
`dispatchEngine` states it directly: *"No autonomous Participant runtime exists yet … execution is simulated synchronously in the same call."* The Command → Work Item → Dispatch pipeline is real and governed, but at the point where an assigned AI Participant would actually *do the engineering work*, the platform simulates the Work Item lifecycle (`Generated → … → Disposed`) instantly rather than invoking a real agent that produces the Deliverable content. **The platform today commissions, governs, and tracks engineering — it does not yet perform it.** This is the difference between the governance shell (built) and an operating engineering organisation (not yet). It is architecturally the largest and most consequential remaining item, and it is not on the numbered phase list at all — the phases built everything *around* execution first, correctly, but real execution is still the empty centre. Worth deciding explicitly whether it is in scope for this platform or deliberately left to an external agent layer that plugs into the existing dispatch seam.

### 3.6 Phase 11 — Deployment & Reliability (Ch.43, Ch.44) — Absent (known pending)
Engineering Checkpoints, recovery, deployment-topology flexibility (single-process today, behind existing nginx). Operational hardening. Known and correctly sequenced late — do once the feature set is worth protecting.

### 3.7 Phase 12 — Multi-Tenancy (Ch.42) — Absent (known pending)
A minimal `tenants` table exists (`012`, from the badge work) but is a stub: no `tenant_id` on any SEU/Deliverable/Pack row, no Workspace layer, no isolation, no cross-tenant rules. Known and correctly sequenced last (structural retrofit, depends on Phase 10 security — built — and a stable entity model). Governance FR-21.6 ("multiple participating organisations") and the Platform-scope Engineering Capital sharing story both land here.

## 4. Partial realisations inside "completed" scope

These are built and working but short of their chapter's full FR set. None blocks anything; each is a sharpening.

- **§4.1 EBM (Ch.3):** `ebms` stores the composed model per SEU (`composed_packs`, `composition_report`, status `Composed/Active/Superseded`). Gaps: **no explicit version field** (FR-3.3 "shall be versioned" — supersession exists, a version integer doesn't); **conflict detection does not block commissioning** (FR-3.6/FR-3.7 — the composition report records warnings/conflicts, but "conflicts requiring human judgement shall prevent commissioning until resolved" is not enforced; the conflict path was only first exercised with real data in Phase 9). Recomposition governance (FR-3.9/3.10) is partial.
- **§4.2 Governance Model (Ch.21):** largely satisfied by the built sum of Authority + Obligation + Policy + Quality Gate, evaluated before every transition (FR-21.3 ✅, FR-21.4 ✅). Gaps: no first-class **"effective Governance Model per SEU derived from the EBM"** surface to inspect (FR-21.1 — governance is evaluated ad hoc, never materialised/exposed as *this SEU's* governance model); **composition-time governance conflict detection** (FR-21.7) partial; multi-org governance (FR-21.6) waits on Multi-Tenancy.
- **§4.3 Quality Gate (Ch.26):** works for every SEU-scoped entity, but **structurally cannot gate Pack or Objective transitions** (`quality_gate_evaluations.seu_id` is `NOT NULL`; neither has a `seu_id`) — logged as Open Design Question #3. Criteria limited to two declarative types.
- **§4.4 Dispatch (Ch.33):** trivial `sole-eligible-participant` strategy only; no cost/load/locality strategies (§9). Blocked by there being only one Participant per Capability today and by §3.5.
- **§4.5 Attention (Ch.34):** derived Attention Items with lifecycles and a platform-wide inbox, but **no routing/prioritisation/per-recipient targeting/escalation-by-elapsed-time** (§11–13) — waits on scheduler infrastructure (no cron/pg-boss yet).
- **§4.6 External Interaction (Ch.36):** manual records with a governed lifecycle; **no real adapters/connectors** to external systems. Chapter-consistent (Ch.36 §2 scopes protocols out), but not integrated.
- **§4.7 Pack Platform (Ch.38):** Registry, versioning, lifecycle all real; **no digital signatures / PKI / publisher verification** (§13, single-trusted-operator assumption) and **no semver-range dependency matching** (exact code presence checked, version string not).
- **§4.8 Version Management (Ch.41):** immutability enforced at the Pack-row level; **not generalised to the objects a Pack contributes** (capabilities/policies/authority-rules/quality-gates still upsert by code). Real residual gap named in Phase 9.
- **§4.9 Telemetry (Ch.35):** the "sustained pattern" threshold is a hardcoded constant, not the Pack-contributed policy §11 allows.

## 5. Descriptive chapters (validate, don't build)

- **Ch.45 Reference Architecture** — a consolidating "platform as an operating system for software engineering" view. Use it as an acceptance lens once the platform stabilises (does the built system actually provide the universal services it names?), not as a work item.
- **Ch.46 Platform Evolution Strategy** — principles for governed platform evolution, compatibility, historical reproducibility. Overlaps Ch.41 Version Management. Mostly forward-looking; the one buildable piece (explicit platform-version/compatibility tracking) is minor and can ride with Phase 11.

## 6. Verified by a live run (2026-08-11)

A real ebook-library commissioning was driven over HTTP as the super user against the running platform (a short-lived `NODE_ENV=test` instance on a spare port, sharing the live dev DB, torn down afterward — additive commissioning only, no source touched). Findings:

- **The built baseline is real.** Objective ("Create an e-book library management system", 3 declared Capabilities) created `Active`; a Profile applied; commissioning reached `lifecycleState: Operational` with an EBM composed from `platform-core-engineering`, 3 Capabilities seeded `Unfulfilled`, 3 Deliverables (Requirements Specification, Architecture Document, Source Code) seeded `Defined`. Fulfilling a Capability flipped it to `Fulfilled`; transitioning Requirements Specification `Defined → In Progress → Approved` fired the full governed Command → Work Item → Dispatch pipeline in correct event order (`CommandGenerated → WorkItemGenerated → ParticipantAssigned → ParticipantSelected → WorkItemDispatched → WorkItemStarted → WorkItemCompleted → WorkItemDisposed → ParticipantIdle → DeliverableTransitioned`).
- **§3.5 confirmed live — the runtime is simulated, not real.** `WorkItemStarted → WorkItemCompleted` elapsed **~100 ms**, and the "Approved" Requirements Specification carries **only a state — no produced content** (the Deliverable has name, category, `lifecycle_state`, and no artifact field; the table has no content column). A requirements specification was governed all the way to `Approved` without any requirements ever being written. This is the empty-centre gap, observed directly rather than inferred.
- **FR-3.6/3.7 (EBM conflict-blocks-commissioning) could not be exercised** — a normal single-Pack commission produced `conflicts: []`, so there was nothing for the conflict path to block on. Confirming it enforces a block would require deliberately authoring two conflicting Packs, a heavier setup not done here.

## 7. Proposed build sequence

Ordered by unblock-value and dependency, not chapter number. Naming continues the existing phase scheme.

1. **~~Decision first, not a build: scope the autonomous runtime (§3.5).~~ RESOLVED — see `Participant Integration Plan.md`.** Decision: **execution is external by design.** The platform governs, orchestrates, and records; it never executes, builds, or deploys. The gap is an integration seam, not a missing execution engine. Participants (human or AI orchestrator) execute in their own environment, report `done | failed | blocked` + a per-Work-Item VCS reference, and the platform decides the transition on the Participant's authority (separation of duties preserved). Each completion produces an immutable **attestation** — the platform's authoritative record of the SEU-scoped governance outcome bound to a commit; the platform is *not* a universal code-signing trust root, and downstream use of the deliverable is the tenant's call. The full design and build sequence are in **`Participant Integration Plan.md`**.
2. **~~Phase 13 — Traceability query + Engineering Knowledge Graph (§3.4).~~ FOLDED INTO item 1.** Traceability is no longer a standalone phase: the attestation feature *owns* it (Ch.20's FRs become that feature's acceptance criteria). Attestation supplies the provenance backbone; the query joins it with the structural edges already in the schema. See `Participant Integration Plan.md` §1 (Decision 7) and §4 (build step 3).
3. **Phase 14 — Review Model (§3.2).** Slots onto existing Quality Gate + Decision machinery; modest size; completes the governance triad (Authority/Obligation/Policy/Review/QualityGate) the EBM already expects.
4. **Phase 15 — Compliance Model (§3.1).** Larger; new object model + continuous-evaluation engine + Pack contribution type. Sequenced after Review because both are governance-behaviour models and Review is the smaller warm-up on the same seam; also because Compliance evidence leans on the traceability query from Phase 13.
5. **Phase 16 — Governance & EBM sharpening (§4.1, §4.2, §4.3).** Materialise the effective Governance Model per SEU, enforce EBM conflict-blocks-commissioning, add EBM versioning, unblock Quality Gates on Pack/Objective. Small, cross-cutting cleanups best done together once Review/Compliance have stressed the governance model.
6. **Phase 11 — Deployment & Reliability (§3.6).** As already planned. Fold in Ch.46's platform-version tracking here.
7. **Phase 12 — Multi-Tenancy (§3.7).** As already planned, last. Unlocks Governance FR-21.6 and Platform-scope Capital sharing.
8. **Deferred until a real trigger:** Ontology (§3.3, until terminology actually collides), dispatch strategies (§4.4, until >1 Participant per Capability and a real runtime exist), Attention routing (§4.5, until scheduler infra), external adapters (§4.6), Pack signatures/semver (§4.7), object-level version immutability (§4.8), telemetry-threshold-as-policy (§4.9). Each has a documented "revisit when" condition already; none is worth pulling forward speculatively.

## 8. Open decisions this plan surfaces (for you, not me)

- **~~Autonomous runtime in scope or out?~~ RESOLVED** — external by design; see item 1 above and `Participant Integration Plan.md`.
- **Is Ontology (§3.3) ever wanted, or is free-text category the permanent answer?** The deferral condition ("when terminology collides") may never fire if the Pack ecosystem stays curated.
- **Quality Gates on Pack/Objective (§4.3, Open Q #3):** either give those two entities a nullable evaluation scope, or accept permanently that platform-level entities are Authority+Policy-governed only. A real fork, not an oversight.
