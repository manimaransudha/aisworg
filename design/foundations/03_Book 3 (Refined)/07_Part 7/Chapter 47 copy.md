# Chapter 47 – Checklist Model

---

# 1. Purpose

The Checklist Model defines how discrete, Pack-contributed verification items are structured, executed and translated into Evidence within a Software Engineering Unit (SEU).

A Checklist is one possible implementation of the work a Participant performs to satisfy a Quality Gate or Policy — not a governance mechanism in its own right (Chapter 26 §1). It produces Evidence. It does not evaluate whether a governed transition may occur.

A Checklist defines **what a Participant verifies**.

Evidence records **what was found**.

Policy and Quality Gate evaluation decide **what that means for the transition**.

---

# 2. Scope

This chapter defines:

- the Checklist abstraction;
- Checklist Item structure and classification;
- Mandatory and Recommended items;
- Checklist execution and its output contract;
- Checklist composition;
- Checklist lifecycle;
- the relationships between Checklist, Evidence, Policy and Quality Gate.

This chapter does not define:

- Evidence structure (Chapter 17);
- Policy structure or evaluation (Chapter 24);
- Quality Gate structure or evaluation (Chapter 26);
- Participant implementations (Chapter 5 §19, Participant Integration Model).

---

# 3. Architectural Position

```
Pack
    │
    ▼
Checklist
    │
    ▼
Participant Execution
    │
    ▼
Evidence
    │
    ▼
Policy Evaluation / Quality Gate Evaluation
    │
    ▼
Governance Evaluation
```

Checklists supply the procedural work a Participant carries out. They do not themselves participate in governance evaluation.

---

# 4. Definition

A Checklist is a Pack-contributed, ordered set of verification items that an assigned Participant executes against a specific Deliverable or other governed artefact.

Executing a Checklist produces an Evidence record (Chapter 17). The Checklist itself is never referenced by Governance evaluation directly — only the Evidence it produces is.

Checklists do not execute engineering work themselves.

Checklists do not evaluate governed transitions.

Checklists do not grant authority.

---

# 5. Architectural Principles

## CKM-001

Checklists are declarative containers of verification items. They do not themselves evaluate governed transitions.

---

## CKM-002

Checklists are Pack-contributed and composable.

---

## CKM-003

Checklists possess no independent version or lifecycle of their own. Both are inherited entirely from the originating Pack (Chapter 5 §14, §15) — a Checklist's content changes only when its Pack's version changes.

---

## CKM-004

Checklist execution is performed by an assigned Participant, never by the Runtime Kernel.

---

## CKM-005

Checklist execution results are itemized and immutable once recorded as Evidence.

---

## CKM-006 — superseded (CR-060, 2026-08-23; revised same day)

Originally: Classification (Chapter 5 §19.3) and Mandatory/Recommended designation were independent axes of a Checklist Item, mirroring Policy's own Constraint Type/Severity independence (Chapter 24 PM-007). Neither exists on a Checklist Item any more. Classification went first (Participant Assignment's own three values covered the same distinction); then, on a sharper principle, everything else did too — a Checklist Item is generic, reusable content; Mandatory/Recommended, Participant, and every other execution/requirement fact belong to the Pack referencing the Checklist, not the Checklist itself (owner: "you cannot determine a checklist item to be mandatory. Checklist is generic. Pack has the specifics."). See §9.

---

## CKM-007 — superseded (§7)

Checklist Category, and the Evidence Category vocabulary it was to reuse, no longer exist on Checklist at all — see §7.

---

# 6. Functional Requirements

### FR-47.1

Every Checklist shall possess a unique identifier scoped to its originating Pack.

---

### FR-47.2

Checklists shall be contributed through Packs.

---

### FR-47.3 — superseded (§7)

Was: every Checklist shall declare exactly one Category, drawn from the Evidence Category vocabulary. Checklist declares no Category at all now.

---

### FR-47.4 — superseded (§14, §15)

Was: Checklists shall support composition from multiple Packs via Union (Category-keyed). Replaced by Review Gate/Quality Gate's own `checklistIds`: a Checklist referenced by more than one gate runs once and satisfies all of them — an identity-keyed dedup, not a Category-keyed Union.

---

### FR-47.5 — superseded (§9, §10)

Was: every Checklist Item shall declare a Mandatory or Recommended designation. Checklist Item declares nothing beyond Statement now — Mandatory/Recommended is a property of a gate's *reference* to a Checklist (`checklistIds`/`recommendedChecklistIds`), not of the Item.

