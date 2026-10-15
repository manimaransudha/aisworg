# Session Checkpoint (2026-10-15)

Source of truth for each topic is its CR file in `design/change-requests/`. This page records where the work stands and what is next.

## Done and verified (typecheck 0 errors)

| CR | Subject | State |
|---|---|---|
| CR-119 | Shared version helper (`src/utils/version.ts`), `INITIAL_VERSION`, `version_hop` column | Built. `nextVersion` has no consumer yet (KI-004). |
| CR-120 | NOT NULL columns: no `?` and no `??` in code. Actor, author, badge, tenant columns required. Recovery SQL updated and applied. | Built. |
| CR-121 first pass | `transitionEngine.evaluateGoverned` and `gateRejection`, used by Evidence, AttentionItem, Obligation, ExternalInteraction, Review, Decision, Knowledge transitions | Built, 58 of 58 related tests pass. |
| CR-122 | Platform system actor (`participants_master`, type Automated, name "System", badge "system") provisioned on superuser sign-in. One system participant per SEU, created when the SEU is Commissioned. `getSystemActor(seuId)` in `src/dblayer/constants.ts` replaces `resolveSystemActor`. | Built. |

Last verified run: `db:clean-slate` and `seedDemo` exit 0. Full suite 351 of 355 (failures: KI-001 race in `attestation`, Phase 5, Phase 7, plus a fixed fixture).

## Next work, in order

1. **CR-121 second pass.**
   - Group A (declaration, `evaluateAuthorised`: `evaluate` plus badge requirement, no gates): Pack, Profile, Template, Capability, Policy, Service, Deliverable Definition, Ontology, SchemaDefinition, Objective, EBM, the SEU commissioning hops, `validateRequest`.
   - Group B (execution, `evaluateGoverned`): Finding, `promoteKnowledgeItemScope`, Participant.
2. **CR-121 third pass (Deliverable and KI-001).** Design is written in CR-121 under "Third pass design". Awaiting the owner's answer to one question: the engine starts work (`Defined -> In Progress`, trigger `governed`) but never fires Approve or Baseline itself (they stay `manual`, requested by a participant holding the badge). If confirmed:
   - `deliverableKickoffHandler` fires only `governed` hops.
   - One data change in `transitionDefinitions.json`.
   - `evaluateDeliverableTransition` calls `evaluateGoverned`.
   - The Quality Gate evaluation, governance outcome and pool are authored by the SEU system participant (also change first-pass `evaluateGoverned` to use the system participant, not the actor's row).

## Standing rules learned this session (all also in CLAUDE.md or the skills)

- Event publishing stays outside shared evaluation code. No git commands. Typecheck, clean-slate, tests and SQL only on an explicit instruction.
- `participants_master` is the universe; `participants` is the SEU scope. Anything the Execution Engine creates is authored by the SEU system participant. Everything else keeps a real author.
- Definition entities (`01_Engineering Definition`, plus EBM and SEU commissioning) need authority only. Execution entities are governed by authority, policy and Quality Gates (no self-certification).
- Tests never reuse a seeded template code. Test-only concepts exist for that (see the `test-fixtures` skill).
- Seeded Platform templates must be Active before `seedDemo`. Run `seedDemo` right after clean-slate.

## Open items

- KI-001 (commence-work race), KI-002 (`demoSimulator` fixed version), KI-003 (Deliverable Definition has no `version_event`), KI-004 to KI-008 in `design/Known Issues.md`.
- Deployment behaviour of the system actor and the per-SEU system participant (CR-122).

## Commands

- Recovery SQL: `pnpm exec tsx src/dblayer/recovery/run.ts`, then sign in as the superuser once, then `pnpm db:clean-slate`.
- Tests: `pnpm test > <file>`. Run a failing test alone to separate the KI-001 race from a regression.
