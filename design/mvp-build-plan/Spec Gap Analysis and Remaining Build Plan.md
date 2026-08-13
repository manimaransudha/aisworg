# Spec Gap Analysis & Remaining Build Plan — SEU Commissioning Platform

*Produced 2026-08-11 by cross-referencing `03_Book 3 (Refined)` (all 46 chapters, by current file-name numbering) against the actual repo at `/Volumes/Chennai/gitrepo/aisworg` (migrations `002`–`021`, `src/domain/engine`, `src/routes/seu`, `src/dblayer`, `tests/`), plus the `mvp-build-plan/` phase docs. Read-only: no code was written, no application was run. This is a planning document.*

> **Updated 2026-08-11 (post Participant Integration build).** Build-sequence items 1 and 2 are now **built and verified** (migrations `022`–`026`; commits `Basic Participant Integration` / `Participant Integration Complete` / `Dry run suite`). Consequences reflected below: **Ch.20 Traceability → ✅ Built**; **Ch.31 execution "empty centre" (§3.5) → resolved by design + integration seam built** (execution is external by design — the platform now dispatches async Work Items and drives transitions from a `result-in` callback, minting attestations); **Ch.34 Attention escalation-by-elapsed-time (§4.5) → built** (the outstanding-Work-Item stall sweep); **Ch.42 Multi-Tenancy (§3.7) → the minimal Phase-12 slice is built** (a real `tenants` table, `seus.tenant_id`, per-`(tenant, capability)` execution targets, and per-tenant contract config), though full multi-tenancy across the rest of the model remains. **Phases 14 (Review), 15 (Compliance), 17 (Ontology), and 16 (Governance & EBM sharpening) are since built — every object-model chapter is now Built. Next: the operational phases 11 (Deployment/Reliability) and 12 (full Multi-Tenancy).**

## 0. Method and confidence

Built-state was established three ways and only claimed where two agree: the numbered migrations (each phase added a numbered SQL file, so the migration list is a near-authoritative "what has a schema"), the engine/route/dblayer file inventory, and the test suite (25 test files). Where all three are silent on a chapter's feature, it is reported as **Absent**. Where the schema/data exists but the chapter's *functional requirements* aren't realised, it is reported as **Partial** with the specific FR. This was not verified by running the app — see §6 for the one place that matters.

The Post-MVP Build Sequence doc stops at Phase 9 with markers; the repo has moved well past it (migrations to `021`). Phases 10 (Dual Authority / Badge Model, `012`), SDK Authoring/UI (`013`–`016`), a Metric-Registry Telemetry expansion (`017`–`020`), and Participant Lifecycle Governance (`021`) are all built and tested, confirming "everything prior to Phase 11/12 is complete." The gaps below are therefore of three kinds: **(a)** whole models the completed phases deliberately deferred, **(b)** partial realisations inside "done" phases, and **(c)** the two known pending phases.

## 1. Chapter coverage map (all 46)