---

### FR-47.6

Checklist execution shall be performed by an assigned Participant.

---

### FR-47.7 — narrowed (§9, §11)

Checklist execution shall preserve itemized, per-item results within the resulting Evidence, and shall not collapse them into a single aggregate verdict prior to Evidence creation. (Was: "including each item's Mandatory/Recommended designation" — no longer applicable; there is no such designation on an Item.)

---

### FR-47.8 — superseded (§10)

Was: a Checklist execution's baseline outcome shall be Passed only if every Mandatory item is satisfied. A Checklist has no Mandatory/Recommended items to distinguish any more (§9) — its baseline outcome is a plain AND across every Statement. Mandatory-vs-Recommended now describes the *gate's* treatment of the whole Checklist (§10), not anything within it.

---

### FR-47.9

Quantitative thresholds over Recommended items (for example, a minimum satisfaction percentage) shall be declared as Policy Conditions (Chapter 24 §8) and evaluated during Governance evaluation (Chapter 24 §11) — never within Checklist execution, and never by a Participant acting as evaluator of the threshold itself.

---

### FR-47.10

Checklists shall not be independently versioned. A Checklist's effective version is its originating Pack's version.

---

### FR-47.11

Checklists shall not persist independent lifecycle state. A Checklist's availability follows its originating Pack's lifecycle state (Chapter 5 §15) directly.

---

# 7. Checklist Categories — superseded (CR-060, 2026-08-23)

**This section no longer describes how Checklist is built.** The Category-based design below was superseded during CR-060's own design discussion, before Checklist's declarative side was ever implemented against it — kept here, marked, rather than silently deleted, so the reasoning that led away from it stays legible.

Original design: Checklist Category was to be drawn from the Evidence Category vocabulary (Chapter 17 §7: Analytical, Validation, Operational, Review, Decision, External) — the same field a Quality Gate's Required Evidence entries name — so that multiple Checklists, potentially contributed by different Packs, would Union-compose against a single Required Evidence entry for a given transition, without a gate needing to enumerate which Checklists satisfy it.

**Why it was dropped**: once Review Gate and Quality Gate each gained their own `governedTransition` (and Quality Gate its own `category`), a Checklist's Category/Capability/Applicable-Deliverable-Type/Applicable-Transition fields were pure duplication of scope the *referencing* gate already carries. Checklist doesn't need to declare where it applies — the gate(s) that require it already say so. See §8 (Structure, narrowed) and §14 (Relationship to Quality Gate and Review Gate, replaced).

---

# 8. Checklist Structure

**Built (CR-060, 2026-08-23), narrower than originally drafted.** Every Checklist defines:

- Identifier (Name)
- Description
- Items
- Originating Pack

No Category, Capability, Applicable Deliverable Type, or Applicable Transition (§7 — superseded). A Checklist carries no scope of its own; whichever Review Gate(s) or Quality Gate(s) reference it via `checklistIds` (§14) carry that instead.

A Checklist has no Version field of its own (§16). Its effective content changes only when its originating Pack republishes it.

**Identifier, and cross-Pack reach, corrected from the original draft — then corrected again the same day.** The Identifier (a Checklist's `Name`) is still not an Ontology-governed code — but Checklists ARE looked up by identity across Packs, contrary to what this section originally said. A Checklist is real and persisted (the `checklists` table), addressed by its own real, database-assigned id.

The first correction pass over-read this as fully unconstrained, "same reach as Policy." **That was wrong**, caught only after the built form actually showed it: a Review Gate or Quality Gate may reference a Checklist belonging to a Pack sharing its own **`code`** — any version, any tenant, since `code` alone isn't a unique identifier (CR-026's `(code, pack_version, tenant_id)`) — not any Pack's Checklist unconditionally. Owner, on why Policy's own reach doesn't transfer here: *"If checklists are global, then we would have created a registry? isn't it?"* Policy has genuinely unconstrained reach *and* its own global, registry-like code namespace; Checklist has neither (§16/§20 — deliberately no registry). A Checklist's Name is only guaranteed unique *within* its own originating Pack (`(originating_pack_id, name)`) — never used as a cross-Pack lookup key on its own; a reference is by the real id (or, for a raw seed file referencing its own Pack's Checklist, by that same-Pack name — §14).

---

# 9. Checklist Item Structure

**Built (CR-060, 2026-08-23; revised same day).** A Checklist Item is, in the end, just:

