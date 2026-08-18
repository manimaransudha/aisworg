# CR-019 — Consolidate transition-definition authoring on the CR-007 form (drop the stale SDK grammar path)

**Raised:** 2026-08-14 · **Origin:** owner — the `TransitionDefinition` schema-registry grammar (v1) is stale: it declares the pre-CR-006 `requiredAuthorityRuleCode` and a hardcoded noun enum, and has **no `verb`** — it doesn't reflect the live noun × verb model (Noun + From + To + **Verb → `noun_verb` badge**). · **Status:** ✅ Built 2026-08-14

> **Built 2026-08-14.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip**. Smoke-verified: the `/sdk/transition-definition-authoring` page now shows **only** the CR-007 add/retire form + live list (no "New draft" button, no "Authoring sessions" section, a note that it's authored noun × verb); the create-draft POST is **blocked**; the schema registry **no longer offers** a "New TransitionDefinition version"; Pack authoring is unaffected. Not committed.
>
> **Files:** [web/sdkAuthoring.ts](../../src/routes/seu/web/sdkAuthoring.js) (suppress draft affordances + block TD create), [authoring/index.ejs](../../src/views/seu/sdk/authoring/index.ejs) (hide drafts when `showDrafts` false), [core/schemaRegistry.ts](../../src/routes/seu/core/schemaRegistry.js) + [schemaCompiler.ts](../../src/domain/sdk/schemaCompiler.js) (drop `TransitionDefinition` from authorable kinds), test [schema-registry.test.ts](../../tests/schema-registry.test.js) (retargeted from the retired `TransitionDefinition` throwaway kind to `Profile`, self-healing preserved).

### The problem
Transition definitions can be authored **two ways**, and they've diverged:
1. **CR-007 `/authority/transition-definitions/add` form** (`addTransitionDefinition`) — the **correct, current** model: Noun (validated against active `authority_nouns`) + From + To + **Verb** (validated against the noun's active mapping); the authority badge is `noun_verb`. This form is embedded in the `/aisworg/seu/sdk/transition-definition-authoring` page.
2. **Generic SDK deliverable-based authoring** — the `transition-definition-authoring` slug driven by the **stale** migration-016 `schema_definitions` grammar (`requiredAuthorityRuleCode`, no `verb`). A duplicate that doesn't match the model.

### Decision (owner)
**Consolidate on the CR-007 form.** Transition definitions are authored **only** through the `/authority/transition-definitions` add/retire form; the SDK deliverable-based/grammar path for `TransitionDefinition` is removed.

### What's built here
- **The `/sdk/transition-definition-authoring` page stays** (it hosts the CR-007 live list + add/retire form), but its **SDK draft affordances are removed for this kind**: no "New draft" button (`canCreate = false`), no draft "authoring sessions" list (`sessions = []`, `showDrafts = false`), and a note that transition definitions are authored via the form below.
- **`POST /sdk/transition-definition-authoring` (create draft) is blocked** for `TransitionDefinition` (correctable error) — no new deliverable-based drafts. The stale grammar's edit/save/approve/publish routes become unreachable (no drafts).
- **`TransitionDefinition` is removed from the schema-registry authorable kinds** (`SCHEMA_ENTITY_KINDS`, `SCHEMA_KINDS`) — it is not a grammar-driven kind; you can no longer mint a `TransitionDefinition` grammar version. (Existing historical `schema_definitions` rows are left as read-only history; not deleted.)

### Not in scope / notes
- The **other three** SDK-authored kinds (Pack/Template/Profile) are unchanged — they *are* grammar-driven.
- The core `publishTransitionDefinition` / `validateTransitionDefinitionSeed` functions and the SDK `TransitionDefinition` branches are left in place but **unreachable** (dead-but-harmless); a later cleanup can remove them.
- The stale migration-016 grammar row isn't deleted (avoids an insert/delete migration dance with 016's own idempotent seed); it just drops out of the authorable set.
