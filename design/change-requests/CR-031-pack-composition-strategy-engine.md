# CR-031 — Pack `compositionStrategy`: wire `compositionEngine` to the chosen strategy

**Raised:** 2026-08-19 · **Origin:** owner — split out of CR-030 as its own CR: "phase 1 first. Make phase 2 a separate CR and we will include it in the composition strategy when we review it." · **Status:** 🟡 Proposed — **not scheduled**

### Context
CR-030 made `compositionStrategy` a real, Ontology-backed, validated dropdown (seven values: Override, Merge, Supplement, Union, Intersection, Alias, Conflict Detection — full definitions in CR-030). This CR is the other half CR-030 explicitly left out: making `compositionEngine` actually branch on whichever value a Pack declares, instead of doing the one fixed thing it does today regardless of the field.

**What `compositionEngine.compose` actually does today** (checked directly, unchanged by CR-030):
- When two contributing Packs (a Template's mandatory set + a Profile's optional set) resolve to the *same Pack code*, the later one silently wins — a hardcoded mechanic that behaves like "Override," but isn't driven by the field; it fires unconditionally, regardless of what either Pack's `compositionStrategy` says.
- `detectGovernanceConflicts` separately and unconditionally flags disagreeing governance contributions between *different* Packs — closer in spirit to "Conflict Detection," but again not gated by the field.
- Merge, Supplement, Union, Intersection, and Alias have **no implementation at all** — there is nothing in the engine that could currently produce any of these five outcomes on purpose.

### Why this is a real design task, not just a switch statement
The seven strategies aren't defined at the same granularity the engine currently operates at (whole-Pack, same-code duplicates). Real questions to settle per strategy before this is buildable:
- **Merge** ("field by field... actually combined") — what does field-by-field reconciliation mean for a Pack's *checklists*? Its *policies*? Its *capabilities*? Each contribution type likely needs its own merge rule, not one generic one.
- **Supplement** — which Pack is "base" and which is "addition" when a Template's mandatory set and a Profile's optional set both contribute? Composition order alone (mandatory-then-optional) may or may not be the right signal.
- **Union / Intersection** — set-combination over *what* unit — whole Packs, individual contribution items (one checklist entry vs another), or something else? The owner's own Node.js+TypeScript checklist example (Union) operated at the item level, not the Pack level.
- **Alias** — "a redirect to the same underlying thing" — resolved at authoring time (one Pack literally points at another's contribution) or at composition time (the engine notices two contributions are equivalent and collapses them)?
- **Conflict Detection** — already exists as an unconditional mechanism (`detectGovernanceConflicts`); does selecting this strategy on a Pack change anything about when/how it runs, or is the point that a Pack *without* a stated strategy should behave this way by default (fail closed) rather than silently applying Override?
- **Whose strategy wins** when two contributing Packs each declare a *different* strategy — is `compositionStrategy` a property of the *contributing* Pack, the *receiving* Pack, or does it need to be resolved as a pairwise decision the way FR-3.6/3.7's conflict detection already is?

None of these are answered by CR-030's own scope (which only made the field a validated, curated choice) — they need a real design pass, likely its own conversation, before implementation starts.

### Not in scope until scheduled
Implementation of any kind. This CR exists to hold the question, not to propose an answer yet — per the owner's own framing, to be picked up "when we review it."