- Statement

Every other field originally drafted here — Classification, Mandatory Designation, Participant Assignment, Output Contract, Assurance Policy, External Evidence flag, Prompt — was removed, in two passes. Classification went first (owner: "Participant can be used. Classification can be dropped."), then everything else at once, on a sharper principle than "these happen to be redundant": *"you cannot determine a checklist item to be mandatory. Checklist is generic. Pack has the specifics."* A Checklist is reusable, context-free content; how it's checked, who checks it, and whether completing it is required are all facts about the *Pack referencing it*, not the Checklist itself — see §14. Participant Assignment specifically is now fully redundant with Review Gate's own top-level `participant` field (which already covers everything that gate does, including whichever Checklists it references) and with Quality Gate's engine-driven, never-participant evaluation (§14).

A Checklist Item has no identifier of its own beyond its position within its Checklist's declared item list — items are never referenced individually outside their Checklist.

---

# 10. Mandatory and Recommended — moved from Item to reference (CR-060, revised 2026-08-23)

**This section no longer describes an axis of the Checklist Item** (§9) — Mandatory/Recommended never belonged there in the first place (owner's own correction, §9). It now lives on the *referencing* Review Gate or Quality Gate: `checklistIds` (required — every listed Checklist must complete) and `recommendedChecklistIds` (advisory — completing them doesn't block the gate), see §14.

This preserves the original intent exactly, just relocated: a Recommended Checklist's completion "doesn't by itself determine the outcome," the same role a Recommended Item always had — it's simply the whole Checklist that's now Mandatory-or-Recommended relative to one specific gate, not each of its Items relative to the Checklist itself. The same Checklist can be `checklistIds` (required) for one gate and `recommendedChecklistIds` (advisory) for another — its own content never changes; only how strictly a given gate treats it does.

Any finer-grained rule beyond required/advisory — a minimum count, a minimum percentage across several Recommended Checklists — is still not a Checklist (or gate-reference) concern; it remains a Policy Condition question, unchanged from the original design (FR-47.9, §13).

---

# 11. Checklist Execution and the Output Contract

**Not yet reconciled with §9/§10's revision (CR-060, 2026-08-23) — flagged for whoever picks up execution, not silently resolved here.** This section originally described per-item results each carrying "the item's Mandatory/Recommended designation" — that field no longer exists on a Checklist Item (§9). With Mandatory/Recommended now living on the gate's *reference* to a whole Checklist (§10), not on individual items, a Checklist's own baseline outcome simplifies to a plain AND across all its items — every Statement in a Checklist must be satisfied for that Checklist to report Passed; there is no longer a partial-credit Recommended-item concept *within* one Checklist. What stays true: an assigned Participant executes every item and records a result for each; the output contract is still the itemized set of per-item results, not a single collapsed verdict — each result preserves the item's position, its outcome (Passed / Failed / Not Applicable), and any supporting notes.

Itemization still matters for a different reason now: a Policy Condition (Chapter 24 §8) evaluating a specific Checklist's Evidence still needs to see each Statement's own result, not just one collapsed boolean, even though there's no more Mandatory/Recommended split inside that Evidence to compute over.

---

# 12. Relationship to Evidence

Executing a Checklist produces exactly one Evidence record (Chapter 17). ~~of the Checklist's declared Category~~ — **open question, not yet settled (CR-060 dropped Checklist's own Category, §7; §11's execution mechanics remain undecided as a whole, out of this CR's scope):** since a Checklist no longer declares a Category, what Category its produced Evidence row is filed under is unresolved. It was previously the Checklist's own declared Category, verbatim; whoever picks up execution needs to settle this before Evidence rows can actually be created. The Evidence's content still preserves the itemized per-item results produced during execution (§11).

The Evidence's originating Participant (Chapter 17 §12) is the Participant who executed the Checklist. The Checklist's own originating Pack is a separate provenance fact, carried alongside it, not conflated with it.

---

# 13. Relationship to Policy

**Same open question as §12** applies here: a Policy's Required Evidence field (Chapter 24 §8) matches Evidence by Category — if a Checklist-produced Evidence row's own Category is unresolved (§12), so is whether/how it satisfies a Policy this way. Unlike Quality Gate and Review Gate (§14, which moved to a direct `checklistIds` reference), Policy's own relationship to Checklist was never redesigned in this CR — it still describes the original Category-matching model, unverified against anything built.

