# CR-117 — Version Events table (Chapter 41 §12/§13/§15/§18)

**Raised:** 2026-10-05 · **Origin:** Chapter_41_Version_Management_Architecture_Traceability.md intent-level re-check — §18's "Version events" deliverable was found inert: `transition_definitions.version_event` is a classification label (`VersionCreated`/`VersionPublished`/etc.) that is never passed to `eventBus.publish`; the real domain event (`gate.eventType`) is published instead, and `gate.versionEvent` is discarded by every caller. `§12` (Historical Reconstruction) and §18's "Version APIs" were also open gaps with no mechanism.

**Status:** 🟢 Built — 2026-10-05

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

- **Schema file**: `src/dblayer/recovery/version_events_schema_recovery.sql`, columns: `id`, `event_id` (FK `events(id)`), `tenant_id`, `entity_type`, `entity_id`, `from_state`, `to_state`, `version_event`, `occurred_at`, `actor_id` (UUID, FK `participants_master(id)`), `authority_badge`.
- **Tenant scoping**: `tenant_id` is a real column, not derived via join, and **`NOT NULL`** on the table (owner correction, 2026-10-05) — same for `actor_id` (also `UUID NOT NULL REFERENCES participants_master(id)`, not `TEXT`). `PublishInput` gains an optional `tenantId` alongside `versionEvent`/`fromState`/`toState`; when `versionEvent` is given but `tenantId` is missing, `eventBus.publish()` throws rather than falling back to `null` — no `?? null` anywhere on this write path, and `versionEventsDB.insert`'s own `tenantId`/`actorId` parameter types and `VersionEventRow.tenant_id`/`actor_id` are plain `string`, not `string | null`. A versioned transition for a platform-global entity (Ontology, SchemaDefinition) with no real tenant simply never gets a `version_events` row today, since neither carries a real `version_event` yet — if either ever does, that call site will need a real `tenantId` resolved, not a `null` placeholder.
- **Write path**: lives entirely in `eventBus.publish()` (src/domain/engine/eventBus.ts) per the design above — not duplicated at each `transitionX` call site. Call sites only add the three new optional fields to their existing `publish(...)` call.
- **Scope of this CR**: reconstruction reader + Version Replay page/route are built in the same CR as the table + write path, not split off.
- **Fixtures**: no test fixture updates required for this CR — verification is manual, via the Version Replay page, not asserted in the automated suite.

## Built (2026-10-05)

- `src/dblayer/recovery/version_events_schema_recovery.sql` — new `version_events` table (`event_id` FK `events(id)`, `tenant_id`, `entity_type`, `entity_id`, `from_state`, `to_state`, `version_event`, `occurred_at`, `actor_id` UUID FK `participants_master(id)`, `authority_badge`). **Not yet applied against any live DB by this change** — per CLAUDE.md, schema recovery SQL is run by the user directly, not by Claude.
- `VersionEventRow` (seuTypes.ts), `src/dblayer/versionEventsDB.ts` (`insert`/`findByEntity`/`findPage`).
- `eventBus.ts`: `PublishInput` gained optional `versionEvent`/`fromState`/`toState`/`tenantId`. `publish()` itself inserts one `version_events` row (keyed to the just-published event's real id) when `versionEvent` is non-null — no second publish, one codepath owns the write.
- Every existing `transitionX` call site whose entity actually carries a `version_event` classification now passes it through on its existing `publish(...)` call: `transitionObjective`, `transitionPack`, `transitionTemplate`, `transitionProfile`, `transitionServiceDefinition`, `transitionCapabilityDefinition`, `transitionPolicyDefinition`, the Ontology concept transition (`tenantId: null` — platform-global), both SchemaDefinition hops (`tenantId: null` — platform-wide, root-only), and `transitionEbm` (wired through for when a future `version_event` lands on an EBM row; today it's always null per the existing comment in that function). Evidence/Knowledge/Decision/Obligation left untouched — their `transition_definitions` rows carry no `version_event` (they aren't Ch.41 §7 versioned artefacts); SEU's own lifecycle hops are the pre-existing "partial" gap, unchanged by this CR.
- **Version Replay page** (§18 "Version APIs" + §12 reconstruction reader): `core/versionEvents.ts` (`getVersionEventsPage`, `getVersionReplay`), `web/versionEvents.ts` (`GET /aisworg/seu/version-events`, filterable by entityType/entityId/versionEvent/tenantId, sortable, paginated — modeled on CR-074's `web/events.ts`), registered in `web/index.ts`. View: `views/seu/versionEvents/index.ejs` + `seu_versionEvents_indexVM` (viewRegistry.js). Navbar entry + `attachVM.js` activePage branch added.
- `route_authority` row for `GET /aisworg/seu/version-events` (superuser only, same as Event Bus) added to `src/dblayer/seed/data/routeAuthority.json`; nav-visibility entry added to `app.ts`'s route list alongside `/aisworg/seu/events`.
- `npx tsc --noEmit` run clean across the whole project after these changes.

## Still open

- The schema recovery SQL file is written but not applied — the user needs to run it against the live DB (and `pnpm db:clean-slate` for the new `route_authority` row) before `/aisworg/seu/version-events` or any new transition on a versioned entity will work.
- No test fixture updates were made (per the earlier "Fixtures: not required" decision — verification is manual via the Version Replay page).
