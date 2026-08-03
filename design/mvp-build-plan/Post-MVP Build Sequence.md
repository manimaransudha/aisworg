# Post-MVP Build Sequence — SEU Commissioning Platform

*Paste this as the opening message of a new session, or point that session at this file. It is self-contained — the new session has no memory of the work that produced it.*

## Where things stand

The MVP is built and running (`localhost:4800/aisworg`). A full commissioning cycle was audited live, as a real user, and confirmed working end to end: Objective statement → Template match against required Capabilities → Profile applied → Composition Engine composes the EBM from the one seeded Pack → SEU walks its lifecycle unattended (`Commissioned → Configured → Activated → Operational`) → Capability Fulfilment (assign an AI/Human/External participant) → Deliverable lifecycle transitions, validated against real Transition Definitions (invalid transitions are correctly rejected with a specific error, not silently accepted). Acquisition Scope (SEU/Capability/Enterprise/Platform) is a real, displayed field on every Deliverable.

One real bug was found and is now fixed: the Dependency Engine was not actually gating Deliverable transitions on unmet dependencies (a dependency note would show "Pending" while the blocked transition was allowed to proceed anyway). Confirm this fix still holds — re-run the same test: approve a Deliverable another Deliverable depends on, then verify the dependent Deliverable's transition is genuinely blocked until that dependency is satisfied, not just cosmetically flagged.

The platform's own home page (`/aisworg`) is a self-reported architecture status dashboard, mapped against Book 3's own layered diagram, labelling every component **live / partial / deferred**. Trust it as a starting inventory, but re-verify anything material by using the feature as a real user before building on top of it — the same audit discipline that found the Dependency Engine gap.

Everything below this line is scope confirmed *not yet built*, in the order to build it. **Multi-Tenancy is deliberately last** — see the note at the end of the list for why that's also the technically sound place for it, not just a preference.

## Reading list for whichever phase you're starting

- `03_Book 3 (Refined)/Architecture Catalog.md` — principles and ADRs relevant to the phase in progress
- `03_Book 3 (Refined)/Canonical Information Model.md` — entity definitions for whatever's being built
- The specific Book 3 chapter(s) named per phase below (chapter numbers are current as of this document; Book 3 was renumbered twice during theory reconciliation, so trust the file names in `03_Book 3 (Refined)/0*_Part */` over any external memory of chapter numbers)
- `03_Book 3 (Refined)/Book 1 to Book 3 Mapping.md` — if a phase touches something recently added to the theory (Objective, Service, Acquisition Scope/Engineering Capital, the Organisational Learning Obligation), this document explains why it exists and how it's meant to connect to the rest of the model

Do not modify Book 1 or Book 3 in this session unless a real implementation discovery genuinely requires a theory fix — in that case, flag it clearly and treat it as a separate, deliberate decision, not a side effect of coding. 

## Build sequence

### Phase 1 — Formalize Objective ✅ Done (2026-08-03)
Currently just a free-text "Objective statement" field on the commissioning form. Book 3 Chapter 1 specifies Objective as its own entity: tiers (Strategic/Operational/Engineering), parent/child decomposition, a governed lifecycle (Proposed → Active → Achieved/Superseded/Retired → Archived), and — most importantly — the thing that should *derive* required Capabilities rather than have them hand-picked via checkboxes. Small in scope, foundational in position: everything downstream reads from Objective.
**Done when:** Objective is a persistent, versioned record with a tier and decomposition support; the commissioning form derives required Capabilities from it (checkbox selection can remain as an override/review step, not the sole mechanism).

