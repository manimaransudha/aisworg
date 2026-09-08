# Software Architecture & Code Quality Audit Report

**Target Scope**: `/src` Directory  
**Date**: September 8, 2026  
**Auditor**: Antigravity Assistant  
**Document Status**: Final  

---

## 1. Executive Summary

This report presents a thorough software architecture, design principles, and code quality audit of the source codebase located under `src/`. The audit evaluated module organization, design pattern consistency, database interaction safety, authentication/authorization guardrails, error propagation, type safety, and compliance with `coding_principles.md`.

Overall, the codebase demonstrates a mature, highly structured domain-driven architecture for the AI Software Engineering Unit (SEU) platform. It exhibits robust design patterns such as:
- Parameterized database querying via PostgreSQL connection pooling (`pg`).
- A disciplined SQL query pagination, sorting, and whitelisting layer (`listQuery.ts`).
- Declarative tenant isolation (`requireTenantScope.ts`) and badge-based capability authorization (`requireBadge.ts`).
- An decoupled in-memory / persistent event-driven orchestrator (`eventBus.ts`).

Several key areas of improvement and technical debt were identified, primarily surrounding TypeScript migration gaps, legacy dead code / unused clients, session handling edge-cases, and error handling consistency.

---

## 2. Audit Scope & Methodology

