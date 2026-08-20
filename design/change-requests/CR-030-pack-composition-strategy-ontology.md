# CR-030 — Pack `compositionStrategy`: a real, Ontology-backed dropdown

**Raised:** 2026-08-19 · **Origin:** owner — "composition strategy field in the pack authoring details below; these have to be declared as composition strategy in Ontology and on the pack, this is a dropdown field," with the seven values and their definitions given in full (quoted verbatim below). Split from a combined two-phase CR into this (phase 1, the field itself) and CR-031 (phase 2, actually wiring `compositionEngine` to the chosen strategy) — owner: "phase 1 first. Make phase 2 a separate CR and we will include it in the composition strategy when we review it." · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.**

### Context — what's actually there today
`compositionStrategy` is one of CR-018's §8/§13 metadata fields (`core/packs.ts`'s `PackSeedInput`/`PACK_METADATA_KEYS`), stored in `packs.metadata` (JSONB). In the authoring grammar it was a bare `{"type": "string"}` — free text, no widget, no enum, no Ontology backing at all; an author could type anything, including nothing. Chapter 5 itself already documented this precisely (line 601): *"Declaration only: Composition Strategy is recorded but composition still applies the fixed 'later-overrides-earlier' (Override) strategy."*

Checked `compositionEngine.compose` directly: `compositionStrategy` was **never read** anywhere in it — see CR-031 for the full accounting of what the engine actually does today (one hardcoded same-code-duplicate mechanic, one always-on conflict-detection mechanism, neither gated by this field). This CR is the field only, not the engine.

### The seven values, as given (seeded verbatim as each concept's description)
- **Override** — the new contribution replaces the existing one entirely. Nothing survives from the original. This is the tenant-overrides-a-Domain-Pack case: the tenant's content fully takes the platform's place, for them.
- **Merge** — the two contributions are reconciled into one, field by field, where they overlap — not just concatenated, actually combined.
- **Supplement** — the new contribution adds to the existing one without touching it; the original stays primary, the addition is secondary. Asymmetric — one Pack's content is base, the other's is extra.
- **Union** — the plain set-combination: every item from every contributing Pack, treated as equal peers, nothing dropped.
- **Intersection** — only what both contributions agree on survives; anything unique to just one is dropped.
- **Alias** — one contribution is just a different name pointing at the same underlying thing — no new content, just a redirect. The mechanism behind the code/name relabeling already built for the Ontology, applied as a Pack-level composition move instead of a display-label rule.
- **Conflict Detection** — deliberately doesn't auto-combine. Flags that two contributions disagree and surfaces it for resolution rather than silently picking one — backs the EBM conflict-blocks-commissioning behaviour (FR-3.6/3.7).

### What's built here
- New Ontology concept type `composition-strategy` (Ch.18), seeded with the seven codes/labels/descriptions above — Platform-owned, same open-vocabulary treatment every other concept type gets (a tenant can add its own via Ontology Management).
- `compositionStrategy`'s schema property changed from bare `{"type":"string"}` to `x-widget: "referential-select"`, `x-ontology: true`, `x-referential-source: "composition-strategy"` — the exact mechanism `category`/`installationClassification` already use (CR-020 Part 2), so the generic form-generator/Ontology-picker/live-guidance-under-the-dropdown machinery (CR-023) picked this up with zero new widget code.
- `validatePackSeed` (`core/packs.ts`) now validates `compositionStrategy` against the Ontology the same way `category`/`installationClassification` already are (`assertCanonicalCategory`) — real defense-in-depth, not just a UI-level dropdown; a hand-crafted JSON import or API call can no longer set an arbitrary string. Optional (not required) — an un-set `compositionStrategy` is still valid, matching its own pre-existing optionality.

### Design decisions
- **Validation added, not just a UI dropdown** — mirrors Pack's own `category`/`installationClassification` treatment exactly rather than leaving this one Ontology-backed field unvalidated (the gap CR-028 separately found and closed for Template's `code` while building Profile's `category`). Consistent, not a special case.
- **No retrofit of any existing free-text `compositionStrategy` values** — checked directly: no Pack in the current dataset has ever had a non-empty `compositionStrategy` (the seed Packs never set it), so there was nothing to migrate.

### Not in scope
- Everything about `compositionEngine` actually behaving differently per strategy — that's CR-031, deliberately kept separate and not scheduled.