| Ch | Model | Status | Delivered by |
|---|---|---|---|
| 1 | Objective | ✅ Built | MVP + Phase 1 (`003`) |
| 2 | SEU | ✅ Built | MVP (`002`) |
| 3 | Engineering Behavior Model | ✅ Built | MVP + Phase 16 (versioned, conflict-blocks-commissioning) — see §4.1 |
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
| 18 | Ontology Model | ✅ Built | Phase 17 (`030`) — canonical vocab + tenant rename aliases, see §3.3 |
| 19 | Decision Model | ✅ Built | Phase 5 (`007`) |
| 20 | Traceability Model | ✅ Built | Participant Integration (`022`–`026`) — query surface, see §3.4 |
| 21 | Governance Model | ✅ Built | MVP + Phase 16 (effective model per SEU) — see §4.2 |
| 22 | Authority Model | ✅ Built | Phase 4 + Phase 10 (`006`,`012`) |
| 23 | Obligation Model | ✅ Built | Phase 4 (`006`) |
| 24 | Policy Model | ✅ Built | Phase 4 |
| 25 | Review Model | ✅ Built | Phase 14 (`027`,`028`) — see §3.2 |
| 26 | Quality Gate Model | ✅ Built | Phase 4 + Phase 16 (Pack/Objective gateable) — see §4.3 |
| 27 | Compliance Model | ✅ Built | Phase 15 (`029`) — see §3.1 |
| 28 | Runtime Kernel | ✅ Built | Phase 3 |
| 29 | State Management | ✅ Built | MVP (`transition_definitions`) |
| 30 | Event Model | ✅ Built | MVP (`events`) |
| 31 | Execution Engine | ✅ Built | Phase 3 + Participant Integration — execution external by design, async seam built (§3.5) |
| 32 | Work Item Model | ✅ Built | Phase 3 (`005`) |
| 33 | Dispatch Engine | 🟡 Partial | trivial strategy only — see §4.4 |
| 34 | Attention Management | 🟡 Partial | stall/timeout escalation now built; no routing/per-recipient — see §4.5 |
| 35 | Engineering Telemetry | ✅ Built | Phase 7 + Metric Registry (`017`–`020`) |
| 36 | External Interaction | 🟡 Partial | manual only, no adapters — see §4.6 |
| 37 | SEU Lifecycle Mgmt | ✅ Built | MVP |
| 38 | Pack Platform Arch | 🟡 Partial | no signatures/PKI — see §4.7 |
| 39 | Pack SDK Arch | ✅ Built | Phase 9 + SDK Authoring (`013`–`016`) |
| 40 | Security Architecture | ✅ Built | Phase 10 Dual Authority (`012`) |
| 41 | Version Management | 🟡 Partial | object-level immutability not generalised — see §4.8 |
| **42** | **Multi-Tenancy** | **🟡 Partial (Phase 12)** | minimal slice built (`026`); full isolation pending — see §3.7 |
| **43** | **Deployment Architecture** | **❌ Absent (Phase 11)** | — see §3.6 |
| **44** | **Reliability & Continuity** | **❌ Absent (Phase 11)** | — see §3.6 |
| 45 | Reference Architecture | 📖 Descriptive | consolidation, not a build target — §5 |
| 46 | Platform Evolution Strategy | 📖 Descriptive | principles; overlaps Ch.41 — §5 |

**Summary (as updated 2026-08-12, after Participant Integration + Phases 14 Review, 15 Compliance, 17 Ontology, 16 Governance & EBM sharpening):** **36 Built, 6 Partial (33, 34, 36, 38, 41, 42), 2 Absent (43, 44 — Phase 11), 2 Descriptive** (46 total). **Every object-model chapter is now Built** (Phase 16 closed Ch.3 EBM, Ch.21 Governance, Ch.26 Quality Gate). What remains is partial-realisation *sharpening* (Dispatch strategies §4.4, Attention routing §4.5, External adapters §4.6, Pack signing/semver §4.7, object-level version immutability §4.8 — each deferred-until-triggered, §7 item 9) and the two operational phases: **11 (Deployment/Reliability, Ch.43/44)** and **12 (full Multi-Tenancy, Ch.42 — minimal slice already built)**. Next planned work: **Phase 11 or Phase 12**, per your call.

## 2. How to read the plan

The gaps are ordered below by **what unblocks what**, not by chapter number. Two of them (§3.5 autonomous runtime, §3.1 Compliance) are large enough to be their own phases. The rest cluster naturally. Every deferral was a deliberate, documented decision in its originating phase — none is a bug or an oversight; the question this plan answers is only *what is left and in what order it is worth taking up*.

## 3. Substantive gaps (whole models / foundational)

### 3.1 Compliance Model (Ch.27) — ✅ Built (2026-08-12, Phase 15 — see `Compliance Model Plan.md`)
~~Absent — largest object-model gap.~~ Built as the emergent, read-only capability Ch.27 describes (§1/§8): Compliance **composes existing primitives** rather than adding governance. `compliance_frameworks` + `compliance_requirements` (`029`) are **Pack-contributed** (FR-27.1, via `PackContributions` + `publishPack`) and framework-independent (CM-006); **multiple frameworks coexist** and apply per the SEU's **composed Packs** (FR-27.2). The `complianceEngine` evaluates each requirement's **declarative criteria by reusing the same resolvers the `qualityGateEngine` uses** (obligations/evidence/decisions/reviews) — deterministic (FR-27.3), a pure function of current state so **continuously** accurate (FR-27.4), and **read-only** (§9, never modifies state, never blocks). It rolls up to a status (Compliant / Compliant with Exceptions / Partially Compliant / Non-Compliant / Compliance Unknown, §10) with rationale, persists an **immutable snapshot** each run for reproducible history (FR-27.6), emits the Ch.27 §15 events, supports **Waivers** ("Compliant with Exceptions") and **minimal conflict detection** (FR-27.7), and a **report** projection (§12). Exposed via `/api/seu/compliance` + `/seus/:id/compliance*`, a web surface at `/aisworg/seu/seus/:id/compliance`, and covered by `tests/compliance-model.test.ts` + the dry-run suite. *Remaining (deferred):* event-driven auto-evaluation, richer per-requirement definition lifecycle (§14), and full point-in-time reconstruction beyond snapshots.

