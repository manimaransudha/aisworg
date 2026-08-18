# CR-016 — Schema-structured Pack contributions (the §20 executable-verification grammar)

**Raised:** 2026-08-13 · **Origin:** owner — the Pack form's `contributions` is a single opaque raw-JSON field, so "change the validator, the form and validation follow" doesn't hold *inside* contributions; and §20's executable-verification model needs per-item fields that don't exist. · **Status:** ✅ Built 2026-08-14 (declaration half; absorbs §19.14 A1/A2/A3/D1)

> **Built 2026-08-14.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip**. Smoke-verified: the opaque `contributions` blob is **gone**, replaced by flattened structured lists (capabilities/services/authorityRules/policies/qualityGates/checklists/reviewGates/obligationDefinitions); verifiable rows carry the **§20 fields** (classification dropdown, `externalEvidence` checkbox, prompt, participant/outputContract dropdowns, assurance); and the owner's example works end-to-end — **a checklist with two items, one `machine-verifiable` and one `judgment`**, published with each item's classification/prompt/participant preserved in `packs.contributions`. Not committed.
>
> **Files:** migration [040_pack_structured_contributions.sql](../../src/dblayer/migrations/040_pack_structured_contributions.sql) (grammar restructure), [seuTypes.ts](../../src/dblayer/seuTypes.js) (`VerifiableItemFields` + new contribution types + §20 on qualityGates), [core/sdkAuthoring.ts](../../src/routes/seu/core/sdkAuthoring.js) (`toPackSeedInput` reassembles flattened lists → `contributions`, legacy fallback). Reuses the CR-017 per-item enum/boolean generator — **no further generator change**.
>
> **Decisions / scope held:**
> - **Flattened** each contribution kind to a top-level repeatable list; reassembled into `contributions` at publish. **Classification is per item** (per row) — the owner's checklist example.
> - **Declaration-only.** Structured contributions persist in `packs.contributions` (JSONB). Checklists/Review Gates/Obligation Definitions are **not** materialised into tables, and the §20 fields are **not** added to `quality_gates` — executing them (dispatch prompt → Evidence → gate; judgment → Review; human-attested → Obligation) stays the §19.14 **B-group** follow-ups.
> - **Compliance** (frameworks/requirements — deeply nested) kept as a raw-JSON `contributionsCompliance` field for now.
> - **UX nuance:** verifiable lists have many columns, so rows are wide — functional but a candidate for the CR-013 styling pass.

### The gap
The Pack grammar declares `contributions` as `x-widget: "json"` — an opaque blob. Consequences:
- Field additions inside contributions **do not** flow to the form or to validation (the form just shows a JSON textarea), breaking the "validator is the single source of truth" principle *within* contributions.
- §20 (Executable Contributions & Verification Classification) requires each *verifiable* contribution to declare structured metadata that has **nowhere to live** today.

### What's built here
Replace the opaque `contributions` blob with **schema-defined structure**, so `formGenerator` renders real sections and `validateAuthoredContent` checks them — field changes become validator-only changes, exactly as for the top-level fields.

**1. Structure the existing contribution types** (§9 built subset) as schema objects rather than free JSON: `capabilities[]`, `services[]`, `authorityRules[]`, `policies[]` (Policy/Standard via `constraintType`), `qualityGates[]`, `complianceFrameworks[]`, `complianceRequirements[]`.

**2. Add the §20 per-verifiable-item fields** to each *verifiable* contribution (checklist item, quality-gate criterion, review requirement, obligation):

| Field | Schema |
|---|---|
| Statement | `statement: string` (human-readable standard) |
| Classification | `classification: enum` — `machine-verifiable` / `judgment` / `human-attested`, + optional `externalEvidence` marker (§20.3/§20.4) |
| Prompt | `prompt: string` — the AI instruction, for AI-executed classes |
| Participant assignment | `participant: enum` — AI / AI+human / human-authority |
| Output contract | `outputContract` — `Passed/Failed+notes` or `assessment+acceptance` |
| Assurance policy *(optional)* | `assurance` — confidence/severity threshold that escalates to a human (§20.2) |

**3. Add the missing contributable *types*** as schema-structured (§19.14 A3): **Checklists**, **Review Gates**, **Obligation Definitions** — the types §20's model centres on.

**4. Form + validation follow automatically** — once the shape is in `schema_definitions`, `formGenerator` builds the sections and `validateAuthoredContent` enforces them (this is the whole point of the schema-registry architecture). This is §19.14 item **D1** (authoring UX) realised by construction.

### Relationship to the backlog
Absorbs §19.14 items **A1** (verifiable-item metadata), **A2** (classification axis), **A3** (missing types), and **D1** (authoring UX). The **execution bindings** — §19.14 **B1** (machine-verifiable → dispatch prompt → Evidence → Quality Gate), **B2** (judgment → Review → `requires_accepted_review`), **B3** (human-attested → Obligation), and extensions **C1/C2** — remain **separate follow-up CRs**: this CR is the *declaration* half (grammar + form + validation), not the *execution* half.

### Dependencies / notes
- Best done **after CR-015** (which makes the schema-registry the enforced single source of truth — validate on import/save — and cleans up `code`/`category`), so this builds on a validator that's actually authoritative at every entry point.
- The schema version bumps (immutable/additive — Ch.5 §19.2); existing Packs authored against v1 keep validating against v1.
- Cross-ref **CR-011** (Objective→Capability derivation) and Chapter 5 **§20**.
