---
name: notnull-audit-fix
description: For a given list of tables, audit each table's NOT NULL columns (from src/dblayer/recovery/<table>_schema_recovery.sql) against its DB-layer write functions (src/dblayer/<x>DB.ts) and all their callers, then fix any gap in place — no silent fallback/default for a missing required value, the error must surface up. Use whenever the user names specific tables and asks to check/fix NOT NULL handling, required-field handling, or caller completeness for those tables.
---

# NOT NULL Audit + Fix

Scope is always an explicit table list the user provides — never run this over the whole `src/dblayer/recovery/` directory unprompted. If no list has been given yet, ask for one; do not guess from the current diff.

This is a fix pass, not a report. Findings get corrected in the same pass. Do not write up findings as prose/tables for the user unless asked — just fix and give a terse per-file summary of what changed.

## Per table, do these three steps in order

### Step 1 — Read the schema
Read `src/dblayer/recovery/<table>_schema_recovery.sql`. List every column with:
- `NOT NULL` (yes/no)
- `DEFAULT` (if any — a column with a DB-side default is not a gap even if callers omit it)
- FK reference (if any — matters for step 3, a FK NOT NULL column needs a real, valid id, not just "any value")

### Step 2 — Read the DB-layer file and fix missing handling
Read the matching `src/dblayer/<x>DB.ts` (map table name to file by existing naming convention, e.g. `capability_definitions` → `capabilityDefinitionsDB.ts`). For every write function (`create`/`insert`/`update` — anything that produces an `INSERT`/`UPDATE` against this table):
- For each NOT NULL column with no DB DEFAULT: confirm the function requires it as a mandatory param/field (not optional, not `?? someFallback`, not silently coalesced to `null`/`''`/a hardcoded constant).
- **No fallback values.** If a required column is currently defaulted in code (`?? 'x'`, `|| defaultValue`, an optional param treated as if present), remove the fallback so a missing value throws/fails the insert instead of silently substituting one. The error must surface, not get masked.
- Hardcoded constants substituting for Ontology-driven values are themselves a violation of the project's "no hardcoded constants, Ontology-driven" rule — flag/fix those too if found here, don't leave them as an incidental fallback.