### 3.2 Review Model (Ch.25) — ✅ Built (2026-08-11, Phase 14 — see `Review Model Plan.md`)
~~Absent.~~ Built as a governed entity on the existing seam. `reviews` (`027`) is the 13th `TransitionEntityType` with the Ch.25 §9 lifecycle (`Planned → Prepared → In Progress → Completed → Accepted → Archived`), a polymorphic reviewed object, and an outcome that is **set at Completion and immutable** (FR-25.5) — and it never modifies the reviewed object (RM-001). Governance consumes the outcome via a new `qualityGateEngine` criteria type **`requires_accepted_review`** (blocks a transition until an Accepted, passing Review of the required category exists) — the same "governance consumes the outcome" seam as Evidence/Decisions, so **composition from multiple Packs (FR-25.7) rides on the existing Pack → `quality_gates` contribution** with no new mechanism. `findings` (`028`, 14th entity type, `Open → Resolved`/`Waived`) are independent traceable observations: a High/Critical Finding auto-surfaces a deduped Attention Item and can be manually converted to an Obligation (Decision C — no implicit auto-creation). Reviews + Findings are joined into the Ch.20 traceability query, exposed via `/api/seu/reviews` + `/findings`, a web surface at `/aisworg/seu/seus/:id/reviews` (plan/advance a Review, raise/resolve/waive/convert Findings), and covered by `tests/review-model.test.ts` and the dry-run suite. *Remaining (small, deferred):* Pack-contributed **authority** on the Review lifecycle, and a richer declarative-criteria evaluator (§10).

### 3.3 Ontology Model (Ch.18) — ✅ Built (2026-08-12, Phase 17 — see `Ontology Plan.md`)
~~Absent.~~ Built as the platform/Pack-owned canonical vocabulary with a per-tenant **rename-only** alias layer (the "Alias" composition strategy at tenant scope). `ontology_concepts` (`030`) is the canonical registry (code = the existing category string, so existing rows are grandfathered with no data migration), seeded for the evidence/decision/knowledge/obligation/deliverable/policy category vocabularies plus deliverable-name and capability-name. **Write-path enforcement** (`assertCanonicalCategory`, wired into `createDeliverable/Evidence/Decision/Knowledge/Obligation`) rejects an off-canonical category — the guarantee lives below the dropdown, not on it. `tenant_concept_aliases` holds the per-tenant relabelling; a **read-time resolver** (`resolveLabels`) applies the tenant's label else the platform default, so **storage stays canonical and two tenants' data still joins on the shared identity** (Platform-scope Knowledge / Engineering Capital stay comparable). Exposed via `/api/seu/ontology/concepts`, `/tenants/:id/aliases`, `/tenants/:id/vocabulary`; covered by `tests/ontology-model.test.ts` + the dry-run suite. §0.1 core-invariance holds: the state machine, governance, dependency wiring, attestation, and traceability all operate on canonical codes and never see a tenant label. *Remaining (deferred per §5):* Pack-contributed concepts (step 5 — the registry already supports it), lifecycle-state cosmetic aliasing, and threading the resolver through every web view (the vocabulary endpoint + management API cover tenant-facing resolution today).

**Decided design: a platform/Pack-owned canonical vocabulary, with tenants able to rename but not extend it.** The platform, through Packs, owns the canonical set of concepts. A tenant may relabel any canonical concept to match its own methodology, but cannot create new ones. For example, the platform concept `requirements-specification` can be shown to Tenant A as "RQSPEC105". This is the "Alias" composition strategy the Architecture Catalogue already lists, applied at the tenant scope. It gives methodology fit with no collision risk, because tenants never introduce new terms, and it keeps platform and tenant data comparable because everything is stored against a shared canonical identity.

Build decisions, for when this is taken up:

