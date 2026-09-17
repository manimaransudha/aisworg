# CR-108 — Obligation Model (Ch.23) implementation for SEU execution

**Raised:** 2026-09-16 · **Origin:** follow-on from CR-107 (Execution Engine owns Deliverable kickoff) — building CR-107's SEU-blocked/per-Deliverable-Obligation checks surfaced several execution-side gaps in the Obligation model itself, deliberately deferred by earlier CRs rather than designed. **Status:** 🟡 Raised — scope not yet agreed, no design started.

## Known gaps to read into first (grounding, not yet a design)

- **CR-062's own deferral (Chapter 5 §19.4, Pack contribution build):** `contributionObligationDefinitions[]` deliberately left Priority, Completion Criteria, and the five "Related *" fields (§8: Related Deliverable/Decision/Evidence/Policy/Authority-Rule) off the Definition — owner: "there is no way you can predefine [this]... whoever is opening an obligation during seu execution will have to specify this." Related Risks is moot (no Risk entity exists anywhere in the codebase). None of this execution-side half was ever built.
- **Obligation's own named lifecycle events (Ch.23 §15) — only 2 of 8 real**, per Chapter 5 §19.4's own audit note; the rest split out as CR-063, never picked up.
- **AttentionItem has no structural equivalent of Obligation's `blocked_from_state`/`blocked_to_state`.** Found live this session (CR-107): those two columns are what let `raiseObligationForBlockedTransition` and the resolution-triggered retry (`executionEngineKickoff.ts`) know exactly which hop an Obligation is blocking. AttentionItem carries no equivalent — if it's ever meant to function as a live gate alongside Obligation (not just a notification), it needs the same structural link, not yet designed.
- **The manual "Create Obligation" form (SEU detail page, Obligations tab) may not be a legitimate operation at all** — owner, live this session: "this is not aligned with the Obligation definition we have. I am unsure whether we need the ability to manually create an obligation." Deliberately left untouched pending this CR's own answer — Ch.23's own execution model may intend Obligations to only ever be raised systemically (off a blocked governed transition), never hand-created.

## Not yet designed

Everything — this CR only records where to start reading and what's already known to be incomplete. Read Chapter 23 (Obligation Model) itself thoroughly before designing anything (per standing practice: the code lags/diverges from spec, and chapters aren't always current here). Concretely open, in no particular order:

- Whether manual Obligation creation is real or should be removed/replaced.
- Whether AttentionItem needs Obligation's own `blocked_from_state`/`blocked_to_state` shape, and if so, whether it should also get its own resolution-triggered retry mechanism (mirroring `executionEngineKickoff.ts`) or something else.
- The execution-side shape of Priority/Completion Criteria/Related-* — who sets them, when, and whether that's a UI form, an automatic derivation off the raising context (the way `raiseObligationForBlockedTransition` already derives title/description from the blocking Policy), or both.
- CR-063's own remaining 6 lifecycle events — worth doing here, or still its own separate CR.
- Whether Obligation's per-entity-type reach (today: SEU and Deliverable, per CR-107) should generalize further, or stays scoped to those two.

## Related

- CR-107 — `design/change-requests/CR-107-execution-engine-owns-deliverable-kickoff.md`, the SEU-blocked/per-Deliverable-Obligation mechanism this CR's own gaps were found while building.
- CR-106 — `design/change-requests/CR-106-blocked-transition-obligation-attention-item.md`, the original Obligation-raising mechanism.
- CR-062/CR-063 — Chapter 5 (Pack Model) §19.4's own audit trail for the Obligation Definition contribution build and its split-out lifecycle-events follow-up.
- Chapter 23 — Obligation Model (`design/foundations/03_Book 3 (Refined)/`, exact Part/location not yet confirmed this session — locate and read first).
