# Code Repetition Survey (src)

Scope: all `.ts` files under `src/`. Method: a 6-line normalized sliding-window duplicate scan plus grep counts of recurring constructs. Counts are occurrences, not distinct files. The DB-layer CRUD shape was not measured.

## Exact duplicate blocks

| Block | Files | Note |
|---|---|---|
| Express router preamble (`createRequire`, `require("express")`, `express.Router()`, type imports) | 26 | Identical header in route files. |
| `attachVM` and `renderView` imports | 5 to 12 | Follows the preamble. |
| `try { const { targetState } = req.body ?? {}; ...` transition handler opening | 5 | `routes/seu/api/decisions.ts` and siblings. |
| Draft/Validated/Published map | 4 | `routes/seu/core/deliverableDefinitions.ts:164`. |
| Capability definition insert field list | 6 | `dblayer/capabilityDefinitionsDB.ts:35`. |
| `dotenv/config` plus `node:fs` header | 6 | `dblayer/recovery/run.ts`. |

## Structural patterns

| Pattern | Count | Observation |
|---|---|---|
| `catch (` blocks | 700 | Most are one of three bodies (below). |
| `res.status(400).json({ error: (err as Error).message })` | 71 | Candidate for one shared error responder. |
| `next(err)` in catch | 54 | Alternate convention for the same case. |
| `errors.push((err as Error).message)` (with label variants) | 30 | Batch loops collecting errors. |
| `redirects.<area>.error(req, res, (err as Error).message)` | 10+ | Web-side equivalent of the 400 responder. |
| `if (req.session?.user?.id == null) return res.status(401)...` | 20 | Two different messages: "authentication required" (9) and "Session expired" (11). |
| `"targetState is required"` validation | 9 | Same check, same message, repeated per transition route. |
| `String(req.params.id)` aliased to `seuId` / `objectiveId` / `id` | 60+ | `seuId` alone is 30. |
| `req.body ?? {}` | 112 | Body defaulting repeated at every handler. |
| `res.status(409).json({ reason, detail })` | 8 | Transition-result rejection. |
| `eventBus.publish(` | 112 | Expected, but argument assembly (actor, badge) is likely repetitive. |
| `throw new Error(` | 309 | Plain `Error` throughout. |
| `(state\|status) === "<literal>"` | 66 | State literals in code. Check against the Ontology-driven rule. |
| Route handlers | 250 | Each repeats session check, param read, try/catch, error response. |
| `parseListParams(` | 36 | List pages follow the standard. |

## Findings

| # | Finding | Suggested direction |
|---|---|---|
~~| 1 | Error-to-response mapping is repeated about 140 times in four forms. | One shared error responder for API and one for web. |~~
~~| 2 | Session-presence check is repeated 20 times with two messages. | Confirm whether `routeAuthorityGate` already guarantees a session; if so the checks are redundant. |~~
~~| 3 | `targetState` validation is repeated 9 times. | One shared transition-request parser. |~~
~~| 4 | Router preamble is repeated in 26 files. | Shared router factory or a template in the `new-route` skill. |~~
~~| 5 | 66 state-literal comparisons. | Review against the no-hard-coded-constants rule. (CR-127)|~~

Each direction above is a proposal. None is applied.