A Policy's Conditions field (Chapter 24 §8) may declare a threshold formula over the itemized item results within that Evidence — for example, "all Mandatory items satisfied and at least 80 percent of Recommended items satisfied." Governance evaluation (Chapter 24 §11) computes this deterministically from the itemized Evidence. Neither the Checklist nor the executing Participant performs this computation (FR-47.9).

---

# 14. Relationship to Quality Gate and Review Gate

**Built (CR-060, 2026-08-23; revised twice same day), replacing the Category-matching design entirely.** Both Quality Gate (Chapter 26 §8) and Review Gate (Chapter 25 §8) gain their own `checklistIds` and `recommendedChecklistIds` — lists of real Checklist ids, not a Category to match against. A gate requires exactly the Checklist(s) it names, by identity, scoped to Checklists belonging to a Pack sharing this gate's own Pack's `code` (§8's own corrected reach — not unconditionally any Pack) — never an implicit "whichever Checklist happens to share my Category" match.

Also where Mandatory/Recommended lives now (§10, following the owner's own correction that a Checklist Item can't carry that designation): `checklistIds` is a gate's *required* Checklists; `recommendedChecklistIds` is its *advisory* set. Both are lists of the same kind of thing (a real Checklist id) — the field a Checklist id is placed in is what determines whether that Checklist is required or advisory for this specific gate. The same Checklist can be `checklistIds` for one gate and `recommendedChecklistIds` for another.

Semantics, settled directly (owner: "Every quality gate is defined by category and that is an AND"):

- **Within one gate's own `checklistIds` list: AND.** Every listed Checklist must complete — the same "structural AND across populated requirements" discipline Quality Gate already had for multiple Required Evidence categories, now applied to an explicit list instead of an implicit Category scan. `recommendedChecklistIds` entries don't participate in this AND — completing them is tracked but never blocks the gate (§10).
- **Across different gates referencing the same Checklist: the Checklist runs once, not once per referencing gate** (owner: "If gates point to same checklist, it is taken once"). Two Quality Gates and three Review Gates can all list the same Checklist id; its one execution's result satisfies all five. This is Category-based Union's real successor — the same "don't re-run the same work for every gate that needs it" guarantee, now identity-keyed instead of Category-keyed (§15).

Execution itself — a Participant actually working through a referenced Checklist's items and producing Evidence — is SEU-commissioning-phase work, not part of this CR; Pack-side declaration stops at validating that every `checklistIds`/`recommendedChecklistIds` entry resolves to a real Checklist.

---

# 15. Checklist Composition

**Built (CR-060, 2026-08-23) as identity-based dedup, not Category-based Union.** Checklists, like Policies (Chapter 24 §10) and Capabilities, may originate from multiple Packs — but composition across Packs now happens at the *referencing gate's* `checklistIds` list, not at the Checklist's own declared scope (Checklist has none — §8).

```
Go Development Pack's own Review Gate: checklistIds = [checklist-A]

        +

JavaScript Development Pack's own Quality Gate: checklistIds = [checklist-A, checklist-B]

        ↓

checklist-A executes once; its result satisfies
both gates, from both Packs, without either
Pack needing to know about the other
```

Composition shall preserve deterministic behaviour. A Pack author referencing a Checklist by id still doesn't need to coordinate with whichever other Pack(s) also reference it — the "no coordination required" guarantee survives the redesign; only the matching key changed, from an implicit shared Category to an explicit shared id.

---

# 16. Checklist Versioning and Lifecycle

A Checklist shall possess no independent lifecycle or version. It is declarative content carried inside its originating Pack's contributions and inherits the Pack's lifecycle and version in full.

This is a deliberately lighter position than Quality Gate and Review Gate (Chapter 26), which carry their own `version` and an `is_active` flag rather than the full Draft→...→Archived lifecycle used elsewhere in this book. Those two entities need independent identity because other records reference them directly by id across Pack versions — a Quality Gate Waiver references a specific Quality Gate; a Review references a specific Review Gate; a Transition Definition's required Quality Gate list references specific gate identities.

**Corrected (CR-060, 2026-08-23): a Checklist DOES have real external referents now** — Review Gate's and Quality Gate's own `checklistIds` (§14), from any Pack, hold a stable reference to a specific Checklist by its real id. What stays true from the original reasoning is narrower than first drafted: nothing outside its own Pack ever holds a reference to a specific *version* of a Checklist, because a Checklist has no version to reference — its `id` is what's real and stable (owner: "It stays... Someone wants to update the checklist with a new item, they can without a version change"), and that same id simply keeps meaning the same Checklist, current content included, across every republish of its originating Pack. A real table exists for exactly this reason (owner: "Checklist can be in a table to get a fk. the chapter does not impose the implementation details") — §16's own "no registry/versioning service" conclusion below is about lifecycle machinery, not about whether a persisted row exists.

Historical Checklist content therefore remains reproducible exactly as far as historical Pack versions remain reproducible (Chapter 5 §14) — no separate reconstruction mechanism is required.

---

# 17. Events

A Checklist has no independent lifecycle (§16), so it publishes no creation, validation, publication, deprecation or retirement events of its own — those are published by the Pack subsystem (Chapter 5 §16) when the originating Pack transitions.

Checklist execution is a runtime activity and publishes:

- ChecklistExecutionStarted
- ChecklistItemEvaluated
- ChecklistExecutionCompleted

---

# 18. Non-Functional Requirements

The Checklist Model shall:

- support deterministic composition;
- preserve itemized, immutable execution results;
- support independent versioning;
- remain independent of Participant implementation technology.

---

# 19. Acceptance Criteria

✓ Checklists can be created and are contributed through Packs — **built** (CR-060; real `checklists` table, `checklistsDB.upsert`).

✗ ~~Every Checklist declares exactly one Category~~ — superseded (§7): Checklist declares no Category.

✗ ~~Checklist Items declare both a Classification and a Mandatory/Recommended designation~~ — superseded twice over (§9): neither field exists on an Item any more. A Checklist Item is just its Statement; Mandatory/Recommended is now the referencing gate's own `checklistIds`/`recommendedChecklistIds` (§10).

○ Checklist execution produces itemized, non-collapsed results as Evidence — not built (SEU-commissioning-phase work, out of this CR's scope).

✗ ~~A Checklist's baseline outcome reflects Mandatory items only~~ — superseded (§10, §11): with no Mandatory/Recommended split within a Checklist any more, its baseline outcome (once execution exists) is a plain AND across every Statement.

✓ Checklists referenced by more than one gate run once, not once per gate — **built** as identity-based dedup (§14, §15), not the originally-drafted Category-based Union.

✓ Historical Checklist content remains reproducible via its originating Pack's version history, without independent Checklist versioning — **built** (`checklists.id` stays stable across a republish of the same Pack — checklistsDB.upsert keyed on `(originating_pack_id, name)`).

---

# 20. Deliverables

**Built (CR-060, 2026-08-23; revised same day):**
- Checklist domain model (`checklists` table; `ChecklistRow`/`ChecklistItem` — `{statement}` only, `seuTypes.ts`).
- Checklist declaration + validation (`core/packs.ts`'s `validatePackSeed`/`seedContributions`).
- `checklistIds` and `recommendedChecklistIds` on Review Gate and Quality Gate (§10, §14).
- SDK authoring form: the nested Checklist→Items widget, and the same-code-scoped `checklistIds`/`recommendedChecklistIds` multi-selects — two new form-generator capabilities (`formGenerator.ts`'s `"nested-list"`/`"referential-multi"` item-field kinds), not reused from Quality Gate/Review Gate's own (flat, single-value) authoring widgets.

**Not built — deferred to SEU-commissioning-phase work:**
- Checklist Item domain model's own *execution* (a Participant working through `items`, producing one Evidence record per run).
- Checklist execution service, APIs, and events (`ChecklistExecutionStarted`/`ChecklistItemEvaluated`/`ChecklistExecutionCompleted`, §17).
- Any evaluation of `checklistIds`/`recommendedChecklistIds` — a gate references its required/advisory Checklists declaratively; nothing yet checks whether they've actually been completed (§14).

No Checklist registry or independent versioning service is required or was built (§16) — confirmed correct as originally drafted, not just assumed: `checklistsDB.ts` has no version/lifecycle methods, only `upsert`/`findById`/`findByIds`/`findAllWithPackInfo`.

---

# 21. Implementation Specifics (CR-060, 2026-08-23)

The sections above carry their own inline "Built"/"superseded" notes at the point each finding applies; this section consolidates the concrete, code-grounded facts in one place — same role Chapter 5 §19.4 and Chapter 25/26's own §19.x audits play for their entities, adapted to a chapter with no pre-existing §19 audit structure of its own.

**Database.**
- `checklists` (migration `100_checklist_table.sql`): `id`, `name`, `description`, `originating_pack_id` (FK to `packs`, `NOT NULL` — provenance only, not a reference-scoping constraint, §8), `items` (`JSONB`, default `'[]'`), `created_at`, `updated_at`. No `version`/`is_active`/lifecycle column. Unique index `checklists_pack_name_key` on `(originating_pack_id, name)` — the upsert key that keeps a Checklist's `id` stable across every republish of its own Pack (§16).
- `quality_gates` and `review_gates` each gain `checklist_ids UUID[]` (migration `101_gate_checklist_ids.sql`) and `recommended_checklist_ids UUID[]` (migration `103_gate_recommended_checklist_ids.sql`), both `NOT NULL DEFAULT '{}'`. No native Postgres array FK exists for either column; referential integrity is enforced at publish time by `validatePackSeed`, not by the database.
- Checklist Item's live JSON shape, confirmed against real data: `{"statement": "..."}` — nothing else (migration `104_checklist_item_simplified.sql` narrowed the authoring schema to match, after an initial build that also carried `mandatory`/`participant`/`outputContract`/`assurance`/`externalEvidence`/`prompt` was corrected the same day).

**Code.**
- [`checklistsDB.ts`](../../../../../src/dblayer/checklistsDB.ts): `upsert` (transactional, `ON CONFLICT (originating_pack_id, name) DO UPDATE`), `findById`, `findByIds`, `findByPackCode` (joins `packs`, scoped to Checklists whose owning Pack shares the given `code` — the picker's real source, corrected from an original, over-broad `findAllWithPackInfo`), `deleteByOriginatingPackIds`.
- `core/packs.ts`: `validatePackSeed` validates each declared Checklist (`name` required, at least one Item, each Item's `statement` required) and each gate's `checklistIds`/`recommendedChecklistIds` entries via `validateChecklistIds` — an entry resolves either as this same Pack's own declared Checklist `name` (not yet persisted, for raw seed JSON) or as an already-real `checklists.id` whose owning Pack's `code` matches this Pack's own `code` (checked via `packsDB.findById`, corrected from an original check that accepted any Pack's Checklist unconditionally). `seedContributions` upserts `checklists` before `reviewGates`/`qualityGates` (mirroring the pre-existing `reviewGateIdByCode` pattern for `requires_accepted_review`), building a `checklistIdByName` map so a same-Pack name reference resolves to the real id at publish time.
- `cleanSlate.ts` step 2b deletes non-base-Pack `checklists` rows the same way it already handles `capabilities`/`services`/`review_gates` — a plain pack-scoped filter, no code-allowlist, since `platform-core-engineering.pack.json` declares zero Checklists.
- SDK authoring form: `formGenerator.ts` gained two `ReferentialListItemField` kinds that didn't exist before this CR — `"nested-list"` (an item field that's itself a repeatable sub-list; `buildItemFields`/`buildRow` were extracted and made recursive to support it) and `"referential-multi"` (a referential field that picks several values, via a new `x-multi` schema marker). `_referentialListGroup.ejs`/`public/js/referentialListGroup.js` render and wire both: a `.nested-list-group` widget with its own delegated "+ Add item"/Remove handling, and a `<select multiple>` sourced from `sdkAuthoring.ts`'s `loadChecklistOptions` (scoped to the authoring Pack's own `code`, empty until it's chosen; id + Checklist name + originating Pack name). Both view-mode and edit-mode resolution match a stored `checklistIds` entry by id OR by same-Pack Checklist name — a raw seed file's reference is a name, never rewritten into the Pack's own `contributions` JSON as a resolved id, so an id-only match silently fails to display it (a real bug, caught and fixed against live data, not just in review).

**Real seed data.** All 22 real Pack files (6 EPF/OpenUP capability-pattern Packs, 16 SDLC-phase Packs) declare one Checklist each, holding the same statements their pre-CR-060 flat, undeclared-`code`-keyed rows used to carry — re-simplified twice, first when Items still carried `mandatory`/`participant`/etc., again when those fields were dropped. 13 of the 22 also have their own Review Gate, each now carrying `checklistIds` pointing at that same Pack's own Checklist by name. `db:clean-slate` re-verified running clean end to end after each revision; `checklists` holds exactly 22 rows post-clean-slate, one per real Pack.

**Confirmed live, not just asserted**: republishing the same already-Active Pack a second time (no wipe) leaves its Checklist's `id` byte-for-byte unchanged — the "id stays stable across a republish" design decision (§16) actually holds, not just in the migration comments.
