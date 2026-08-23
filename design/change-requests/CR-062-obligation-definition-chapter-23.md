# CR-062 — Obligation Definitions: closing the model gap (Chapter 23)

**Raised:** 2026-08-23 · **Origin:** owner, continuing the same audit discipline CR-058 (Quality Gate ↔ Ch.26), CR-059 (Review Gate ↔ Ch.25), CR-060 (Checklist ↔ Ch.47), and CR-061 (Policy ↔ Ch.24) used — working through Chapter 5 §19.4's own Pack-contribution list kind by kind. `contributionObligationDefinitions[]` is next; its governing model is Chapter 23 (Obligation Model). Design settled across a multi-message discussion (2026-08-23), summarized below. **Status:** ✅ Built 2026-08-23 (declaration only — execution deliberately out of scope, see "Not in scope").

> **Built 2026-08-23.** `tsc` clean throughout. Test suite not run this session, per standing instruction. Smoke-verified directly: both migrations applied cleanly against the live DB (migration replay is fragile against this DB, per standing practice — applied the two new files directly rather than via `migrate:seu`'s full replay); `db:clean-slate` runs end to end with no errors, all 22 real capability-pattern/SDLC-phase Packs republishing cleanly (none declare any `obligationDefinitions`, so nothing to migrate in real seed data — matches the pre-CR audit's own finding); the live SDK authoring form (`/aisworg/seu/sdk/pack-authoring/new`) renders the redesigned Obligation Definitions tab — `obligationType` gone, real `Category`/`Origin` `<select>` dropdowns in its place, 9 and 11 options respectively, correct required/optional markers, correct per-field help text — verified directly against the rendered HTML.
>
> **What's built, against the design above:**
> - **No new table, no `seedContributions` change.** `contributionObligationDefinitions[]` stays a JSONB-only declaration — the settled call that nothing else on the platform needs to cross-reference a specific Obligation Definition by id, unlike Checklist/Policy.
> - **`category:obligation`** (already existed): 4 missing Ch.23 §7 values seeded — Risk, Audit, Operational, Customer — alongside the 5 already live (migration [110](../../src/dblayer/migrations/110_obligation_category_and_origin_ontology.sql)).
> - **New Ontology concept type `category:obligation-origin`** (same migration), seeded with Ch.23 §10's own 11 named Obligation Sources (EBM, Policies, Authority evaluations, Reviews, Quality Gates, Compliance Packs, Organisation Packs, Customer requests, Participants, External systems, Telemetry and Knowledge Model). A categorical declaration of *which kind* of source, not a relational FK back to a specific raising entity — consistent with the no-real-table decision.
> - **`contributionObligationDefinitions[]` schema redesign** (migration [111](../../src/dblayer/migrations/111_obligation_definition_schema.sql)): `obligationType` dropped entirely; `category` (required) and `origin` (optional) added as real `x-referential`/`x-ontology` fields; `x-property-order`, per-field help, same discipline CR-058–061 established. Added to `SECTIONS_WITH_INLINE_HELP` (`_generatedFieldGroups.ejs`) so the per-field help renders inline instead of the old once-per-section write-up.
> - **`seuTypes.ts`**: `PackContributions.obligationDefinitions` updated to `{ code?, category?, origin? } & VerifiableItemFields`.
> - **`sdkAuthoring.ts`** (`loadReferentialOptions`): `category:obligation`/`category:obligation-origin` added to the generic referential-options map — no new picker mechanism needed, both are single-value `x-referential` fields the existing generic dispatch already handles.
> - **`core/packs.ts`**: `validatePackSeed` gains Obligation Definition validation (code required + unique within Pack, category resolves against `category:obligation`, origin — if given — resolves against `category:obligation-origin`). Declaration-only validation, no `seedContributions` upsert (no table to upsert into).
> - **Real seed data**: zero of the 22 real clean-slate-exercised Pack files (or any other Pack JSON in the repo) declare `obligationDefinitions` at all — nothing to migrate, matches the pre-CR audit's own finding exactly.
> - **Events (§19.12) deliberately not touched** — split out as **CR-063**, since a raised Obligation instance's own event emission is runtime/lifecycle behaviour, not Pack-authoring, per the same definition/execution boundary this CR applies everywhere else.
>
> **Files**: migrations [110](../../src/dblayer/migrations/110_obligation_category_and_origin_ontology.sql)–[111](../../src/dblayer/migrations/111_obligation_definition_schema.sql); `seuTypes.ts` (`PackContributions.obligationDefinitions`); `sdkAuthoring.ts` (`category:obligation`/`category:obligation-origin` in `loadReferentialOptions`); `core/packs.ts` (Obligation Definition validation loop); `_generatedFieldGroups.ejs` (`contributionObligationDefinitions` added to `SECTIONS_WITH_INLINE_HELP`, stale comment fixed); `formGenerator.ts` (`CONTRIBUTION_SECTION_HELP` string, stale `obligationType` reference removed); Chapter 5 §19.4, Chapter 23 §19.4/§19.5/§19.7/§19.12/Summary.