1. **The canonical set is owned by the platform and Packs, not tenants.** Packs contribute concepts (Ch.18 Ontology concepts are already a declared Pack capability); the platform curates them. Tenants only relabel.
2. **Tenants rename only, through a per-tenant alias map** — `(tenant_id, concept_type, canonical_code, display_label)` — falling back to the platform default label wherever a tenant has not aliased a concept.
3. **The alias is display-only.** It is applied at read and render time (UI and tenant-facing API responses). The canonical code is what is stored on every row. This preserves history, keeps two tenants' data joinable, and keeps Platform-scope Knowledge and Engineering Capital comparable across tenants.
4. **Enforcement lives on the write path, not on the dropdown.** The create APIs validate the incoming value against the canonical set. The dropdown is the convenient front end, not the guarantee; without server-side validation, free text returns through the API.
5. **The scope of what is aliasable is a conscious call.** Deliverable names, each entity's category vocabulary, and capability display names are in scope. Lifecycle states (`Defined`/`Approved`/`Baselined`) carry shared governance meaning and should stay canonical; alias them cosmetically only if at all.
6. **One migration step.** Define the canonical set, then normalize the existing free-text `category` values onto it. Deliverable names are already near-canonical via Templates, so the category fields are the real normalization work.

This is a light build and does not require any per-tenant change to the core (the alias is resolved at the edge, consistent with the stable-core principle). It is sequenced as **Phase 17** and is the next build, before Phase 16 (Governance & EBM sharpening) — confirmed 2026-08-12. The full design and build sequence are in **`Ontology Plan.md`**.

### 3.4 Traceability Model query capability (Ch.20) — ✅ Built (2026-08-11, Participant Integration step 3)
~~Partial.~~ The query capability now exists: `src/routes/seu/core/traceability.ts` provides `explainDeliverable` (backward navigation FR-20.4 + permanent provenance FR-20.6/20.7 — a per-state timeline joining the attestation backbone with the producing Capability, dependency edges, and Evidence/Decision/Knowledge/Obligation attachments) and `impactOfDeliverable` (forward navigation FR-20.3 + impact analysis FR-20.5 — transitive downstream closure), exposed read-only at `GET /deliverables/:id/traceability` and emitting `TraceabilityQueryExecuted`. Built as a read-model over the attestation edges (`022`/`023`) plus the structural edges already in the schema — no new persistence model. Covered by `tests/traceability.test.ts` and the dry-run suite. Historical *reconstruction at an arbitrary point in time* (Ch.20 §13) beyond the per-state provenance timeline remains a later refinement.

### 3.5 Autonomous Participant runtime (Ch.31 execution) — ✅ Resolved by design + seam built (2026-08-11)
~~Partial — the foundational gap.~~ **Decision: execution is external by design** (see `Participant Integration Plan.md`). The platform commissions, governs, tracks, and now *attests* engineering; it deliberately does not perform, build, or deploy it. The synchronous `simulate()` is gone: a dispatched Work Item is now genuinely outstanding (Model A), a Participant (human or AI orchestrator) executes in its own environment and reports `done | failed | blocked` + an opaque VCS reference to an authenticated `result-in` callback, and the platform drives the governed transition on the Participant's authority — with the empty-centre presence check ensuring an approval can never certify nothing. The former "empty centre" (a Deliverable holding a state but no content) is closed: production attaches a durable reference and acceptance mints an immutable attestation binding the governed outcome to a commit. Stall/failure are first-class (target-completion sweep → Escalation; `failed`/`blocked` → Attention). Orchestrator-agnostic adapter seam + human-on-UI target built and demonstrated across two tenants. What remains genuinely out of scope by this decision: the platform never runs the agent itself.

### 3.6 Phase 11 — Deployment & Reliability (Ch.43, Ch.44) — Absent (known pending)
Engineering Checkpoints, recovery, deployment-topology flexibility (single-process today, behind existing nginx). Operational hardening. Known and correctly sequenced late — do once the feature set is worth protecting.

### 3.7 Phase 12 — Multi-Tenancy (Ch.42) — 🟡 Partial (minimal slice built 2026-08-11; full isolation pending)
The **minimal Phase-12 slice** was pulled forward with Participant Integration (`026`): a real `tenants` table with a seeded default tenant, `seus.tenant_id` (commissioning resolves it), per-`(tenant, capability)` execution targets, and per-tenant contract config (VCS binding / callback auth / attestation config). This is enough to resolve "which tenant owns this SEU → which edge configuration its Work Items run against," proven by a two-tenant core-invariance demo. **Still pending for full Phase 12:** `tenant_id` on the rest of the model (Deliverable/Pack/Knowledge/etc.), a Workspace layer, real isolation / row-level scoping, and cross-tenant rules. Governance FR-21.6 ("multiple participating organisations") and the Platform-scope Engineering Capital sharing story still land here. Correctly sequenced last (structural retrofit over a now-larger tenancy foundation).

