# CR-011 — Pack-based automated Capability derivation for Objectives (Ch.1 §10)

**Raised:** 2026-08-13 · **Origin:** Chapter 1 review — §10 gap recorded in Ch.1 §18.13 · **Status:** 🟡 Proposed — **not scheduled** (owner: raise now, not for work right away)

### The gap
Ch.1 §10 / OBJ-003 / FR-1.3 say an Objective's required Capabilities may be **either**:

- explicitly declared within the Objective; **or**
- **derived automatically from Objective content, using Capability Packs (Chapter 5)** contributed by the platform, an Organisation, a Domain or a Customer.

Only the first is built. The second is approximated by `suggestCapabilityCodes` ([objectives.ts](../../src/routes/seu/core/objectives.js)) — a deliberately transparent **word-overlap heuristic** against each Capability's name/description, presented as a *starting suggestion a human confirms*, not the Pack-driven derivation §10 describes.

### The deeper blocker
The §10 mechanism is **Capability Packs (Chapter 5)**, but Chapter 5's own taxonomy never defines *how* a Pack derives required Capabilities from Objective content — a real upstream spec gap (already flagged in the MVP Build Plan and in `suggestCapabilityCodes`'s own comment). This CR therefore has a **spec-definition** phase before any build:

1. Define, in Chapter 5 (or an ADR), how a Capability Pack maps Objective content → required Capabilities (rules? tags? model call? declared associations?).
2. Only then implement derivation and wire it as an alternative/supplement to explicit declaration.

### What's wanted (to detail when scheduled)
- A derivation service that, given an Objective statement/content and the active Pack set, resolves a required-Capability set **reproducibly** (§15 NFR: same Objective + same Pack set ⇒ same Capabilities).
- The Composition Engine must not compose Packs until required Capabilities are resolved (§10, already respected).
- Keep the human-in-the-loop confirmation the current heuristic has — derivation is a starting set, not an unreviewable authority (per §10's intent and `suggestCapabilityCodes`'s design).

### Not in scope / notes
- Not being built now — placeholder to capture the §10 delta.
- Explicit declaration stays fully supported regardless; this adds the derivation alternative, it does not replace declaration.
- Blocked on the Chapter 5 Pack-derivation definition above.
