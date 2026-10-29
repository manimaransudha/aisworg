github.com/manimaransudha/aisworg
aisworg
Backend
33%
Data Engineering
67%
monorepo · +2 bonus
Source LOC
56,290
Volume
50.6
Mining rank
5· very high
Task capacity
~12
Task capacity estimates how much of this repository’s history could be mined into self-contained engineering tasks: changes that arrive with the tests that prove them. It is one of the inputs to the payout estimate below.

aisworg is a TypeScript/Express monolith implementing a domain-heavy "SEU" governance platform with PostgreSQL as the persistence layer, classified as data_engineering/backend by the tooling (likely due to heavy SQL file count) but functioning more like a backend web application with substantial domain logic. The codebase shows real engineering discipline: strong typing in seuTypes.ts, layered routes/core/web split, and a substantial test suite (78 spec files, 1:7 ratio) with tests that exercise real behavior against a live dev database. However there is no CI configured at all, no lint/format tooling, no Dockerfile or devcontainer for reproducible setup, no README content, and tests require a real Postgres database with no mocking, which blocks independent/offline verification. Single-author, short-lived commit history (74 commits over 86 days) also signals a young, unreleased project rather than a mature maintained one.
judged by claude-sonnet-5

Buyer fit · what AI-training buyers now measure
✗
Builds & tests at HEADestimated
No test suite detected. Buyers now build the project and run its tests, and a repo with no runnable suite loses one of the heaviest signals they weigh.
△
Task capacity
~12 mineable commits: sellable, but capacity multiplies value; small atomic feature+test commits grow it.
△
Genuine history
Single-author history: genuine, but a thinner mine than a team's back-and-forth.
✓
Self-contained
A library is self-contained by nature.
✓
Not a demo
Nothing suggests a demo or template.
Buyer criteria are evolving: beyond the quality score, buyers now weigh whether a repository installs, builds, and runs its own tests, whether it can be exercised in isolation, and how much genuinely mineable engineering history it holds. These signals are read from the repository’s artifacts. The assessment never executes your code.

Estimated payout
$0
up to $4,800 total per contributor · approximate, non-binding estimate, not an offer
buyer criteria are evolving: the buyer-fit signals also shape final offers
This repository doesn’t reach the payout range yet. Payouts start at our quality bar and grow steeply above it: code below the bar pays nothing no matter how much of it there is, and a minimum volume is required. The recommendations below show where to start. Final payout is subject to review and a partnership agreement.