**Note (owner, 2026-08-13) — per-tenant authority vocabulary (CR-006).** The CR-006 authority-config tables — `authority_nouns` (Work outcome), `authority_verbs` (Work process), `authority_noun_verbs` (Mapping), and `transition_definitions` — should become **schema-scoped in Phase 12**: a **platform set** in `platform.schema` (the default everyone inherits) and an optional **per-tenant set** in that tenant's `tenant.schema`. A tenant that wants its own specs gets these tables in its own schema; otherwise the platform schema is used. Ties into the "own specs vs. platform defaults" story and the additive/retire (never delete/rename) lifecycle of these vocabularies (CR-006 / CR-007 Step 2). Not for build now — recorded so Phase 12's schema/isolation design accounts for it.

## 4. Partial realisations inside "completed" scope

These are built and working but short of their chapter's full FR set. None blocks anything; each is a sharpening.

- **§4.1 EBM (Ch.3) — ✅ Resolved (Phase 16).** `ebms.version` now versions every EBM (FR-3.3; `ebmsDB.create` computes per-SEU next version, satisfying FR-3.10 when recomposition lands). `compositionEngine` detects **cross-pack** governance conflicts (authority-role clash on the same governedTransition; two Packs' quality gates on the same triple) from `packs.contributions`, and commissioning **hard-blocks** on them (FR-3.6/3.7) — the SEU never reaches Operational. (Multi-pack intra-pack role multiplicity, e.g. core-engineering's `knowledgescope.transition`, is correctly *not* a conflict.) Recomposition as a first-class flow is still future, but the versioning + traceability it needs are in place.
- **§4.2 Governance Model (Ch.21) — ✅ Resolved (Phase 16).** The first-class **effective Governance Model per SEU** now exists (FR-21.1): `getEffectiveGovernanceModel(seuId)` assembles the SEU's authority rules, policies, and quality gates from its EBM's composed Packs (each traceable to its contributing Pack), exposed at `GET /seus/:id/governance-model`. **Composition-time conflict detection** (FR-21.7) is the same detector as §4.1. Multi-org governance (FR-21.6) still waits on full Multi-Tenancy (Phase 12).
- **§4.3 Quality Gate (Ch.26):** works for every SEU-scoped entity, but **structurally cannot gate Pack or Objective transitions** (`quality_gate_evaluations.seu_id` is `NOT NULL`; neither has a `seu_id`) — logged as Open Design Question #3. Three declarative criteria types now (`no_unresolved_obligations`, `requires_accepted_evidence_or_approved_decision`, and `requires_accepted_review` from Phase 14). Also: only one gate per `(entity_type, from_state, to_state)` triple directly, though `transition_definitions.required_quality_gate_ids` composes multiple gates on one transition generically. *[Resolved in Phase 16: `quality_gate_evaluations.seu_id` becomes nullable with a CHECK — `(entity_type IN ('Pack','Objective') AND seu_id IS NULL) OR (entity_type NOT IN ('Pack','Objective') AND seu_id IS NOT NULL)` — so Pack/Objective can be gated while the scope invariant is enforced, not merely allowed.]*
- **§4.4 Dispatch (Ch.33):** trivial `sole-eligible-participant` strategy only; no cost/load/locality strategies (§9). Blocked by there being only one Participant per Capability today and by §3.5.
- **§4.5 Attention (Ch.34):** derived Attention Items with lifecycles and a platform-wide inbox; **escalation-by-elapsed-time is now built** (Participant Integration: the `sweep-stalled` scheduler seam raises a High `Escalation` Attention Item for a Work Item past its committed target completion time, idempotently). Still absent: **routing / prioritisation / per-recipient targeting** (§11–13), and the sweep's periodic cron trigger is deployment-time wiring (no in-app cron/pg-boss yet — the endpoint is the seam).
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

