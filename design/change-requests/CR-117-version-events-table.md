# CR-117 — Version Events table (Chapter 41 §12/§13/§15/§18)

**Raised:** 2026-10-05 · **Origin:** Chapter_41_Version_Management_Architecture_Traceability.md intent-level re-check — §18's "Version events" deliverable was found inert: `transition_definitions.version_event` is a classification label (`VersionCreated`/`VersionPublished`/etc.) that is never passed to `eventBus.publish`; the real domain event (`gate.eventType`) is published instead, and `gate.versionEvent` is discarded by every caller. `§12` (Historical Reconstruction) and §18's "Version APIs" were also open gaps with no mechanism.

**Status:** 🟡 Raised — design in progress

**This is the whiteboard for this CR. Do not post anything on the conversation. No subagents are allowed**

## Problem

- §15 asks the platform to publish `VersionCreated`/`VersionValidated`/`VersionPublished`/`VersionActivated`/`VersionDeprecated`/`VersionSuperseded`/`VersionArchived` as real events.
- Today `version_event` sits on `transition_definitions` and is returned by `transitionEngine.evaluate()`, but no caller (e.g. `objectives.ts:1184`) does anything with it — only `gate.eventType` reaches `eventBus.publish`.
- §12 (Historical Reconstruction) has no mechanism: raw events/EBM snapshots are immutable and retained, but nothing reassembles them into a reconstructed historical state.
- §18's "Version APIs" has no queryable cross-entity version/lineage endpoint; per-entity CRUD routes don't substitute for this.

## Agreed design (2026-10-05)

Not a second `eventBus.publish` call — a new table that indexes the real event by its version classification:

- **`version_events` table**: `event_id` (FK to the real `events` row — reuse, never duplicate the event), `entity_type`, `entity_id`, `from_state`, `to_state`, `version_event` (the classification value, e.g. `VersionActivated`), `occurred_at`/`actor_id`/`authority_badge` carried from the same event row.
- **Write path — centralized in `eventBus.publish()`, not per call site**: `PublishInput` gains optional `versionEvent`, `fromState`, `toState` fields. Every existing `transitionX` call site's `eventBus.publish({ eventType: gate.eventType, ... })` just adds `versionEvent: gate.versionEvent, fromState, toState` to the same call it already makes — no new call, no separate insert statement written per file. `eventBus.publish()` itself, after `eventsDB.append` succeeds and before it returns, inserts one `version_events` row (`event_id` = the just-created event's id, `entity_type`/`entity_id` from `originatingObjectType`/`originatingObjectId`, `version_event`/`from_state`/`to_state` from the new input fields, `occurred_at`/`actor_id`/`authority_badge` copied from the same event) when `versionEvent` is non-null. One codepath owns the write; no drift, no duplication across `transitionX` functions. No after-the-fact backfill/derivation job.
- Rows with `versionEvent` omitted/null (a pure Revision, per Version Feature Plan.md) insert nothing — only real version-classified hops get a row.
- **Closes §12 (Historical Reconstruction)**: read `version_events` for an entity, walk its `event_id`s in order, rehydrate each event's stored payload — a reconstruction reader over this table, not a separate module.
- **Closes §13 (Version Traceability)**: gives a real, queryable per-entity version chain (parent/successor by ordering `occurred_at`), not just inert labels.
- **Closes §18 "Version APIs"**: a thin read endpoint over `version_events`, scoped by entity/tenant — a **Version Replay** page, modeled directly on the existing `src/routes/seu/web/events.ts` + `src/routes/seu/core/events.ts` pattern (CR-074: filterable, paginated, sortable, `attachVM`/`parseListParams`/`listResult`), scoped by entity/tenant instead of global.

## Settled (2026-10-05, resolving prior open items)

- **Schema file**: `src/dblayer/recovery/version_events_schema_recovery.sql`, columns: `id`, `event_id` (FK `events(id)`), `tenant_id`, `entity_type`, `entity_id`, `from_state`, `to_state`, `version_event`, `occurred_at`, `actor_id`, `authority_badge`.
- **Tenant scoping**: `tenant_id` is a real column, not derived via join. `PublishInput` gains an optional `tenantId` alongside `versionEvent`/`fromState`/`toState` — the call site already has it (every `transitionX` resolves tenant for its own `requireTenantScope` check) and passes it straight through to `publish()`, which writes it onto the `version_events` row.
- **Write path**: lives entirely in `eventBus.publish()` (src/domain/engine/eventBus.ts) per the design above — not duplicated at each `transitionX` call site. Call sites only add the three new optional fields to their existing `publish(...)` call.
- **Scope of this CR**: reconstruction reader + Version Replay page/route are built in the same CR as the table + write path, not split off.
- **Fixtures**: no test fixture updates required for this CR — verification is manual, via the Version Replay page, not asserted in the automated suite.

## Determine at build time 

- `route_authority` row(s) for the new Version Replay route go in `src/dblayer/seed/data/routeAuthority.json` (CR-110 — every new route needs one in the same build pass; `pnpm db:clean-slate` repopulates it from this file, not a manual/migration insert).