Get in touch about this repository
Backend · dimensions
50% of repo
34.9 · F
D
Architecture & Robustness
clear routes/core/web/dblayer layering and strong TS typing (seuTypes.ts, formGenerator.ts) with typed DbResult<T> error pattern, but logging_framework:null, no error tracking, no health endpoint despite has_metrics:true
55
B
Test Coverage
78 test spec files with 1:7 test:source ratio and real DB-backed integration tests, but no CI enforcement and no coverage threshold configured (coverage_threshold: null)
45
C
Code Cleanliness
has_lint_config:false, no linters_and_formatters detected, and 17 files over 500 LOC (4 over 1000 LOC) e.g. tests/web-flow.e2e.test.ts at 1290 LOC and sdkAuthoring.ts at 1272 LOC
30
F
Docs & Onboarding
readme:null, readme_loc:0, no changelog, no contributing guide, no Dockerfile/compose/devcontainer, env_example_file:null despite 20 env vars referenced in source
5
I
Security Hygiene
hardcoded_secret_hits:0 and no committed .env files, but no dep_audit_in_ci and input_validation_patterns empty despite handling auth (passport, bcryptjs, csrf-csrf)
40
E
Dependency Health
pnpm-lock.yaml committed and a lean, reasonably modern dependency set (24 runtime deps) but dep_update_tooling:none and total_transitive_deps unreported
45
H
CI/CD Maturity
ci_present:false and ci_config_files empty, no lint/typecheck/test enforcement in any pipeline
0
K
History & Maintenance
git_stats shows single human author, 74 commits over an 86-day span, zero tags/releases, last commit 2 days before analysis (recency_days:2) indicating a young solo project without release cadence
25
Data Engineering · dimensions
50% of repo
31.1 · F
D
Architecture & Robustness
dblayer/*DB.js modules provide a data-access layer abstraction over pg with typed rows, but no structured logging framework or lineage documentation found
50
B
Test Coverage
78 test spec files, 1:7 test:source ratio, tests hit real Postgres via pool.query but no CI to enforce them
45
C
Code Cleanliness
no lint config detected and 4 files over 1000 LOC (sdkAuthoring.ts 1272 LOC, seuTypes.ts 1145 LOC) indicating god-file risk
30
F
Docs & Onboarding
readme:null with zero README sections, no .env.example despite DATABASE_URL and other DB env vars referenced in source, no docker-compose for the Postgres dependency
5
I
Security Hygiene
no hardcoded secrets found but also no dep audit in CI and validation patterns not detected by tooling despite domain-level validate* functions in packs.ts
35
E
Dependency Health
single pnpm-lock.yaml committed, 24 runtime deps including pg, no renovate/dependabot config (dep_update_tooling:none)
45
H
CI/CD Maturity
ci_present:false, no pipeline runs tests, lint, or typecheck anywhere in the repo
0
K
History & Maintenance
single-author repo with 74 commits across 86 days and no tags, per git_stats.py output, suggesting early-stage solo maintenance
25
N
Pipeline & Data Quality
72 SQL files (1668 LOC) and migration scripts (src/dblayer/migrations/run.ts, seed:* npm scripts) exist but no visible orchestration tool, idempotency tests, or documented lineage beyond ad-hoc seed scripts
30
How to improve this score
buyer-critical fixes first, then by expected impact
01
Make install, build, and test work from a fresh clone
payout impact
high impact
One of the biggest drivers of what buyers pay is whether the project builds and its test suite actually runs, today, on a machine that has never seen it. No runnable suite was detected; adding one changes this repository's value more than any other item on this list.

Clone the repository into an empty directory and follow only the README: every missing step you hit is a step to add.
Commit a lockfile for every package manager so installs are reproducible.
Make the test command explicit in the README and CI, and ensure CI runs it on every push.
02
Ship features together with their tests, in small focused commits
payout impact
medium impact
Value scales with how much of the history can be mined into self-contained engineering tasks, changes that arrive with the tests proving them. Large mixed commits and test-less changes don't count toward that.

Keep each feature or fix in its own commit (or small PR) that includes the tests pinning the new behavior.
Avoid bulk commits that mix formatting, refactors, and features; they hide the mineable work.
03
Keep developing this repository over time, in real increments
payout impact
medium impact
Buyers read the commit history as the product: a project built in a short burst, or by a single author, is a thinner mine than one with sustained back-and-forth development. Nothing cosmetic fixes this; only continued real work does.

Keep landing real changes in small commits over the coming weeks; a steady history outweighs a polished snapshot.
If teammates contribute, have them commit under their own identity so the history shows more than one human author.
04
Add a CI pipeline that runs lint, typecheck, and tests on every push
high impact
H · CI/CD Maturity
ci_present is false and there is no ci_config_files entry anywhere in the bundle, meaning none of the 78 existing test files or the tsc typecheck script are ever automatically verified.

Create .github/workflows/ci.yml with jobs for pnpm install --frozen-lockfile, pnpm run typecheck, and pnpm run test:coverage on push and pull_request events.
Pin the Node and pnpm versions in the workflow (actions/setup-node@v4 with node-version 22, pnpm/action-setup@v4) and cache the pnpm store.
Add a job step running pnpm audit or a dependency scan tool and fail the build on high severity findings.
Commit the workflow file and verify it on GitHub Actions shows green checks for typecheck and test jobs on the next push.
05
Make the test suite runnable without a live Postgres dev database
high impact
B · Test Coverage
tests/attestation.test.ts and tests/cr104-mandatory-seu-eligibility-policies.test.ts explicitly state 'Run against the real dev database, no mocking', which means the test suite cannot execute from a fresh clone without external infrastructure, blocking both CI and isolated verification.

Add a docker-compose.yml at the repo root that spins up a postgres:16 service with the schema from src/dblayer/migrations applied via the existing migrate:seu script.
Update tests/globalSetup.ts to point DATABASE_URL at the compose-provided Postgres instance when NODE_ENV=test, falling back to an in-memory or testcontainers-based Postgres if compose is unavailable.
Wire the CI workflow (.github/workflows/ci.yml) to start the compose Postgres service before running pnpm run test:coverage so tests/*.test.ts pass with zero manual setup.
Land this change as a series of small commits: one adding docker-compose.yml, one wiring globalSetup.ts, one updating CI, each verified green.
06
Write a real README with setup, run, and test instructions
high impact
F · Docs & Onboarding
readme is null (readme_loc 0) and there is no .env.example despite 20 env vars referenced in source (DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID etc), so a new engineer cannot clone and run the project.

Create README.md describing what aisworg is, its architecture (dblayer/routes/core/web/domain layering), and how to install with pnpm install.
Create .env.example listing all 20 env vars found in source (DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SMTP_USER, SMTP_FROM, PORT, NODE_ENV, LOG_LEVEL, etc) with placeholder values.
Document the pnpm run migrate:seu, pnpm run seed:* and pnpm run test:coverage commands in README.md under a Testing section.
Verify a fresh clone can follow README.md end to end: pnpm install, cp .env.example .env, pnpm run migrate:seu, pnpm test, and confirm it exits 0.
07
Enforce lint and formatting and split god files
medium impact
C · Code Cleanliness
has_lint_config is false and linters_and_formatters is empty, and 4 files exceed 1000 LOC (seuTypes.ts 1145, tests/web-flow.e2e.test.ts 1290, sdkAuthoring.ts 1272, tests/testFixtures.ts 1265).

Add eslint.config.js with @typescript-eslint recommended rules and prettier integration, plus a format script in package.json.
Add a lint job to .github/workflows/ci.yml running pnpm run lint and failing the build on any error.
Split src/dblayer/seuTypes.ts into per-entity type files (e.g. packTypes.ts, templateTypes.ts, objectiveTypes.ts) under src/dblayer/types/ and re-export from an index.ts, landing this as its own tested commit.
Split src/routes/seu/core/sdkAuthoring.ts (1272 LOC) by entity kind into smaller modules under src/routes/seu/core/sdkAuthoring/ and update imports, verifying pnpm run typecheck and pnpm test still pass.
08
Add structured logging and a health endpoint
medium impact
D · Architecture & Robustness
logging_framework is null and has_health_endpoint is false even though this is an Express service with sessions, DB pooling, and cron jobs (node-cron dependency), so production issues are hard to diagnose.

Replace src/utils/logger.js console-based calls with a structured logger such as pino, emitting JSON logs with request id and level.
Add a GET /health route in src/app.ts that checks the pg pool connection and returns 200 with status json, plus a GET /metrics route if feasible.
Commit the logger swap and health route as two separate small commits, each with a test asserting the health endpoint returns 200.