**What was built, audited as a real user (create → decompose → reject-bad-tier → suggest → block-when-not-Active → activate → commission → edit-and-reversion):**
- Full Ch.1 lifecycle (`Proposed → Active → Achieved/Superseded/Retired → Archived`) runs through the same generic `transitionEngine` SEU and Deliverable already use — `transition_definitions.entity_type` extended to admit `'Objective'` (`003_objective_lifecycle.sql`), not a bespoke mechanism.
- Tier (`Strategic`/`Operational`/`Engineering`) and parent/child decomposition are real and validated: creating a child whose tier is "more strategic" than its parent's is rejected with a clear error (confirmed: Strategic under Operational → `400`). A new Objectives admin UI (list/detail/new) shows the tree and exposes lifecycle actions.
- Versioning is real, not a placeholder integer: editing statement/tier increments `version` (confirmed v1 → v2 on edit), exposed via `POST /objectives/:id/update` (API + web).
- **New governance point**: `commissionSeu` now requires the Objective to be `Active` — confirmed blocking a `Proposed` objective (`422`, clear reason) and succeeding once activated. This is a no-op for the existing one-shot "Commission new SEU" quick-path (which still creates an Objective `Active` by default, unchanged), and a real check for the new Objective-first flow.
- **Capability derivation**: word-overlap heuristic against each Capability's name/description (`suggestCapabilityCodes`), exposed via `GET /objectives/suggest-capabilities` and wired into the New Objective form as a live (debounced) suggestion that pre-checks boxes — never the sole mechanism, always human-reviewable before submit. This stands in for Book 3's own undefined "Capability Pack" derivation mechanism (Ch.1 §10 references it; Ch.5's Pack taxonomy never defines it — a real spec gap, not an MVP shortcut). **Known limitation found during audit**: the heuristic matches on any capability whose name/description shares a word with the statement, which can false-positive — e.g. a statement mentioning "architecture" also suggested the `development` Capability, because `development`'s own seeded description happens to mention "architecture". Acceptable given suggestions are explicitly reviewable, not authoritative, but worth a better heuristic (or an actual Capability Pack, once Phase 9 exists) if this becomes a real usability problem.
- Two commissioning paths now exist: the original one-shot "Commission new SEU" quick-path (unchanged, still creates its Objective inline and `Active`), and a new Objective-first path (`Objectives → New Objective → Activate → "Commission an SEU from this Objective"`) that reuses an existing Objective's already-declared Capabilities rather than re-picking them.
- **Test coverage added** (the manual audit above was captured as automated regression tests, not left as a one-off check): `tests/objective-lifecycle.test.ts` — decomposition/tier-ordering validation (both accept and reject), versioning, the full lifecycle transition (including a rejected undefined transition), the Active-gate on `commissionSeu` (blocks then succeeds), `commissionFromExistingObjective`, and the suggestion heuristic. `tests/engine.test.ts` gained a case exercising `transitionEngine` against the `Objective` entity type specifically (allow / authority-deny / no-transition-definition), since until now only `SEU` had that three-way coverage. Full suite: 16/16 passing.

### Phase 2 — Wire Service into the Dependency Engine
The seeded Pack already declares 2 Services, but nothing consumes them — Capability Dependency edges currently reference bare Capabilities, not specific Services. Book 3 Chapter 9 §8 and Chapter 11 §9 specify that a dependency should reference the specific contracted Service (e.g. "the Approved Solution Architecture service"), not the Capability in the abstract.
**Done when:** Dependency edges name a Service, and a Service's declared Service Level (Chapter 11 §8) is visible somewhere, even if nothing evaluates it yet.

### Phase 3 — Command / Work Item / Dispatch Engine pipeline
The dashboard self-reports this accurately: "No Command/Work Item/Dispatch Engine pipeline — direct API/UI actions instead." Book 3 Chapters 28-33 specify the real chain: Execution Engine observes state and generates Commands → Work Item Generator produces participant-specific execution artefacts → Dispatch Engine selects who executes. Replacing direct UI-triggered transitions with this pipeline is the largest single piece of remaining scope, and most later phases (Telemetry, Attention Management) assume it exists.
**Done when:** a Deliverable state change goes through Command generation and dispatch rather than a direct form POST, even if dispatch selection logic starts out trivial (whoever's assigned).

### Phase 4 — Governance depth
Currently: "minimal Authority + Policy checks only." Book 3 Chapters 20, 22, 23, 24, 25, 26 specify Quality Gate, Review, Obligation, and a fuller Authority Model (more than one rule type) and Policy (including the Constraint Type distinction between mandatory Policy and non-blocking Standard). Without this, Deliverable transitions are state-machine-valid but not actually *governed*.
**Done when:** at least one Quality Gate blocks a real transition until its criteria are met, and at least one Obligation can block a Deliverable independently of the dependency graph.

### Phase 5 — Knowledge, Evidence, Decision Models
Currently fully deferred. Book 3 Chapters 14-19 specify the Trust Pipeline (Information → Evidence → Knowledge → Decision → Deliverable State Transition). This phase has no dependents yet in the running app, which is exactly why it's sequenced after Governance rather than before — Governance gives Knowledge/Evidence/Decision something real to attach to (a Quality Gate requiring Evidence, a Review producing a Decision).
**Done when:** a Deliverable transition can require accepted Evidence or a recorded Decision as a real precondition, not just a Transition Definition state check.

### Phase 6 — Organisational Learning Obligation + Engineering Capital surfaces
Now that Knowledge exists (Phase 5), wire up the actual learning loop: Chapter 23 §7's Organisational Learning Obligation category, triggered by Knowledge Acquisition Scope promotion (Book 1 Chapter 21 §21.6; Book 3 Chapter 16 §12-§13). Acquisition Scope is already a displayed field — this phase makes it *do* something: give Engineering Capital a real query/screen (Knowledge filtered to Capability/Enterprise/Platform scope), and let a promoted Knowledge Item actually raise an Obligation.
**Done when:** promoting a Knowledge Item's scope produces a visible Organisational Learning Obligation, and there's a screen showing the organisation's accumulated Engineering Capital.

### Phase 7 — Engineering Telemetry
Book 3 Chapter 35. Deferred until now deliberately — Telemetry needs the Command/Work Item pipeline (Phase 3) and the Governance/Learning loop (Phases 4-6) to have something real to measure. Building this earlier would produce dashboards over synthetic/incomplete signals.
**Done when:** at least one Flow metric (e.g. Deliverable cycle time) and one Governance metric (e.g. Quality Gate latency) are computed from real Phase 3-6 activity, and a sustained pattern can raise an Organisational Learning Obligation per the Phase 6 mechanism (Chapter 35 §11).

### Phase 8 — Attention Management, External Interaction
Book 3 Chapters 34, 36. Round out the Runtime Kernel now that Telemetry and the Command pipeline exist to feed them. Lower priority than the phases above; do this once they're stable, not before.

### Phase 9 — Pack Platform maturity
Book 3 Chapters 5, 38, 39: Pack SDK, dynamic Pack discovery/registry, lifecycle management (Packs currently carry a lifecycle status column that nothing drives), and proper Revision/Version separation (Chapter 41). Sequenced here because it's the natural predecessor to multiple organisations each contributing their own Packs — which is also, not coincidentally, the immediate predecessor to Multi-Tenancy.
**Done when:** a Pack can be authored, validated and published through tooling rather than hand-edited JSON plus a seed script, and a second, independently-versioned Pack can be composed alongside the first.

### Phase 10 — Security Architecture depth
Book 3 Chapter 40: the Dual Authority Model (Platform Authority vs. Engineering Authority), beyond the current single Authority Rule type plus session auth. Sequenced immediately before Multi-Tenancy because tenant isolation is meaningless without it — this is the direct technical prerequisite, not just next on a list.
**Done when:** Platform Authority (can this identity administer the platform) and Engineering Authority (can this identity approve this state transition) are evaluated as genuinely separate checks.

### Phase 11 — Reliability, Deployment maturity
Book 3 Chapters 43, 44: Engineering Checkpoints, recovery, deployment topology flexibility. Operational hardening — do this once the feature set above is stable enough to be worth protecting, not before.

### Phase 12 — Multi-Tenancy (Do not build this now)
Book 3 Chapter 42: Tenant → Workspace → SEU hierarchy, administrative isolation, cross-tenant interaction rules. This is sequenced last for a reason beyond preference: it's a structural retrofit — every entity's ownership model gets a tenant boundary added to it — and doing that once, after Phases 1-11 have stabilized the entity model, is far cheaper than doing it now and then having every subsequent phase build on top of a tenancy model that's still shifting. It also depends directly on Phase 10's security work and Phase 9's multi-Pack-contribution model being solid first.
**Done when:** two distinct Tenants can each commission and operate SEUs with no visibility into each other's engineering state, and cross-tenant Pack sharing (Platform-scope Engineering Capital, per Phase 6) goes through governed Pack publication, never direct data exposure.

## Working discipline for whoever builds this

Audit each phase as a real user before calling it done and moving to the next — exactly how the MVP itself was verified (submit real forms, follow real redirects, check that a displayed status matches actual enforced behaviour, don't just trust a self-reported dashboard label). That's how the Dependency Engine gap was caught, and it's the cheapest point to catch the next one too.