### Step 3 — Grep every caller and fix incomplete calls
Grep the whole repo for every caller of each write function touched in Step 2. For each call site:
- Confirm it passes a real value for every NOT NULL, non-defaulted column (per Step 1/2's list) — not `undefined`, not an optional-chained-away value, not an empty object spread that happens to omit the field.
- If a caller is missing a required value, fix the caller to obtain and pass the real value. Do not paper over it by adding a fallback back into the DB-layer function (that would undo Step 2) — the fix belongs at the caller, sourcing the actual data it needs.
- If the real value genuinely isn't available yet at that call site (a true upstream gap, not just a missed pass-through), stop and flag it to the user instead of inventing a placeholder — per the project's "no parallel/bypass mechanism" rule, don't route around a real gap with synthetic data.

## Resolving a real actor/badge at a caller (web or api route)

When Step 3 finds a caller that's an HTTP route handler needing a real actor id and/or badge to pass through:
- **actorId**: `req.session.user.id` (stringified), nothing else. If absent, fail — no fallback identity.
- **authorBadge**: never a literal string chosen by inspection (e.g. writing `"root"` because the route "looks root-only"), even when that literal would in fact be correct. Derive it every time from two real, live sources intersected:
  1. `lookupRouteAuthority(req.method, req.path)` (`domain/identity/routeAuthorityCache.ts`) — this route's actually-declared required badges, straight from the `route_authority` table.
  2. `resolveHeldBadges(req)` (`domain/identity/heldBadges.js`) — this session's actually-held badges, a live `badge_grants` query.
  - `authorBadge = authRow?.badges.find((b) => held.has(b))` — the required badge this specific actor actually holds. If it comes back `undefined`, that is a correct, real result (either the actor lacks it, or the route requires none) — surface it as an error, don't substitute anything.
- **If a route's `route_authority` row requires no badge at all** (`badges: []`), there is no real "authorized badge" for that call site by design. That is a genuine authority-policy gap, not a NOT NULL bug — **do not edit `route_authority` (JSON seed, migration, or live table) to manufacture one as part of this audit.** Flag it to the user and stop; whether that route should require a badge is a separate, out-of-scope decision for them to make.

## Resolving actor/badge on a seu_id-scoped table whose author_id FK points to `participants`, not `participants_master`

Some seu_id-scoped tables' `author_id` FK targets `participants(id)` — the SEU-scoped engagement row for a participants_master identity — not `participants_master(id)` directly (e.g. `attention_items`, `participants` itself). Resolving a real actor there is two hops, not one:
1. `participantsMasterDB.findByUserId(Number(actorId))` → the acting user's platform-wide identity.
2. `participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id)` → the one row representing that identity's engagement in *this* SEU. Add this lookup to the DB-layer file if it doesn't already exist — don't reuse `findByParticipantMasterId` unfiltered, it returns every SEU's row.
3. No fallback at either hop: no participants_master row ("log in first"), or no participants row in this SEU, both throw.

### The system-actor case — a caller with no session user at all

Some callers of a function fixed under Step 3 are genuinely not HTTP request handlers — an event subscriber, a Telemetry sustained-pattern scan, a scheduler-driven sweep, an Execution Engine governance check that fires *because* a transition was blocked (so no authority was ever resolved for it). There is no `req.session` anywhere in the call chain, and inventing one would be exactly the placeholder this skill forbids.

Owner-approved resolution for this project: use the owning SEU's own `requested_by` (the real user who commissioned it, `seus.requested_by`) as the acting user, resolved through the same two-hop path above, with `authorBadge` recorded as the literal string `"system"` — never a re-derived or guessed authority badge, since nothing was actually authorised at a system-triggered call site. Wrap this as one small helper (e.g. `resolveSystemActor(seuId)`) next to the real-actor resolver, so every system-triggered call site reuses it instead of re-deriving the pattern. No fallback: a SEU with no `requested_by` throws, same as any other missing required value.

Before applying this: confirm the call site truly has no real actor available anywhere in its chain (check every caller up to the nearest one that does have `actorId`/an authority-resolved badge already in scope — several call sites turn out to already carry a real actor/badge one or two frames up, e.g. a `command.requested_by`/`command.acting_badge_type` already on the row, or a `gate.authorityBadge` already resolved earlier in the same function because the governing transition itself succeeded). Only fall back to the system actor once that's genuinely exhausted, and confirm the "system" treatment with the user per-caller rather than assuming it applies uniformly — it does not apply to a scheduler-driven sweep unless the user explicitly says so, since that caller has no owning transition attempt behind it at all, just a timer.

## Before finishing (each table)
- No `?? `/`|| ` fallback was left on any NOT NULL, non-defaulted column in the DB-layer function, in any caller, or in the actor/badge resolution above.
- No hardcoded literal was introduced in place of an Ontology-driven value, or in place of a resolved actor/badge.
- No `route_authority` row was added, widened, or narrowed as a side effect of this audit.
- Every caller of a touched function passes every required field explicitly.
- Test fixtures that construct rows for this table directly (not through the DB-layer function), or that call the DB-layer function without a session, get the same check — per the project's schema-CR rule, fixture updates ship in the same pass, not after the suite breaks. Use the existing `actorId: "1"` root-actor convention already established elsewhere in `tests/`, not a new fixture identity.


# Execution Constraints

## No Sub-Agents

Do not use, create, delegate to, or invoke sub-agents for this analysis.

The complete specification analysis and repository investigation must be
performed by the current Claude Code agent.

Do not delegate:

- specification decomposition
- repository searching
- source-code investigation
- implementation tracing
- gap analysis
- finding generation
- completeness verification

Perform the analysis directly using the available repository tools.

---

# Conversation Output

Keep the conversational response FULLY SILENT.

Do not expose the detailed reasoning process, search strategy, intermediate
analysis, or investigation narrative in the conversation.

Do not provide a running explanation of:

- which files are being searched
- which keywords are being searched
- why a particular file was selected
- intermediate hypotheses
- intermediate conclusions
- internal reasoning
- step-by-step repository investigation

The detailed analysis belongs in the final traceability output, not in the
conversation narrative.

I do not want a verbose conversation. The analysis has to still be thorough. 