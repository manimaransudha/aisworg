# MVP Build Plan — SEU Commissioning Platform

*Produced from `design/foundations/MVP Build Plan Kickoff Brief.md`. Neither manuscript was modified to produce this plan. This document is the deliverable the brief asked for — a planning document, not code.*

*Tech-stack discussion held 2026-08-03: this plan builds on the existing `src/` scaffold in this repo (Express 5 + PostgreSQL + session auth), adds TypeScript on top of it, and adapts `coding_principles.md`'s conventions (particularly the dblayer pattern) where the SEU domain needs something the original guidelines didn't anticipate. Those adaptations are called out explicitly wherever they occur, not silently substituted.*

---

## 0. How to read this document

Section 1 validates the kickoff brief's draft scope table against an actual read of the relevant Book 3 chapters — several rows needed correction, and two real spec gaps surfaced that the brief's table didn't anticipate. Section 2 closes the technology decision. Section 3 is the schema. Section 4 is the API contract, which doubles as the acceptance test. Section 5 collects every simplification into one list. Section 6 sequences the build. Section 7 is a dated log of what happened after the MVP shipped — read it for the current state of anything §§1–6 describe differently. Genuinely open design questions (not simplifications, not bugs — real forks not worth deciding yet) live separately in `Open Design Questions.md` in this folder.

Where a decision below resolves an ambiguity the source chapters themselves left open (there are a few — noted inline), that resolution is this plan's own, not something asserted by Book 3. If scope later expands back toward the full 46-chapter vision, revisit those specific spots first.

---

## 1. Scope decision — validated

The brief's draft table is directionally correct. Reading Chapters 1–15, 22, 24, 29, 30 and 37 in full (not just the Canonical Information Model's summaries) surfaced three corrections and two omissions the draft table didn't account for. The validated table:

| In scope for MVP | Deferred / simplified | Change from brief's draft |
|---|---|---|
| Objective, SEU, EBM, Composition Engine, Pack Model, Template Model, Profile Model, SEU Commissioning | Pack SDK — hand-author Packs as JSON, loaded via a seed script | Same as draft. |
| Capability, Service (declared) | Dispatch Engine sophistication — direct API-driven assignment, no Work Item/Command pipeline | Same as draft, sharpened: Ch.31–33 (Execution Engine, Work Item, Dispatch Engine) are fully out — MVP's "assign a Participant to a Capability" is one direct API call, not a generated Command expanded into Work Items and dispatched. |
| Capability Fulfilment, Participant (single entity, `type` field) | Engineering Telemetry, Organisational Learning Obligation | **Corrected**: Ch.12 floats a Participant Type / Participant Instance split "for the next chapter," but Ch.13's own normative body never delivers it as two entities — only one `Participant` entity with a Type field. Building two tables would over-build relative to what the spec actually specifies. |
| Deliverable Model (basic lifecycle, no Quality Gates) | Quality Gate, Review, Compliance | Same as draft. |
| Dependency Engine (Deliverable + Capability dependency types only) | Obligation Dependency, Decision Dependency, Knowledge Dependency, Evidence Dependency edge types | **Narrowed**: Ch.9 names six dependency-edge types. The brief's draft table only explicitly deferred Quality Gate/Review/Compliance and Ontology — it didn't say what happens to Obligation/Decision/Knowledge/Evidence *edges specifically*. Since Obligation, Decision, Knowledge and Evidence are themselves not in the in-scope column (see next row), their edge types can't be either — stated explicitly here so it isn't a silent gap discovered mid-build. |
| State Management, Event Model (Postgres-table event log, in-process publish) | — | Same as draft, with one correction: **the chapter titled "Event Model" in the brief's reading-order note is actually Chapter 30; Chapter 29 is "State Management Model."** Both were read; both are in scope (State Management supplies the generic Transition Definition mechanism, Event Model supplies the event log). |
| Authority, Policy (single Authority Rule + single Policy, both real, not stubbed) | Security Architecture depth, Reliability/Checkpointing, Deployment topology abstraction | Same as draft. Ch.22's own body never defines a "Dual Authority Model" split (Platform vs. Engineering Authority) — that framing lives in the Architecture Catalogue as an ADR, not in Ch.22 itself. MVP doesn't need it either way: one Authority Rule type is sufficient and is what Ch.22's evaluation function actually operates on. |
| SEU Lifecycle Management (Ch.37's `Commissioned → Configured → Activated → Operational` as the canonical states) | Attention Management, External Interaction | Same as draft. **Gap found and resolved**: Ch.37 never states what "Operational" requires — the word "Capability" doesn't appear in the chapter. The brief's own acceptance sequence (§4 below) already answers this by construction: Operational is reached *before* Participant assignment, so Operational = "commissioning pipeline completed," not "≥1 Capability fulfilled." Documented as an explicit MVP decision in §5, since Book 3 doesn't state it either way. |
| — *(new row, not in brief's draft)* | **Knowledge, Evidence, Decision, Ontology, Traceability Model (Ch.16–20)** | **Omission found**: the brief's draft table never mentions these four chapters in either column, but Ch.15 §16 lists "accepted evidence" and "approved decisions" among the triggers for a Deliverable's own lifecycle transitions, and Ch.9's dependency graph has Decision/Knowledge/Evidence as node types. Left implicit, this would have surfaced mid-build as a missing dependency the first time a Deliverable tried to move to `Approved`. Resolved here: **every MVP Transition Definition (SEU and Deliverable alike) is gated only by Authority + Policy — never by Evidence, Knowledge, Decision or Quality Gate**, even though the Transition Definition schema (§3 below) has room for all of them. This keeps the *mechanism* (declarative, composable prerequisites) intact while deferring three entire object models, which is a materially bigger scope cut than the brief's draft table implied and is worth knowing about explicitly rather than discovering by omission. |

---

## 2. Technology stack

### 2.1 Base decision

Builds on the existing scaffold in `src/` rather than starting fresh: Express 5, PostgreSQL via `pg`, session/passport auth, the existing `dblayer`/`middleware`/`routes` layering from `coding_principles.md`. TypeScript is added on top.

**Why TypeScript, specifically for this domain:** this platform is unusually enum- and state-machine-heavy — Deliverable lifecycle, SEU lifecycle, Pack lifecycle, Constraint Type, Acquisition Scope, Fulfilment Strategy, and Transition Definitions that compose six different prerequisite kinds. In plain JS, a mistyped state string or a missed branch in a transition check fails silently, in exactly the class of code (governed state transitions) where a silently-wrong answer is the worst failure mode this platform could have. TypeScript's discriminated unions and exhaustiveness checks catch that at compile time, and layer onto the existing Express/pg code without a rewrite.

| Concern | Decision |
|---|---|
| Language/runtime | Node.js (existing `"packageManager": "pnpm@10.28.1"`, Node 24 per `coding_principles.md` #11) + TypeScript, ESM (`"type": "module"` already set). |
| Database | PostgreSQL, via the existing `pg` pool in `src/utils/db.js` — not Supabase. See §2.3. |
| API style | REST/JSON under `src/routes/api/seu/`, following the existing `api/` vs `web/` split (`api/` returns JSON, `web/` renders views — MVP is API-only, no views). |
| Event/messaging mechanism | In-process synchronous publish after each committed transition, persisted to a Postgres `events` table (§3). No broker. Chapter 30 explicitly scopes messaging middleware/transport out of Book 3 ("implementation-defined"); a Postgres table is a faithful minimal instance, not a stub. |
| Deployment target | Same host/process as the existing app, behind the existing nginx reverse proxy (`app.set('trust proxy', 1)` already present in `src/app.js`). No containerization for MVP — matches the brief's deferred "Deployment topology abstraction" row. |

### 2.2 Module layout — the "small core" the user asked for

The user's own framing — *"the core has to be very small and behave like an engine, everything configurable, easy to extend with minimal code changes"* — is, independently, exactly what Book 3's own architecture prescribes (AP-001: Runtime Kernel domain-independent; AP-008: Platform Core never modified to introduce engineering behaviour; the Microkernel Runtime Architecture ADR). This isn't a tension to manage, it's the same idea from two directions, so the file layout should make that literal:

```
src/domain/engine/          ← the small, domain-agnostic core (4 modules, generic over "entity type")
  compositionEngine.ts        merges Pack rows into an EBM (Override/Merge/Supplement strategies)
  dependencyEngine.ts         generic graph evaluator: dependency_edges rows → readiness state
  transitionEngine.ts         evaluates a Transition Definition (Authority + Policy) against a requested state change
  eventBus.ts                 publish(event) → persists to events table, calls registered subscribers

src/routes/seu/core/         ← SEU-specific orchestration (knows what "Objective" and "Deliverable" mean;
  commissioning.ts              calls the generic engine, never contains transition-evaluation logic itself)
  objectives.ts, templates.ts, profiles.ts, seus.ts, capabilities.ts, deliverables.ts, events.ts

src/routes/seu/api/          ← one file per resource, §4, JSON controllers calling into core/
src/dblayer/*.ts             ← one flat file per table, §3, following the existing userDB.js/appConfigDB.js convention
```

**Correction from the first draft of this plan**: business-logic orchestration lives in `src/routes/seu/core/`, not `src/domain/seu/` as originally sketched here — `coding_principles.md`'s own structure example already establishes `routes/<feature>/core/` as where a route's business logic lives (`routes/student/core/subjects.js`), and the actual build followed that convention once it was checked against, rather than inventing a parallel `domain/<feature>/` location. `src/domain/engine/` is the one deliberate exception: it's cross-cutting (used by every `routes/seu/core/` file, not owned by one resource), the same justification the existing `src/domain/auth/` already relies on. `src/dblayer/` also stayed flat rather than nesting under a `seu/` subfolder, matching `userDB.js`/`appConfigDB.js`'s existing one-file-per-table layout.

The engine layer knows nothing about Objectives, SEUs, or Deliverables by name — it operates on generic records, typed edges, and declarative rule rows loaded from the database. Extending the platform (a new Pack, a new Policy, a new Deliverable category, even a new lifecycle state for Deliverable — see §2.3) means inserting new rows, not editing `src/domain/engine/`. That module directory should not grow in line count as scope expands; `src/routes/seu/core/` and `src/dblayer/` will.

**Built and verified** (2026-08-03): all 6 milestones in §6 are complete — schema migrated, seed data loaded, all 4 engine modules unit-tested, all 9 API endpoints wired and manually verified, and the M5 acceptance test (`tests/acceptance.e2e.test.ts`) passes against a real Postgres database, boot­ing the actual `app.js` on an ephemeral port with no mocking of the engine/core/dblayer layers. `pnpm install && pnpm migrate:seu && pnpm seed:seu && pnpm test` runs clean from a fresh checkout.

### 2.3 Adapting `coding_principles.md`

The user pre-authorized modifying the guidelines where the SEU domain needs something they didn't anticipate. Two adaptations, both deliberate rather than incidental:

1. **dblayer pattern: `pg`, not Supabase.** `coding_principles.md`'s own sample dblayer file (`subjectsMaster.js`) is written against a Supabase client, but the two dblayer files that actually exist in this repo (`userDB.js`, `appConfigDB.js`) use the raw `pg` pool via `query()` from `src/utils/db.js` — `supabaseAdmin.js` exists as a util but nothing in `src/dblayer` currently uses it. The new `src/dblayer/seu/*.ts` files follow the **pattern that's actually in use** (`pg` + parameterized SQL), standardized on the `{ data, error }` return shape both `appConfigDB.js` and the guideline's Supabase sample already agree on — just over a different client.
2. **No `CHECK` constraint on `deliverables.lifecycle_state`.** Every other enum-shaped column in this schema (and in the existing `users`/`app_config` tables) uses a `TEXT ... CHECK (... IN (...))` constraint, and that convention is kept everywhere it fits. One exception: Chapter 15 §10 explicitly states *"the Engineering Behavior Model may define additional lifecycle states"* for Deliverables — it's the one entity in the whole corpus the books themselves call out as Pack-extensible. A `CHECK` constraint there would mean every new Deliverable state requires a migration, contradicting both the chapter and the user's "extend with minimal code changes" brief. `deliverables.lifecycle_state` is validated dynamically against the `transition_definitions` table (§3) by `transitionEngine.ts` instead — the same discipline as everywhere else, just enforced in the engine layer rather than the schema, for the one entity that's supposed to move.
3. **Numbered migrations.** The existing `src/dblayer/migrations/schema.sql` is a single unnumbered file. This plan adds `002_seu_platform.sql` alongside it (not a rename of the existing file) and recommends numbering going forward — a small, additive convention change, not a rewrite of what's there.

Everything else in `coding_principles.md` — logger middleware (no `console.log`), no hardcoded parameters, ESM/Node 24 import style, `routes/.../api/` returning JSON vs `routes/.../web/` rendering views, both calling into a `core`/`domain` layer for business logic — applies unchanged. The ViewModel Architecture doesn't apply to this MVP (no views — see §5), but isn't being removed from the guidelines; it just has nothing to attach to yet.

---

## 3. Schema

All tables live in `002_seu_platform.sql`, additive to the existing `schema.sql`. Style matches the existing migration: `TEXT` + `CHECK` for enums (except where §2.3 explains the one deviation), `TIMESTAMPTZ`, snake_case, `idx_<table>_<col>` indexes. Primary keys are `UUID DEFAULT gen_random_uuid()` (requires `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of the migration) rather than `SERIAL` — these entities are referenced across Packs, versions, and eventually tenants, and want globally-unique, non-guessable identifiers from day one, unlike `users`/`app_config`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══════════════════════════════════════════════════════════════════
-- Engineering Layer
-- ══════════════════════════════════════════════════════════════════

-- Ch.1. MVP: requiredCapabilities are explicitly declared (objective_capabilities),
-- never auto-derived — Ch.1 §10's derivation path depends on a "Capability Pack"
-- category that Ch.5's own Pack taxonomy never defines (see §5).
CREATE TABLE objectives (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement            TEXT NOT NULL,
  tier                 TEXT NOT NULL DEFAULT 'Engineering'
                          CHECK (tier IN ('Strategic', 'Operational', 'Engineering')),
  parent_objective_id  UUID REFERENCES objectives(id),
  status               TEXT NOT NULL DEFAULT 'Active'
                          CHECK (status IN ('Proposed', 'Active', 'Achieved', 'Superseded', 'Retired', 'Archived')),
  version              INTEGER NOT NULL DEFAULT 1,
  requested_by         INTEGER REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.10. Master/catalog table — Pack-declared, not per-SEU.
CREATE TABLE capabilities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,          -- e.g. 'requirements-analysis'
  name                 TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  originating_pack_id  UUID REFERENCES packs(id),
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE objective_capabilities (
  objective_id   UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  PRIMARY KEY (objective_id, capability_id)
);

-- Ch.11. New in the Refined edition — fully specified, no legacy inconsistency.
CREATE TABLE services (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  providing_capability_id  UUID NOT NULL REFERENCES capabilities(id),
  name                     TEXT NOT NULL,
  contract_description     TEXT NOT NULL,
  service_level            JSONB NOT NULL DEFAULT '{}',   -- optional: turnaround_time, quality_bar, availability, exceptions (Ch.11 §8 — "may specify")
  status                   TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  version                  INTEGER NOT NULL DEFAULT 1,
  originating_pack_id      UUID REFERENCES packs(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- Composition Layer
-- ══════════════════════════════════════════════════════════════════

-- Ch.5. Hand-authored JSON, loaded via a seed script (Pack SDK deferred — see §5).
CREATE TABLE packs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                          TEXT NOT NULL UNIQUE,
  name                          TEXT NOT NULL,
  category                      TEXT NOT NULL
                                   CHECK (category IN ('Platform', 'Organisation', 'Domain', 'Compliance', 'Technology', 'Integration')),
  pack_version                  TEXT NOT NULL,             -- semver string, e.g. '1.0.0'
  status                        TEXT NOT NULL DEFAULT 'Active'
                                   CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  installation_classification   TEXT NOT NULL DEFAULT 'Mandatory'
                                   CHECK (installation_classification IN ('Mandatory', 'Recommended', 'Optional', 'Conditional')),
  contributions                 JSONB NOT NULL DEFAULT '{}',   -- declarative payload: policies[], authorityRules[], capabilities[], services[]
  dependencies                  JSONB NOT NULL DEFAULT '[]',   -- [{ packCode, version, type: 'required' }] — MVP uses 'required' only
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.6. Template = structural blueprint + MANDATORY Packs only (see §5 for the
-- Template/Profile field-ownership resolution — Ch.6 and Ch.7 overlap in the source text).
CREATE TABLE templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  template_version       INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'Active'
                            CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  parent_template_id     UUID REFERENCES templates(id),   -- inheritance (Ch.6 §9) — column present, unused by MVP seed data
  deliverable_catalogue  JSONB NOT NULL DEFAULT '[]',     -- [{ code, name, category }] — default Deliverables this Template proposes
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE template_capabilities (
  template_id    UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  PRIMARY KEY (template_id, capability_id)
);

CREATE TABLE template_packs (            -- mandatory Packs only, per the Template/Profile split (§5)
  template_id  UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  pack_id      UUID NOT NULL REFERENCES packs(id),
  PRIMARY KEY (template_id, pack_id)
);

-- Ch.7. Profile = everything selectable/optional for one commissioning instance.
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  base_template_id    UUID NOT NULL REFERENCES templates(id),
  config_parameters   JSONB NOT NULL DEFAULT '{}',    -- meaning owned by the consuming Pack (Ch.7 §10), not by Profile itself
  environment         TEXT NOT NULL DEFAULT 'development',
  status              TEXT NOT NULL DEFAULT 'Active'
                         CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_packs (              -- optional Packs selected on top of the Template's mandatory set
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id     UUID NOT NULL REFERENCES packs(id),
  PRIMARY KEY (profile_id, pack_id)
);

-- Ch.2/Ch.4/Ch.38. EBM and EEC collapsed into one table for MVP (see §5) — each
-- SEU gets a freshly-composed configuration; Packs aren't independently
-- republished for reuse across many pre-validated EBMs at MVP scale.
CREATE TABLE ebms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  composed_packs        JSONB NOT NULL DEFAULT '[]',   -- [{ packId, packVersion }] actually composed, in order
  composition_report    JSONB NOT NULL DEFAULT '{}',   -- { warnings[], conflicts[], resolutions[] } — Ch.8 §17's Commissioning Report
  status                TEXT NOT NULL DEFAULT 'Active'
                           CHECK (status IN ('Composed', 'Active', 'Superseded')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- Execution Layer
-- ══════════════════════════════════════════════════════════════════

-- Ch.37 for lifecycle_state; Ch.2 for the composition tree. 'Pending' is added
-- as a pre-Commissioned working state for the commissioning pipeline to attach
-- to — Ch.37 never actually describes what a SEU looks like before "Commissioned"
-- is reached, since that's the pipeline's own outcome, not an entry state. Flagged
-- explicitly since it isn't sourced from either book (see §5).
CREATE TABLE seus (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id          UUID NOT NULL REFERENCES objectives(id),
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  active_ebm_id         UUID REFERENCES ebms(id),
  lifecycle_state       TEXT NOT NULL DEFAULT 'Pending'
                           CHECK (lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended', 'Retired', 'Archived')),
  requested_by          INTEGER REFERENCES users(id),
  commissioning_report  JSONB NOT NULL DEFAULT '{}',   -- Ch.8 §17
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-SEU requirement + fulfilment roll-up. Distinct from `capabilities` (the catalog).
CREATE TABLE seu_capabilities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  status         TEXT NOT NULL DEFAULT 'Unfulfilled'
                    CHECK (status IN ('Unfulfilled', 'Fulfilled')),
  UNIQUE (seu_id, capability_id)
);

-- Ch.12/Ch.13 collapsed into one entity — see §1's corrected row.
CREATE TABLE participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id        UUID NOT NULL REFERENCES seus(id),
  type          TEXT NOT NULL CHECK (type IN ('AI', 'Human', 'External')),
  display_name  TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'Available'
                   CHECK (state IN ('Created', 'Available', 'Assigned', 'Executing', 'Idle', 'Released', 'Archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.12 §9 — registers eligibility/assignment, doesn't bind to a specific Work Item (none exist in MVP).
CREATE TABLE capability_fulfilments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_capability_id    UUID NOT NULL REFERENCES seu_capabilities(id) ON DELETE CASCADE,
  participant_id       UUID NOT NULL REFERENCES participants(id),
  fulfilment_strategy  TEXT NOT NULL DEFAULT 'AI'
                          CHECK (fulfilment_strategy IN ('AI', 'Human', 'External', 'Hybrid', 'Composite')),
  established_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at           TIMESTAMPTZ
);

-- Ch.15. lifecycle_state deliberately has NO CHECK constraint — see §2.3.
CREATE TABLE deliverables (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                    UUID NOT NULL REFERENCES seus(id),
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL,
  lifecycle_state           TEXT NOT NULL DEFAULT 'Defined',    -- validated against transition_definitions, not a DB CHECK
  acceptance_criteria       JSONB NOT NULL DEFAULT '[]',
  acquisition_scope         TEXT NOT NULL DEFAULT 'SEU'
                               CHECK (acquisition_scope IN ('SEU', 'Capability', 'Enterprise', 'Platform')),
  producing_capability_id   UUID REFERENCES capabilities(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.9. Only Deliverable and Capability edge types — see §1's narrowed row.
-- Capability-type edges reference the specific Service, per Ch.9 §8, not the bare Capability.
CREATE TABLE dependency_edges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  from_deliverable_id   UUID NOT NULL REFERENCES deliverables(id),
  dependency_type       TEXT NOT NULL CHECK (dependency_type IN ('Deliverable', 'Capability')),
  to_deliverable_id     UUID REFERENCES deliverables(id),
  to_service_id         UUID REFERENCES services(id),
  required_state        TEXT,                              -- e.g. 'Approved' — state the target must reach
  readiness_state       TEXT NOT NULL DEFAULT 'Pending'
                           CHECK (readiness_state IN ('Unknown', 'Pending', 'Satisfied', 'Blocked')),
  CONSTRAINT dependency_target_matches_type CHECK (
    (dependency_type = 'Deliverable' AND to_deliverable_id IS NOT NULL AND to_service_id IS NULL) OR
    (dependency_type = 'Capability' AND to_service_id IS NOT NULL AND to_deliverable_id IS NULL)
  )
);

-- ══════════════════════════════════════════════════════════════════
-- Governance & Runtime Kernel
-- ══════════════════════════════════════════════════════════════════

-- Ch.22. One rule type only (Authorised / Not Authorised) — no Conditions/
-- Escalation/Delegation/Waiver outcomes, no Dual Authority split (see §1).
CREATE TABLE authority_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  governed_transition   TEXT NOT NULL,             -- e.g. 'seu.commission', 'deliverable.transition'
  authorised_role       TEXT NOT NULL,             -- reuses users.role: 'general' | 'power' | 'super'
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.24. Constraint Type kept (both values usable), Exception mechanism dropped for MVP.
CREATE TABLE policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'Engineering',
  constraint_type       TEXT NOT NULL DEFAULT 'Policy'
                           CHECK (constraint_type IN ('Policy', 'Standard')),
  governed_transition   TEXT NOT NULL,
  condition             JSONB NOT NULL DEFAULT '{"type":"always_true"}',  -- e.g. {"type":"field_in","field":"profile.environment","values":["production"]}
  severity              TEXT NOT NULL DEFAULT 'Medium',
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.29 §10. Generic across entity types — this is the "config, not code" mechanism
-- that makes SEU and Deliverable transitions declarative rather than hardcoded.
CREATE TABLE transition_definitions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type                   TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable')),
  from_state                    TEXT NOT NULL,
  to_state                      TEXT NOT NULL,
  required_authority_rule_id    UUID REFERENCES authority_rules(id),
  required_policy_ids           UUID[] NOT NULL DEFAULT '{}',
  UNIQUE (entity_type, from_state, to_state)
);

-- Ch.30. Flat event table — a faithful minimal instance, not a stub (§2.1).
CREATE TABLE events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type                TEXT NOT NULL,
  originating_object_type   TEXT NOT NULL,
  originating_object_id     UUID NOT NULL,
  correlation_id            UUID NOT NULL,
  causation_id              UUID,
  payload                   JSONB NOT NULL DEFAULT '{}',
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence                  BIGSERIAL
);

CREATE INDEX idx_events_originating   ON events (originating_object_type, originating_object_id);
CREATE INDEX idx_events_correlation   ON events (correlation_id);
CREATE INDEX idx_dependency_edges_seu ON dependency_edges (seu_id);
CREATE INDEX idx_dependency_edges_from ON dependency_edges (from_deliverable_id);
CREATE INDEX idx_deliverables_seu     ON deliverables (seu_id);
CREATE INDEX idx_seu_capabilities_seu ON seu_capabilities (seu_id);
```

17 tables total. Everything not listed here (Knowledge, Evidence, Decision, Ontology, Obligation, Quality Gate, Review, Work Item, Command, Telemetry, Attention Item, Tenant/Workspace) is out of MVP scope per §1 and §5.

---

## 4. API contracts — the commissioning journey end to end

Nine endpoints. This sequence **is** the MVP acceptance test — each step's response is asserted before the next request is made.

| # | Method & path | Request body | Response | Maps to |
|---|---|---|---|---|
| 1 | `POST /api/seu/objectives` | `{ statement, requiredCapabilityCodes: string[] }` | `201 { id, status: 'Active', requiredCapabilities: [...] }` | Ch.1 — create Objective (capabilities explicitly declared, not derived — §1) |
| 2 | `GET /api/seu/templates?capabilityCodes=a,b,c` | — | `200 { candidates: [{ id, code, name, satisfies: boolean, missingCapabilities: [] }] }` | Ch.6 §11 — select/validate a Template against required Capabilities |
| 3 | `POST /api/seu/profiles` | `{ templateId, environment, configParameters }` | `201 { id, baseTemplateId }` | Ch.7 — apply a Profile (an MVP deployment may instead seed one built-in "Default" Profile per Template and skip this call — both are valid against the schema) |
| 4 | `POST /api/seu/commission` | `{ objectiveId, templateId, profileId }` | `201 { seuId, lifecycleState: 'Operational', ebmId, commissioningReport }` **or** `4xx { stage, reason, diagnostics }` on failure at any pipeline stage | Ch.8 full pipeline: Validate Request (Authority + Policy) → Resolve Template/Profile/Packs → **Composition Engine** runs → Create Engineering Assets (seeds `seu_capabilities` from Template's required Capabilities, `deliverables` from Template's `deliverable_catalogue`, `dependency_edges` between them) → SEU walks `Pending → Commissioned → Configured → Activated → Operational` via `transitionEngine` |
| 5 | `GET /api/seu/seus/{id}` | — | `200 { seu, capabilities: [{ code, status }], deliverables: [{ id, name, lifecycleState }] }` | Ch.2 — SEU status view |
| 6 | `POST /api/seu/seus/{id}/capabilities/{capabilityId}/fulfil` | `{ participant: { type, displayName } }` | `200 { capabilityFulfilment, seuCapability: { status: 'Fulfilled' } }` | Ch.12 — Capability Fulfilment: creates the Participant, registers eligibility, marks the requirement fulfilled. No Dispatch Engine — direct assignment (§1). |
| 7 | `POST /api/seu/seus/{id}/deliverables` | `{ name, category, dependsOn: { deliverableIds: [], serviceIds: [] } }` | `201 { deliverable, dependencyEdges: [...] }` | Ch.15 — create a Deliverable (beyond whatever the Template catalogue pre-seeded at commissioning) |
| 8 | `POST /api/seu/deliverables/{id}/transition` | `{ targetState }` | `200 { deliverable, appliedTransition }` **or** `409 { reason: 'dependency_not_satisfied' \| 'authority_denied' \| 'policy_blocked' }` | Ch.15/Ch.29 — `transitionEngine` checks `dependency_edges` readiness, then the matching `transition_definitions` row's Authority + Policy |
| 9 | `GET /api/seu/seus/{id}/events` | — | `200 { events: [...] }` | Ch.30 — the event log produced by steps 4–8, ordered by `sequence` |

**Acceptance test = steps 1 → 2 → (3) → 4 → 6 → 7 → 8, asserting:** Objective created → a Template is found that satisfies its Capabilities → SEU reaches `lifecycleState: 'Operational'` → at least one `seu_capabilities` row reaches `status: 'Fulfilled'` → at least one Deliverable moves from `Defined` to a later state via a real (Authority-checked) transition. This is exactly the brief's own acceptance sequence in §4.

---

## 5. Explicit, stated simplifications

Every place this MVP deliberately does less than Book 3 specifies, in one list:

1. **Objective→Capability derivation is manual only.** Ch.1 §10's automated-derivation path depends on a "Capability Pack" category that Ch.5's own Pack taxonomy never defines — a real gap in the source text, not an MVP shortcut of a working mechanism. `requiredCapabilityCodes` is declared explicitly on every Objective (Ch.1 §10 allows this as the alternative to derivation).
2. **Participant Type and Participant Instance are one table, not two.** Ch.12 proposes splitting them; Ch.13's normative body never implements the split. One `participants` table with a `type` column matches what the spec actually delivers.
3. **Dispatch = direct assignment, no Work Item/Command pipeline.** Execution Engine (Ch.31), Work Item (Ch.32) and Dispatch Engine (Ch.33) are fully out. `POST /capabilities/{id}/fulfil` is a direct write, not a generated Command expanded into Work Items and dispatched to a pool.
4. **Deliverable transitions are gated by Authority + Policy only — never Evidence, Knowledge, Decision or Quality Gate**, even though `transition_definitions` has columns for the first two and could grow more. Knowledge (Ch.16), Evidence (Ch.17), Decision (Ch.19), Ontology (Ch.18) and Traceability (Ch.20) are fully deferred — this is the largest single scope cut in this plan and isn't visible in the brief's draft table (§1).
5. **EBM and EEC are one table (`ebms`), not two.** Each SEU gets a freshly-composed configuration; MVP doesn't reuse a published EBM across many SEUs, so the Draft→Validated→Published (EBM) / immutable-per-SEU (EEC) distinction collapses into one `Composed → Active → Superseded` status.
6. **Template owns mandatory Packs and required Capabilities only; Profile owns everything selectable** (optional Packs, tech/domain/compliance selection, config parameters, environment). Ch.6 and Ch.7's normative text, as written, both claim some of this surface — Sudha's own editorial note in Ch.6 gestures at this exact split as the intended resolution but the chapter bodies were never reconciled to match it. This plan adopts that split explicitly rather than re-deriving it from ambiguous source text.
7. **"Operational" = commissioning pipeline completed, not "≥1 Capability fulfilled."** Ch.37 never states what Operational requires (the word "Capability" doesn't appear in the chapter). This plan's own acceptance sequence reaches Operational *before* Capability fulfillment, so this is the only reading consistent with the brief itself, but it's a real gap in Ch.37, not a stated rule — worth re-checking against the EBM/Capability chapters before scope expands.
8. **SEU's `Pending` pre-state is this plan's own addition, not sourced from either book.** Ch.37's lifecycle starts at `Commissioned`, which is the *outcome* of the Ch.8 commissioning pipeline — neither chapter says what the SEU record looks like while that pipeline is still running. `Pending` exists so the pipeline has a row to attach the in-progress EBM composition and report to.
9. **Only two Dependency Graph edge types** (Deliverable, Capability) of Ch.9's six named types. Obligation/Decision/Knowledge/Evidence edges don't exist because those four object models don't exist in MVP (see #4).
10. **Only one Authority Rule outcome pair** (Authorised / Not Authorised) of Ch.22's six. No Conditions, Escalation, Delegation or Waiver outcomes; no Dual Authority (Platform vs. Engineering) split — that framing is an Architecture Catalogue ADR, not part of Ch.22's own evaluation function, and one rule type is sufficient for a real (not stubbed) check.
11. **Policy: `Exception` mechanism dropped.** Every MVP Policy is either satisfied or blocks — no waiver/exception workflow. `Standard` (non-blocking) Constraint Type is supported by the schema but unused by MVP seed data.
12. **No Pack SDK.** Packs are hand-authored JSON, loaded via a one-time seed script into the `packs.contributions` column. Composition strategy support is limited to what MVP's own Composition Engine actually needs (Override/Merge/Supplement over a small, low-conflict Pack set) — full Union/Intersection/Alias/Conflict-Detection sophistication isn't exercised.
13. **No Multi-Tenancy.** Single tenant, no `tenants`/`workspaces` tables. Every table's `Ownership` column from the Canonical Information Model collapses to "the whole deployment" for MVP.
14. **No views.** MVP is API-only (`src/routes/api/seu/`); `coding_principles.md`'s ViewModel Architecture isn't used because there's nothing to render yet, not because it's been rejected. **Superseded 2026-08-03 — see §7.**
15. **Deployment: single Node process, existing nginx, no containers.** Matches the brief's deferred "Deployment topology abstraction" row.

---

## 6. Build milestones and acceptance criteria

| Milestone | Scope | Done when |
|---|---|---|
| **M0 — Scaffold adaptation** | Add TypeScript to the existing Express app (tsconfig, build step, `tsx`/`ts-node` for dev, keep `"type": "module"`). Create `src/domain/engine/`, `src/domain/seu/`, `src/dblayer/seu/`, `src/routes/api/seu/` directories per §2.2. Write `002_seu_platform.sql` (§3). | `pnpm dev` runs the existing app unmodified in behavior, migration applies cleanly against a fresh DB, empty TS modules exist in all four new directories and compile. |
| **M1 — Data model** | All 17 tables migrated. `src/dblayer/seu/*.ts` — one file per table, following the adapted `{ data, error }` `pg` pattern (§2.3). Seed script loads a handful of hand-authored Pack JSON files (§5 #12) — at minimum one Platform Pack contributing Capabilities/Services/an Authority Rule/a Policy, one Template, one Profile. | Seed script runs idempotently; every dblayer function has a passing `node --test` covering its happy path against a real (test) Postgres DB. |
| **M2 — Core engine** | `compositionEngine.ts` (compose Packs → `ebms` row), `dependencyEngine.ts` (evaluate `dependency_edges` readiness), `transitionEngine.ts` (evaluate a `transition_definitions` row's Authority + Policy), `eventBus.ts` (publish → `events` row). Each is unit-tested against fixture data, with no HTTP layer involved yet. | Given a fixed set of Packs/rules/edges as fixtures, each engine module produces the documented output deterministically — same inputs, same outputs, run twice. |
| **M3 — Commissioning flow** | `src/domain/seu/commissioning.ts` orchestrates: resolve Template/Profile/Packs from dblayer → call `compositionEngine` → call `transitionEngine` to drive the SEU through `Pending → Commissioned → Configured → Activated → Operational` → seed `seu_capabilities`/`deliverables`/`dependency_edges` from the Template's catalogue. Endpoints #1–5 from §4 wired up. | `POST /api/seu/commission` against the seeded fixtures returns `lifecycleState: 'Operational'` with a populated `commissioningReport`; a deliberately-unauthorized request returns `4xx` with a diagnostic naming the failing Authority Rule, not a generic 500. |
| **M4 — Capability & Deliverable basics** | Endpoints #6–9 from §4. | A Participant can be created and fulfil a Capability (`seu_capabilities.status` flips to `Fulfilled`); a Deliverable can be created with dependencies and moved through at least two lifecycle states via `POST .../transition`, blocked correctly (`409`) if a dependency isn't yet `Satisfied`. |
| **M5 — End-to-end acceptance test** | An automated test script exercising the full sequence in §4's acceptance-test row against a real (test) database — no mocking of the engine layer. | The script passes unattended: **a real SEU is commissioned via the API, reaches `Operational`, ends up with at least one Capability `Fulfilled` and at least one Deliverable that has moved beyond `Defined`.** This is the brief's own definition of "MVP done," verified by a runnable test rather than manual inspection. |

**MVP is done** when M5's test passes against a clean database from a clean checkout — `pnpm install && migrate && seed && test:e2e` — with no manual steps in between.

---

## 7. Post-MVP changes (dated log)

§§1–6 above describe the MVP as originally scoped and built. Kept intact as the historical record rather than rewritten — what actually happened afterward is logged here instead.

**2026-08-03 — Admin UI added, superseding §5 item 14 ("No views").** A full server-rendered admin UI now exists, following `coding_principles.md`'s ViewModel Architecture exactly (`attachVM` + a per-view viewModel + EJS):
- **Home page** (`GET /aisworg`) — replaced the placeholder landing page; now renders the platform's own architecture-layer dashboard (User Experience / SEU Runtime / Extension Framework / Runtime Kernel, each component tagged Live / Partial / Deferred against what this MVP actually built), with live SEU / Pack / Event counts. Now requires login — it was public before, when it had nothing real to show.
- **Quickview** (`GET /aisworg/quickview`) — the post-login landing page, replaced the old placeholder inherited from this repo's earlier stock-app incarnation; now shows per-SEU progress (Capabilities Fulfilled X/Y, Deliverables Advanced X/Y) for every commissioned SEU.
- **SEUs** (`/aisworg/seu/seus`, list + detail) and **Packs** (`/aisworg/seu/packs`) — commission a new SEU from one form, fulfil Capabilities, transition Deliverables, inspect composed Packs and the event log — all calling the exact same `routes/seu/core/*` functions the API layer calls, no duplicated business logic.
- Module layout correction: UI business logic lives in `src/routes/seu/core/`, not `src/domain/seu/` as §2.2 originally sketched — see that section's own inline correction note for why.
- Two real, pre-existing gaps this work surfaced and fixed: no `express.urlencoded()` middleware existed anywhere in the app (the pre-existing Settings form likely never received `req.body` correctly either, before this fix); and `@types/express-serve-static-core` wasn't resolvable from `src/types/` under pnpm's strict dependency isolation, silently breaking the `req.vm` ambient type augmentation until installed as a direct devDependency.

**2026-08-03 — Dependency-readiness display bug found and fixed.** User testing (`design/observations/mvp1.md`) reported the Dependency Engine appearing not to gate transitions at all — a Deliverable's dependency note stayed "Pending" after the upstream Deliverable was approved, and the blocked transition then went through anyway. Investigation reproduced the scenario directly against a real commissioned SEU rather than relying on code review alone, and found the actual gate (`transitionDeliverable` → `dependencyEngine.isDeliverableReady()`) was correct throughout — it recomputes live and both blocks and allows correctly, confirmed by reproducing both outcomes in the same run. The real bug was narrower: `getSeuDetailView` (the detail page's read model) read the `dependency_edges.readiness_state` column raw, which is a write-side cache only updated as a side effect of a transition *attempt* on that exact Deliverable — a plain page reload never recomputed it, so the on-screen note could show stale "Pending" after the dependency was already satisfied. Fixed by having `getSeuDetailView` call `dependencyEngine.refreshEdge()` per edge before rendering, so the display always reflects live state — matching what the gate itself was already checking correctly.
- That investigation surfaced a genuine, separate, *unresolved* design question — whether a dependency should gate every transition of the dependent Deliverable, or only the specific transition that needs it — logged in `design/mvp-build-plan/Open Design Questions.md` rather than decided here, since answering it properly needs the Work Item/Execution Engine layer this MVP doesn't have (Ch.31–33, still fully deferred per §1).