1. **~~Decision first, not a build: scope the autonomous runtime (§3.5).~~ ✅ BUILT (2026-08-11) — see `Participant Integration Plan.md`.** Decision: **execution is external by design.** The platform governs, orchestrates, and records; it never executes, builds, or deploys. The gap is an integration seam, not a missing execution engine. Participants (human or AI orchestrator) execute in their own environment, report `done | failed | blocked` + a per-Work-Item VCS reference, and the platform decides the transition on the Participant's authority (separation of duties preserved). Each completion produces an immutable **attestation** — the platform's authoritative record of the SEU-scoped governance outcome bound to a commit; the platform is *not* a universal code-signing trust root, and downstream use of the deliverable is the tenant's call. The full design and build sequence are in **`Participant Integration Plan.md`**.
2. **~~Phase 13 — Traceability query + Engineering Knowledge Graph (§3.4).~~ ✅ BUILT as item 1's step 3 (2026-08-11).** Traceability was delivered inside the attestation feature (Ch.20's FRs became that feature's acceptance criteria): the attestation supplies the provenance backbone and the query joins it with the structural edges already in the schema. See `Participant Integration Plan.md` §1 (Decision 7) and §4 (build step 3).
3. **~~Phase 14 — Review Model (§3.2).~~ ✅ BUILT (2026-08-11) — see `Review Model Plan.md`.** Reviews are a governed entity whose immutable outcome Governance consumes via a `requires_accepted_review` Quality Gate; Findings surface Attention and convert to Obligations. Composition rides on the existing Pack → Quality Gate seam (Decision B). Completes the governance triad (Authority/Obligation/Policy/Review/QualityGate) the EBM expects.
4. **~~Phase 15 — Compliance Model (§3.1).~~ ✅ BUILT (2026-08-12) — see `Compliance Model Plan.md`.** Compliance is an emergent, read-only evaluation composing existing primitives: Pack-contributed frameworks/requirements, a deterministic engine reusing the Quality Gate resolvers, immutable snapshots, waivers, and minimal conflict detection.
5. **~~Phase 17 — Ontology (Alias Vocabulary) (§3.3, Ch.18).~~ ✅ BUILT (2026-08-12) — see `Ontology Plan.md`.** Platform/Pack-owned canonical vocabulary (`030`), write-path enforcement, and a per-tenant rename-only alias resolved at the edge — no per-tenant core change. Storage stays canonical so cross-tenant data joins.
6. **~~Phase 16 — Governance & EBM sharpening (§4.1, §4.2, §4.3).~~ ✅ BUILT (2026-08-12) — see `Governance and EBM Sharpening Plan.md`.** EBM versioning (`031`); cross-pack composition conflict detection that **hard-blocks** commissioning (FR-3.6/3.7/21.7); a computed-on-read **effective Governance Model per SEU** at `GET /seus/:id/governance-model` (FR-21.1); and Quality Gates on Pack/Objective via `quality_gate_evaluations.seu_id` nullable **with a CHECK enforcing the scope invariant** (`032`, §4.3 / Open Q #3).
7. **Phase 11 — Deployment & Reliability (§3.6).** As already planned. Fold in Ch.46's platform-version tracking here.
8. **Phase 12 — Multi-Tenancy (§3.7).** As already planned, last. Unlocks Governance FR-21.6 and Platform-scope Capital sharing.
9. **Deferred until a real trigger:** dispatch strategies (§4.4, until >1 Participant per Capability and a real runtime exist), Attention routing (§4.5, until scheduler infra), external adapters (§4.6), Pack signatures/semver (§4.7), object-level version immutability (§4.8), telemetry-threshold-as-policy (§4.9). Each has a documented "revisit when" condition already; none is worth pulling forward speculatively. (Ontology is no longer here — it is Phase 17 above.)

## 8. Open decisions this plan surfaces (for you, not me)

- **~~Autonomous runtime in scope or out?~~ RESOLVED** — external by design; see item 1 above and `Participant Integration Plan.md`.
- **~~Is Ontology (§3.3) ever wanted, or is free-text category the permanent answer?~~ RESOLVED (2026-08-12):** wanted — as a platform/Pack-owned canonical vocabulary with tenant rename-only aliasing (see §3.3). A light build, not held for a collision; scoped as Phase 17 and confirmed to run **before** Phase 16.
- **Quality Gates on Pack/Objective (§4.3, Open Q #3):** either give those two entities a nullable evaluation scope, or accept permanently that platform-level entities are Authority+Policy-governed only. A real fork, not an oversight.
