# CR-066 — Pack dependency types: real semantics for conditional/incompatible, circular-dependency detection

**Raised:** 2026-08-24 · **Origin:** split out of CR-065 (Capability ↔ Ch.10) during design discussion — Chapter 10 §9's "Capability Relationships" maps onto Pack-level `dependencies[]` (`required`/`optional`/`conditional`/`incompatible`) plus Composition Engine composition, confirmed real but genuinely partial: only `required` has any actual behaviour (`validatePackSeed`, `packs.ts:440-443`), and zero circular-dependency detection exists anywhere despite §9's own explicit "shall not create circular dependencies" requirement. Owner: "is a separate CR and for later." · **Status:** 🟡 **Parked — blocked on CR-067.** The ancestry/lineage list this CR needs for cycle detection is a byproduct of however Composition Strategy actually ends up working (CR-067, split out the same day) — designing it first would mean guessing at a shape CR-067 could invalidate. Owner: "Building CR066 will not make sense now unless we define all the strategies. Only then we will know what fields are required for each composition." Revisit once CR-067 settles.

## The gap

`PACK_DEPENDENCY_TYPES` (`required`/`optional`/`conditional`/`incompatible`) is validated for shape only — a Pack author can declare any of the four, but only `required` is ever consulted (must resolve to a real Active Pack). `optional`, `conditional`, and `incompatible` are recorded and otherwise inert: `conditional` has no condition-evaluation mechanism of any kind, and `incompatible` doesn't block co-installation of anything.

Separately, `compositionEngine.ts` has zero circular-dependency detection — a cycle of Pack dependencies (A requires B requires A) isn't caught anywhere, contradicting Ch.10 §9's own explicit requirement.

This isn't Capability-specific — it's shared, platform-wide Pack-dependency/Composition Engine infrastructure that several chapters' own relationship models (Capability Ch.10 §9 among them) implicitly depend on being real.

## Open questions (none resolved yet)

- What does `conditional` actually condition on — another Pack's presence, a tenant configuration flag, something else? Needs a real mechanism design, not just a validated enum value.
- What does `incompatible` actually block — does it prevent two Packs from ever composing into the same SEU/EBM, or something narrower?
- Circular-dependency detection: where does it run — at `validatePackSeed` time (reject a Pack whose declared dependency graph would create a cycle), at composition time, or both?

## Not in scope

Building any of the above. This CR exists to hold the gap, split out of CR-065 to keep that CR Capability-specific.