## The gap, precisely

Unlike Chapter 24/47, Chapter 23 already carries an exceptionally thorough §19 audit (dated 2026-08-22, predating this session's own CR-058 work) — code-verified, file:line cited, cross-checked live. Spot-checked again just now, still fully accurate: `obligations` table unchanged (11 columns — `id, seu_id, category, title, description, severity, status, created_at, updated_at, related_object_type, related_object_id`; no `originating_pack_id`, no `origin`, no `priority`, no `completion_criteria`, no `assigned_to`), `category:obligation` still exactly 5 seeded values, `seedContributions`/`validatePackSeed` still have zero references to `obligationDefinitions` anywhere.

Rather than repeat that audit, the parts most relevant to *this* CR — the Pack-contribution question specifically — pulled forward:

**Authoring schema** (`contributionObligationDefinitions[]`, live-queried): `code`, `obligationType` (free text), plus the shared §20 verifiable-item fields (`statement`, `classification`, `prompt`, `participant`, `outputContract`, `assurance`, `externalEvidence`). No `x-referential`/`x-ontology` anywhere, no `x-property-order`, no per-field help — the pre-CR-058 raw shape. `PackContributions.obligationDefinitions` (`seuTypes.ts`): `Array<{ code?: string; obligationType?: string } & VerifiableItemFields>`.

**Chapter 23 §19's own Summary, item 1 (its own words)**: *"Obligation Category is genuinely Ontology-backed — a real, working precedent for the redesign — but has zero Pack-contributed rows, and separately `obligations` itself has no `originating_pack_id` at all, unlike every comparable Pack-contributed entity on the platform (quality_gates/policies/capabilities/metric_registry/compliance_*). OM-005 has no mechanism whatsoever, not even a partial one."* That's the same shape of gap CR-058/059/060/061 each closed for their own entity — but `category:obligation` being *already* real (unlike Policy, which needed a brand new concept type) means part of this CR's work is already half-done.

**Category, more precisely (§19.4)**: 5 of the chapter's 8 named categories are seeded (Engineering, Compliance, Security, Organisational Learning) plus one extra the chapter doesn't name (`Review Finding`, imported from Ch.25's Finding model). Missing: **Risk, Audit, Operational, Customer**.

**Structure (§19.5, "7 of 16 fields real")**: real columns — Identifier, Title, Category, Description, Severity, Status, and a *single* polymorphic `related_object_type`/`related_object_id` pair standing in for what the chapter describes as five separate Related-* fields (Deliverables/Decisions/Evidence/Risks/Policies/Authority Rules — only one relationship per Obligation today, not several at once). Missing entirely: Origin, Priority, Completion Criteria, Traceability References. No Risk entity exists anywhere in the codebase at all.

**The live `obligationType` field's own purpose is unclear against the chapter.** Nothing in Ch.23 §8 names an "Obligation Type" distinct from Category — it may be intended as a finer-grained sub-classification *within* a Category (the chapter's own §7 "Examples" under each category read like sub-types — e.g. under Security: Vulnerability remediation / Penetration testing follow-up / Secret rotation / Privilege review), or it may be dead/redundant with `statement`. Needs settling, not assumed.

**Definition vs execution, the same boundary CR-061 established for Policy — but here the *existing* audit already independently found the identical shape of gap.** A Pack's `contributionObligationDefinitions[]` is a declared *type* of obligation a Pack knows how to raise; a real `obligations` row is a live *instance*, tied to one `seu_id`, created at runtime (today, only by 2 of the chapter's 11 named sources: sustained Telemetry patterns and Knowledge Acquisition Scope promotion — §19.7). Nothing today connects the two: no `originating_pack_id` on `obligations`, no reference back to *which* declared Definition (if any) a given raised Obligation came from. This is precisely why Origin (FR-23.5, "shall remain permanently recorded") is entirely unbuilt — there's no mechanism to record it from in the first place.

