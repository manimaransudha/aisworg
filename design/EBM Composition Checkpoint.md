# EBM Composition Checkpoint

## Settled

| Topic | Decision |
|---|---|
| Rule | The EBM defines the behaviour of the SEU. SEU-driven entities take what they need from the EBM and do not bypass it. Recorded in CLAUDE.md. |
| Test for a bypass | The key or pointer used must come from the EBM, either as a snapshot or as a pointer to a live read. Active Template and Profile rows are immutable, so the EBM's pointers to them are stable. |
| Live by design | Deliverable Definition `guide_location` is read live. It is not a bypass. |
| Capability source | EBM capability entries are derived from the Deliverable Catalogue (Profile's own, else Template's), then the Services whose `outputs` include a catalogue Deliverable, then the Service `capability_code`. |
| Capabilities tab | Columns Deliverable, Capability, Source. The Source links to the Pack and opens in a new window. |
| Commissioning | `seu_capabilities` is filled from the EBM's capability entries. The producing Capability of a Deliverable comes from the entries' `deliverableCodes`. |
| Eligibility Policies | Stored in `behaviors.eligibilityPolicyIds` at composition and read from the EBM by `resolveEligibilityPolicies`. |
| `createDeliverable` | Labels use `seu.tenant_id`. The catalogue is read through the EBM's recorded source. |
| Metadata tab | Shows the tenant of the Template and Profile. |

## Settled: Deliverable to Service composition rules

| # | Rule |
|---|---|
| 1 | A Deliverable ends composition with exactly one Service, and so one Capability. `producing_capability_id` stays a single column. Work that needs both a fix and a development Deliverable is separated by scope (Objective) or by separate Profiles. |
| 2 | Candidate Services for a Deliverable are the Services whose `outputs` include it, checked against the Services the composed Packs contribute. A mismatch means the Template or Profile is set up wrongly. |
| 3 | This is the first step of composition, before any other check. One candidate: used without a question. Several candidates: the user sees a message ("you may be packing several work streams into one bucket; create a different Profile for each work stream") and picks one. |
| 4 | A Pack that contributes the chosen Service has no conflict. Its extra Services are not taken into the EBM. |
| 5 | General, not Service specific: the user sees what the EBM would take from each Pack and what it would leave out, and approves it. It lists what the EBM would take (Capability, Obligation, Policy) and what it leaves out (the Pack's Services). The user approves. |
| 6 | A Pack that contributes a Capability without the Service, or neither, is accepted. |
| 7 | Two Packs that bring the chosen Service with different service levels form a conflict. The user picks one. |
| 7a | Service levels, refined: the Deliverable's Service is A. A's levels are the Profile's value, else the Template's, else the Service Definition default, and this order is already in place. The Services contributed by the composed Packs are put together in one list, for example [A, B, C, D]. A is compared with the Packs' definition of A. A different value is a conflict, a level the Packs add is a conflict, and a level the Packs omit is a conflict. The user picks. Packs are not compared with each other. B, C and D are not taken into the EBM. If A is not in the Packs' list, this check finds no conflict. This replaces rule 7. |
| 8 | Scope: the rules above cover Services only. Every Pack contribution kind (Services, Capabilities, authority rules, quality gates, checklists, review gates, Obligation definitions, engineering capital, Policies, competencies, dependencies) is checked against every other source of the same kind, directly or indirectly, and every overlap is shown to the user. The other kinds are not yet designed. |

## Open

| Topic | Question |
|---|---|
| Other contribution kinds | For each kind: which other definitions can supply it, and what counts as a conflict. Not yet designed. |
| Build | The rules above need a CR and then a build. The current Pack `contributionServices` filter in `unravelComposition` is a stopgap until then. |
| `capabilities` lookup | The table holds one row per Pack and code. Resolving a code to one row is unsettled (by code alone, or `capability_definitions`). |
| Pack overrides in a Profile | Profile can add Packs but cannot replace or remove a Template's. The user is deciding. |
| Remove Profile extra Capabilities | Decided: the Profile adds no list of Capabilities. The field `additionalCapabilityCodes` and its uses are to be removed. Not yet done. It is part of the composition CR, not a separate one. |
| Remaining bypass | Governance model reads Policies by Pack code (partial). |

## Next step

CR-139 is raised (design/change-requests/CR-139-ebm-composition-conflict-rules.md). Part 1 of the build is done (Profile extra Capabilities removed). The rest is listed in the CR under Still to build.

## Resolve Conflicts screen (design in progress)

| Topic | Decision |
|---|---|
| Entry | The old conflict section in the composition screen is replaced by a Resolve Conflicts button. The button shows the number of open conflicts. |
| Layout | One vertical tab for each conflict table, with the open count on each tab. Each conflict is a card with the message, the options with their sources, and the actions. A resolved conflict stays on the screen with the pick shown, and the user can change it. |
| Services, Step 1 | The user picks one Service. |
| Notices | Shown with nothing to pick. |
| Dependencies | Read-only with the message that it is resolved at the definition. |
| Open | Actions for the other tables. Fate of the old conflict check, which covers more than the nine tables. |
