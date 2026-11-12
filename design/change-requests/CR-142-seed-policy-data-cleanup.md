# CR-142 — Seed data: cleanup of the Pack policy data now that Pack policies are materialised

**Raised:** 2026-11-12 · **Origin:** SEU e96a5588-3f6b-4e1f-b23d-b18946868a26 was commissioned after `createAuthoringDraft` began calling `materializeContributions`. The EBM of that SEU holds 81 applicable policy ids, up from 30.
**Status:** 🟡 Raised — design in progress

## Fix the following

- The seed data for Packs and their Policies is to be reviewed and cleaned up.
- Policy rows now exist for every Pack that is created through `createAuthoringDraft`, so the policies the seed Packs contribute now reach the EBM of every SEU that composes them.
- Each seeded Pack policy is to be checked for what it governs, and whether it can block the Deliverables of a commissioned SEU.

## Findings

The finding as reported on 2026-11-12. The database holds 88 policy rows, of which 87 have Transition scope and 1 has Eligibility scope. The EBM of the SEU above composed 21 Packs and holds 81 policy ids, none of them SEU-scoped.

| Pack | Policy rows in the database | In this EBM |
|---|---|---|
| `product-discovery` | 34 | 34 |
| `platform-governance-baseline` | 30 | 30 |
| `beta-early-access-management` | 10 | 10 |
| `backlog-release-planning` | 6 | 6 |
| `demo-false-trigger-pack` | 1 | 1 |
| `integration-slack` | 6 | 0 |
| `technology-react-native` | 1 | 0 |

- The EBM holds the policies of the Packs it composed. It does not hold every policy.
- The seven rows left out are the 6 `integration-slack` policies and the 1 `technology-react-native` policy, whose Packs this SEU did not compose, and the Eligibility-scope policy, which the list does not carry.
- The increase from 30 to 81 comes from Packs that gained policy rows. `product-discovery`, `beta-early-access-management` and `backlog-release-planning` contribute 50 of the new ids. `demo-false-trigger-pack` adds 1.
- Before the change, only `platform-governance-baseline` had policy rows, because the SDK authoring path did not call `materializeContributions`.
- What the 50 new ids govern, and whether they can block this SEU's Deliverables, has not been checked.

## Still open

- Which of the seeded Pack policies belong in the seed data.
- Whether the Packs `product-discovery`, `beta-early-access-management` and `backlog-release-planning` are to keep their present policies.
- Whether `demo-false-trigger` is to apply to the other two Deliverables of the demo SEU. It lists only `requirements-analysis-model`.
- Verification runs for this CR: none have been run.