## Design, as settled

### No real Obligation Definition table — JSONB declaration stays sufficient

Unlike Checklist/Policy, nothing else on the platform needs to cross-reference a specific Obligation Definition by id — there's no equivalent of a Quality Gate's `requiredPolicyCodes` pointing *at* an Obligation Definition from elsewhere. Materializing a real table earns nothing without that reach. This CR is a schema/form-correctness fix on the existing JSONB declaration (`contributionObligationDefinitions[]`), not a new table, not `seedContributions` materialization, not a cross-Pack picker. Closes open question 1; makes question 2 (how a raised Obligation references its Definition) moot — there's no real Definition row to reference back to.

### Category — seed the 4 missing values, no new concept type

`category:obligation` already exists and is enforced (`assertCanonicalCategory`). Seed **Risk, Audit, Operational, Customer** alongside the 5 already live, to match Ch.23 §7 in full. A real dropdown on the authoring form, same as Policy's own `category:policy` treatment.

### `obligationType` — dropped, redundant with Category

Not a real sub-classification distinct from Category; removed from the schema rather than kept as a parallel/duplicate field.

### Origin — becomes Ontology-backed, a new concept type `category:obligation-origin`

Seeded from Ch.23 §10's own 11 named Obligation Sources: EBM, Policies, Authority evaluations, Reviews, Quality Gates, Compliance Packs, Organisation Packs, Customer requests, Participants, External systems, Telemetry + Knowledge Model. Same mechanism as `category:obligation`/`category:policy` — a categorical field on the declaration, not a relational FK back to a specific raising entity.

### Priority, Lifecycle, Completion Criteria, the five "Related *" fields — all execution-side, out of scope for this CR

Same definition/execution boundary as Policy/Checklist, applied consistently:
- **Priority** — a runtime value set when a real Obligation is raised; needs to be a dropdown (fixed vocabulary) whenever execution-side work eventually builds it, but isn't a Definition-level default.
- **Lifecycle** (§19.6) — already real and working; not touched by this CR at all.
- **Completion Criteria** — unlike Checklist item statements, this can't be meaningfully predefined at Pack-authoring time: what "done" looks like depends on specifics only known once the obligation is actually raised (e.g. a Risk-driven obligation can't have its remediation criteria written before the risk is even identified). Whoever opens the obligation during SEU execution specifies it.
- **Related Deliverables/Decisions/Evidence/Policies/Authority Rules** (§8) — an Obligation *instance's* own real relationships to other entities in a specific SEU, not something a Pack-level Definition can know in the abstract. Same reasoning as the no-real-table decision above: no cross-referencing at the declaration level.
- **Related Risks** specifically — moot regardless of the above, since Risk doesn't exist as an entity anywhere in the codebase.

## Not in scope

- Anything already confirmed real and working per the existing Ch.23 audit: the lifecycle mechanism (§19.6), Dependency Engine integration (§19.8), FR-23.8's Telemetry→Organisational-Learning-Obligation loop (§19.3/19.7) — none of this needs touching.
- Delegation (FR-23.7), Ownership (§19.10), Escalation (§19.11) — all confirmed entirely unbuilt by the existing audit, not Pack-contribution questions; a separate CR if ever picked up.
- Risk as a first-class entity — doesn't exist anywhere; building it is a materially bigger undertaking than this CR's own scope.
- Priority, Completion Criteria, and the Related-* fields as real execution-time mechanisms — this CR only settles that they're *not* Definition-level; building the actual raise-an-Obligation execution flow that captures them is separate, unscheduled work.
- §19.12 (Obligation's own named lifecycle events, 2 of 8 real) — execution-side (a raised Obligation's own lifecycle emits events, not something Pack authoring touches), split out as its own CR (CR-063) rather than folded in here.

## Scope (once built)

- `contributionObligationDefinitions[]` schema: drop `obligationType`; add `x-ontology` for `category` (`category:obligation`) and `origin` (`category:obligation-origin`); `x-property-order`, per-field help, matching the CR-058–061 authoring-form treatment.
- `PackContributions.obligationDefinitions` (`seuTypes.ts`) updated to match.
- Seed data: 4 new `category:obligation` values (Risk, Audit, Operational, Customer); new `category:obligation-origin` concept type seeded with Ch.23 §10's 11 sources.
- No new migration, no new table, no `seedContributions`/`validatePackSeed` changes beyond validating the declaration's own Ontology-backed fields.