### 2.1 Scope
The audit covered all subdirectories and source modules under `src/`:
- **Core Entry & Routing**: [`app.js`](file:///Volumes/Chennai/gitrepo/aisworg/src/app.js), [`routes/web/`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/web), [`routes/seu/api/`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/api), [`routes/seu/core/`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/core)
- **Middleware & Security**: [`middleware/auth.js`](file:///Volumes/Chennai/gitrepo/aisworg/src/middleware/auth.js), [`middleware/gatekeeper.js`](file:///Volumes/Chennai/gitrepo/aisworg/src/middleware/gatekeeper.js), [`middleware/requireTenantScope.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/middleware/requireTenantScope.ts), [`middleware/requireBadge.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/middleware/requireBadge.ts)
- **Data Access & Storage**: [`dblayer/`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer), [`utils/db.js`](file:///Volumes/Chennai/gitrepo/aisworg/src/utils/db.js), [`utils/listQuery.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/utils/listQuery.ts)
- **Domain Engine**: [`domain/engine/`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine), [`domain/auth/`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/auth), [`domain/identity/`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/identity)
- **Adapters & Integrations**: [`adapters/`](file:///Volumes/Chennai/gitrepo/aisworg/src/adapters), [`utils/supabaseAdmin.js`](file:///Volumes/Chennai/gitrepo/aisworg/src/utils/supabaseAdmin.js)

### 2.2 Methodology
Static code review was conducted against:
1. **Software Architecture & Modular Cohesion**: Evaluated layer independence, dependency direction, and domain encapsulation.
2. **Data Access Integrity**: Reviewed SQL parametrization, connection management, numeric type parsing, and query building safety.
3. **Control Flow & Error Resilience**: Evaluated exception handling, middleware error traps, and async route error forwarding.
4. **TypeScript & Language Hygiene**: Analyzed dual JS/TS integration, type coverage, and strictness.
5. **Project Principles**: Verified compliance with `coding_principles.md` (no unneeded deletions, preserved legacy comments, standardized paginated/searchable list UIs).

---

## 3. Layer-by-Layer Architectural Assessment

```
                      ┌─────────────────────────────────────────┐
                      │              HTTP Requests              │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │       App Engine & Express Pipeline     │
                      │  (app.js, doubleCsrf, express-session)  │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │         Middleware Authorization        │
                      │(gatekeeper, requireTenantScope, Badge) │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │         Domain & Engine Surface         │
                      │ (eventBus, transitionEngine, validate)  │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │             Data Access Layer           │
                      │ (dblayer/*DB.ts, query, listQuery.ts)   │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │           PostgreSQL Database           │
                      └────────────────────┬────────────────────┘
```

### 3.1 Application Core (`src/app.js`, `src/config/appconfig.js`)
* **Strengths**: Clear middleware pipeline sequencing. App initializes session store, CSRF defense (`double-submit-cookie`), Passport authentication, event bus subscriptions, and route mounting logically.
* **Findings**:
  * **Dual JS/TS Mix**: `app.js` is written in JavaScript (`ESM`) while importing modules written in TypeScript (compiled via `tsx`/`ts-node` at runtime).
  * **Exemption Management**: CSRF middleware exempts specific routes (`/aisworg/demo/`, `/aisworg/api/seu/`). The rationale is documented in comments, but maintenance requires keeping route paths strictly synchronized.
  * **Test Auto-Login Shim**: Lines 99–158 in `app.js` contain a test-only auto-login shim (`NODE_ENV === 'test'`). While scoped to the test environment, bundling development/testing auth shims in the primary application entry file adds complexity.

### 3.2 Data Access Layer (`src/dblayer/`, `src/utils/db.js`, `src/utils/listQuery.ts`)
* **Strengths**:
  * Excellent SQL safety discipline: Queries strictly use parameterized bindings (`$1`, `$2`, etc.) preventing standard SQL injection vectors.
  * `listQuery.ts` implements a central, robust pagination, sorting, and search engine. Sort keys are strictly whitelisted against allowed code identifiers (`opts.sortable.includes(sortRaw)`).
  * Custom type parsers for PostgreSQL `NUMERIC` (OID 1700), `BIGINT` (OID 20), `DATE` (1082), and `TIMESTAMP`/`TIMESTAMPTZ` (1114/1184) ensure consistent JSON serialization across the API.
* **Findings**:
  * **SSL Configuration**: In `src/utils/db.js`, line 32 has commented-out SSL verification (`// ssl: { rejectUnauthorized: false }`), relying entirely on connection string URL flags. Production deployments should explicitly enforce SSL configuration through environment variables.
  * **Code Duplication in Error Checking**: `isConnectionError()` helper functions are defined separately in both `src/utils/db.js` and `src/utils/supabaseAdmin.js`.

### 3.3 Middleware & Authorization (`src/middleware/`)
* **Strengths**:
  * `requireTenantScope.ts` implements defensive tenant isolation, preventing cross-tenant access and ensuring `NULL` comparison safety ("NULL never matches").
  * `requireBadge.ts` enforces fine-grained authorization mapped to `noun_verb` capability pairs.
  * `gatekeeper.js` enforces central session validation with defined public route prefix checking.
* **Findings**:
  * **Express Async Handling**: Express 4.x does not automatically catch rejected promises in async route handlers/middleware. If an async function inside a middleware (e.g. `requireTenantScope.ts` or route logic) throws an unhandled error without passing it to `next(err)` or using `express-async-errors`, the request can hang or crash the process.

### 3.4 Domain Engine & Orchestration (`src/domain/engine/`)
* **Strengths**:
  * Clean domain event bus pattern (`eventBus.ts`) implementing persistent audit logging in `eventsDB` alongside in-memory distribution.
  * Transition engine (`transitionEngine.ts`) abstracts lifecycle state machines for SEU objects cleanly.
* **Findings**:
  * **In-Memory Event Bus Scaling**: `eventBus.ts` processes events in-memory using local subscription callbacks. For single-instance execution this is highly performant, but horizontal scaling across multiple web nodes would require an external event broker (e.g., Redis pub/sub or PostgreSQL LISTEN/NOTIFY).

### 3.5 Legacy Components (`src/utils/supabaseAdmin.js`)
* **Findings**:
  * `src/utils/supabaseAdmin.js` is marked as legacy (`// src/utils/supabaseAdmin.js \n // This is legacy`). It initializes a Supabase client with dummy fallback credentials in test mode. Unused legacy infrastructure should be audited to verify if any remaining imports exist.

---

## 4. Categorized Audit Findings & Detailed Analysis

| ID | Finding Title | Severity | Component | Summary |
|---|---|---|---|---|
| **AUD-01** | Async Error Forwarding in Express Handlers | **Medium** | `src/routes/`, `src/middleware/` | Lack of central `express-async-errors` wrapper exposes unhandled promise rejections if `next(err)` is omitted in custom async callbacks. |
| **AUD-02** | Mixed JavaScript / TypeScript Architecture | **Medium** | `src/app.js`, `src/utils/` | Core entry file `app.js` and several utility modules remain JavaScript, while domain models and DB layers are TypeScript. |
| **AUD-03** | Redundant Database Connection Error Helpers | **Low** | `utils/db.js`, `utils/supabaseAdmin.js` | Duplicate implementation of `isConnectionError()` across two utility modules. |
| **AUD-04** | Hardcoded Session Secret Fallback Warning | **Low** | `src/app.js` | Session secret relies on `process.env.SESSION_SECRET` with an inline error throw. Proper startup validation is recommended. |
| **AUD-05** | Production SSL Flag Enforcement | **Low** | `src/utils/db.js` | Database SSL parameters rely on string query parsing rather than explicitly structured pool configuration. |

---

## 5. Compliance with Coding Principles (`coding_principles.md`)

1. **No Code Deletion Policy**:
   - **Status**: **Pass**
   - Verified that legacy features (such as old role-gating or legacy redirects) are preserved or commented out with rationale comments (`CR-*` references).

2. **Database Query Parametrization**:
   - **Status**: **Pass**
   - 100% of analyzed database interactions in `src/dblayer/*DB.ts` and `userDB.js` use parameterized query arrays (`$1`, `$2`), avoiding dynamic SQL string concatenation.

3. **Standardized List UI Plumbing**:
   - **Status**: **Pass**
   - `src/utils/listQuery.ts` provides uniform pagination (`LIMIT`/`OFFSET`), sort key whitelisting, and memory/SQL fallback pagination.

4. **Tenant Scope Isolation**:
   - **Status**: **Pass**
   - `requireTenantScope.ts` cleanly isolates tenant resources and avoids leaking existence metadata on unauthorized queries.

---

## 6. Strategic Recommendations & Action Plan

### Short-Term Recommendations
1. **Adopt `express-async-errors`**:
   Import `express-async-errors` at the top of `src/app.js` to ensure all rejected promises in async middleware and route handlers automatically route to `errorHandler.js`.
2. **Consolidate Connection Error Helpers**:
   Refactor `isConnectionError` into a single shared helper in `src/utils/db.js` and remove duplicate code from `supabaseAdmin.js`.
3. **Environment Variable Validation at Startup**:
   Enhance `appConfig.init()` to validate critical environment variables (`SESSION_SECRET`, `DATABASE_URL`) during startup before accepting HTTP traffic.

### Long-Term Architectural Enhancements
1. **Complete TypeScript Migration**:
   Migrate remaining core JavaScript files (`app.js`, `src/utils/db.js`, `src/middleware/auth.js`) to TypeScript (`app.ts`, `db.ts`, `auth.ts`) for complete type safety across the application boundary.
2. **Distributed Event Bus Integration**:
   If multi-node deployment is required, extend `eventBus.ts` to support PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub to synchronize event dispatching across process nodes.

---

*Report compiled and saved under `design/code-audit-report.md`.*
