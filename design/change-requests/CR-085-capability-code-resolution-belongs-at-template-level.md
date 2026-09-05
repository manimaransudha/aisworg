# CR-085 — Capability-code resolution belongs at Template level, not Objective level

**Raised:** 2026-09-01 · **Origin:** owner, tracing 8 test failures surfaced after wiring the new Compliance/Domain/Integration Packs into `cleanSlate.ts` (`output.txt`, a full `pnpm test` run). · **Status:** 🟡 Proposed (design settled by the owner; not built).

## The gap (confirmed live, 2026-09-01)

`commissionFromForm` (`core/commissioning.ts:267-300`) does this, in order:

1. Calls `createObjective({ requiredCapabilityCodes, ... })` — which resolves each bare capability *code string* (e.g. `"requirements-analysis"`) into one specific `capabilities` **row**, via `capabilitiesDB.findByCodes` (no `ORDER BY`, confirmed — `capabilitiesDB.ts:38`) followed by `dedupeByCode` (`objectives.ts:29-35`, a CR-079 fix that guarantees exactly one row survives per code, but not *which* one — first-in-result-order wins, and Postgres gives no ordering guarantee on an unordered `WHERE code = ANY(...)`).
2. *Only after that* calls `findCandidateTemplates(requiredCapabilityCodes, ...)` to pick a Template — the one place that actually knows, unambiguously, which Packs are mandated (a Template's own `mandatoryPackCodes`, category-scoped slots, `PACK_SELECTION_SLOTS`).

So the Objective locks in a specific Capability row **before any Template is even chosen**, with zero awareness of which Pack will end up selected. Step 2 independently picks a Template whose own required-capability-code set is satisfied — but nothing reconciles the two. If more than one Pack contributes the same `capability-name` code (a legitimate, designed-for case since CR-079 — "Capability is just a term... a bare code can legitimately match more than one row"), the Objective and the Template can each resolve to a *different* Pack's row for the identical code, and nothing catches the disagreement.

**This stayed invisible for months** because until this session only `development`/`code-review` were genuinely shared across multiple Packs, and none of the ~30 tests hardcoding `requirements-analysis`/`architecture-solution-design`/`development` as `requiredCapabilityCodes` happened to exercise a case where the "wrong" Pack's row lacked something the test then asserted on (a Service carrying an SLA). `integration-jira.pack.json` (declares `requirements-analysis`) and `integration-confluence.pack.json` (declares `architecture-solution-design`) — both real, correctly-authored Packs, not test fixtures — were enough to expose it: their own rows for those codes carry no Services (Integration Packs contribute none), so when `dedupeByCode` happens to keep an Integration Pack's row instead of the originating OpenUP Pack's, every downstream Service/SLA lookup comes back empty.

**8 failing tests, all downstream of this one mechanism** (`output.txt`, this session's `pnpm test` run):
- `dependency-definition-engine.test.ts` — expects 4 dependency rows (1 Deliverable-type + 3 Capability-type, one per Service `requirements-analysis` provides); gets 1, because the resolved row has no Services.
- `service-dependency.test.ts` (×2) — expects a named `"Service: ..."` dependency edge and a real `readinessState`; gets `undefined`.
- `tenant-contract.test.ts` — same `capabilitiesDB.findByCodes(["requirements-analysis"])` call directly (`tenant-contract.test.ts:100`), surfaces as "Work Item should be delivered."
- `work-item-stall.test.ts` (×4, via the shared `commissionDispatchAndDeclareSla` helper) — `servicesDB.findByCapabilityId(capability.capabilityId)` comes back empty for the same reason.

## Design (owner, settled)

> "Objectives does not need [to] know where the capability code came from. It just needs the capability code. When template looks at it, it will pull all the packs matching that code and more and resolve it. This is not objective's job."

- **Objective stays exactly as it is, conceptually**: it declares/requires a bare capability *code* (a competency name), nothing more. It should not resolve that code to a specific Pack's row at all — CR-079's own framing ("Capability is just a term... An Objective requires the COMPETENCY once, not once per Pack that happens to offer it") already said this; `dedupeByCode` was a step toward it but stopped short, because it still silently picks and commits to one specific row.
- **Resolution to actual Capability rows belongs at the Template (and, by the same reasoning, Profile) level** — the layer that already knows, from its own authored `mandatoryPackCodes`/category-scoped Pack selections, exactly which Packs are in play for a given commissioning. `findCandidateTemplates` (`templates.ts:51-70`) today only does bare-code set membership (`templateCodes.has(code)`) — it doesn't yet resolve to rows either; the real fix is for this layer (or whatever supersedes it) to pull every Pack matching a required code *and* whichever a Template's own selections narrow that down to, and hand back the resolved rows — not the Objective.

## Explicitly not decided here

- The exact mechanism for Template-level resolution (does it still call `capabilitiesDB.findByCodes` and narrow by the Template's own `mandatoryPackCodes`? does `Capability.findByCodes` itself gain a Pack-scoping parameter?).
- Whether `createObjective`/`dedupeByCode`'s current row-resolving behavior is removed outright, kept as a fallback, or replaced by something that only stores the bare code.
- How `commissionFromForm`'s own two-step order (Objective first, Template second) should change, if at all, given Objective no longer needs to resolve anything before Template selection happens.

Owner: "Let us figure this out as we test the other pieces" — not building this now; recorded so the finding and the settled direction aren't lost before the next pass.
