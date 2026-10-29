Free quality assessment
Your code could be worth more than you think.
Submit your repositories for a free quality assessment. We’ll evaluate their technical quality, complexity, history, documentation, and potential value for AI development.

If your code meets our licensing criteria, DataFactor may offer you a licensing agreement, turning dormant code into a new revenue stream.

Any figure shown here or produced by the assessment is an approximate, non-binding estimate, not an offer.

Score another repo
31
F
Overall
github.com/manimaransudha/finanaly
finanaly
Backend
68%
Source LOC
62,867
Volume
51.9
Mining rank
0· very low
Task capacity
~0
Task capacity estimates how much of this repository’s history could be mined into self-contained engineering tasks: changes that arrive with the tests that prove them. It is one of the inputs to the payout estimate below.

finanaly is a solo-authored Node.js/Express financial analysis web app with a sizable codebase (63k LOC) and a surprisingly rich domain layer (metrics engines, analytical pillars, agent orchestrator). It has 47 test spec files on Node's built-in test runner with a 1:7 test to source ratio, but there is no CI configuration anywhere, no lint/format tooling, 25 files over 500 LOC (13 over 1000), and the README is mostly a personal scratchpad of reference links and shell commands rather than project documentation. Dependency management uses pnpm with a committed lockfile but no audit or update tooling, and while no hardcoded secrets were found, the README itself leaks a live-looking Postgres connection string with credentials.
judged by claude-sonnet-5

Buyer fit · what AI-training buyers now measure
✗
Builds & tests at HEADestimated
No test suite detected. Buyers now build the project and run its tests, and a repo with no runnable suite loses one of the heaviest signals they weigh.
✗
Task capacity
Almost no mineable commits. Value scales with task capacity, and quality times zero tasks is zero.
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
Dimension breakdown
D
Architecture & Robustness
some layering exists (routes/domain/dblayer/utils separation, logger.js, traceCollector.js) but routes mix raw SQL, business logic and view rendering (research.js, researchTradingStrategies.js); has_health_endpoint and has_metrics true but logging_framework is null (console/custom logger, not struct
42
B
Test Coverage
47 test spec files, test:source ratio 1:7 per repo_stats, but no test framework/config detected and no CI enforcement; tests sampled assert trivial arithmetic rather than real integration behavior (tests/unit/metrics.test.js tests 'roce = 10' not actual MetricsEngine output)
38
C
Code Cleanliness
has_lint_config is false, no linters_and_formatters configured; 25 files over 500 LOC and 13 over 1000 LOC (sector_fields.js 2032 LOC, researchTradingStrategies.js 1907 LOC, analyticalPillars.js 1839 LOC)
22
F
Docs & Onboarding
README.md is 24 lines of personal reference links and shell commands with no install/run/test/architecture sections (readme_sections empty); .env.example exists but is missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY referenced in source; no Dockerfile/compose/devcontainer
15
I
Security Hygiene
hardcoded_secret_hits is 0 in source, but README.md itself contains a live-looking postgresql connection string with embedded password (psql postgresql://doadmin:AVNS_... in README), no dep_audit_in_ci, no input_validation_patterns detected
35
E
Dependency Health
pnpm-lock.yaml committed, 25 runtime deps / 4 dev deps is reasonable, but dep_update_tooling is 'none' and total_transitive_deps unknown/0, no audit in CI
48
H
CI/CD Maturity
ci_present is false, no ci_config_files, ci_runs_tests/lint/typecheck all false
0
K
History & Maintenance
git_stats shows 131 commits from a single human author over 207 days, recency_days 89 (last commit ~3 months old relative to window), no tags/releases, conventional_rate 0.0 indicating low commit discipline
30
How to improve this score
buyer-critical fixes first, then by expected impact
01
Ship features together with their tests, in small focused commits
payout impact
high impact
Value scales with how much of the history can be mined into self-contained engineering tasks, changes that arrive with the tests proving them. Large mixed commits and test-less changes don't count toward that.

Keep each feature or fix in its own commit (or small PR) that includes the tests pinning the new behavior.
Avoid bulk commits that mix formatting, refactors, and features; they hide the mineable work.
02
Make install, build, and test work from a fresh clone
payout impact
high impact
One of the biggest drivers of what buyers pay is whether the project builds and its test suite actually runs, today, on a machine that has never seen it. No runnable suite was detected; adding one changes this repository's value more than any other item on this list.

Clone the repository into an empty directory and follow only the README: every missing step you hit is a step to add.
Commit a lockfile for every package manager so installs are reproducible.
Make the test command explicit in the README and CI, and ensure CI runs it on every push.
03
Keep developing this repository over time, in real increments
payout impact
medium impact
Buyers read the commit history as the product: a project built in a short burst, or by a single author, is a thinner mine than one with sustained back-and-forth development. Nothing cosmetic fixes this; only continued real work does.

Keep landing real changes in small commits over the coming weeks; a steady history outweighs a polished snapshot.
If teammates contribute, have them commit under their own identity so the history shows more than one human author.
04
Remove the leaked database credential from README.md
high impact
I · Security Hygiene
README.md currently contains a plaintext psql connection string with what appears to be a live DigitalOcean Postgres username and password, a severe security exposure for an otherwise 0-hardcoded-secret-hit codebase.

Edit README.md and delete the full psql connection string line containing doadmin/AVNS_fwp8lr6UGcE35JWNMwv and the digitalocean.com host.
Rotate the exposed Postgres credential at the DigitalOcean database provider immediately since it has been committed to git history.
Replace the README content with project description, install steps, and env var docs sourced from .env.example instead of personal notes and shell history.
05
Add a CI pipeline that runs lint and the existing test suite on every push
high impact
H · CI/CD Maturity
ci_present is false and no CI config file exists anywhere in the repo, so the 47 existing test files (test:coverage script already defined in package.json) never actually gate changes.

Create .github/workflows/ci.yml with a node job using actions/setup-node@v4 pinned to node 20, caching pnpm store via actions/cache.
Add steps: pnpm install --frozen-lockfile, then pnpm run test:coverage (uses existing c8 script in package.json).
Add a pnpm run test:coverage threshold check (c8 --check-coverage --lines 50) so the workflow fails below that bar, raising the threshold over time.
Commit the workflow file alone first, then in a follow-up commit fix any failing tests it surfaces, verified by a green run in the Actions tab.
06
Break up the largest god files into focused modules
medium impact
C · Code Cleanliness
13 files exceed 1000 LOC (sector_fields.js 2032, researchTradingStrategies.js 1907, analyticalPillars.js 1839, research.js 1733) with no lint config to catch this growth, hurting maintainability and reviewability.

Install and configure eslint with eslint:recommended plus a max-lines rule set to 500 in .eslintrc.json, add an npm script 'lint': 'eslint src tests'.
Split src/config/sector_fields.js into src/config/sectorFields/{fields,names,liquidity,metricDefinitions}.js and re-export from an index.js, each under 500 LOC.
Extract the per-indicator route handlers in src/routes/web/researchTradingStrategies.js and src/routes/web/research.js into src/domain/indicators/*.js modules with thin route wrappers.
Land each file split as its own small commit with the existing or new unit test covering the extracted module, then run pnpm test to confirm all 47+ spec files still pass.
07
Replace embedded raw SQL and swallowed errors in route files with a typed data layer
medium impact
D · Architecture & Robustness
src/routes/web/research.js and researchTradingStrategies.js build multi-line SQL strings inline and catch errors with bare catch { return {}; }, hiding failures from logs and from callers.

Move the price_raw/nse_master_stocks queries in research.js and researchTradingStrategies.js into src/dblayer/priceHistory.js as named functions with explicit parameters.
Replace every bare 'catch { return {}; }' in these route files with 'catch (err) { logger.error(...); throw err; }' or an explicit typed error result object.
Add tests in tests/unit for the new dblayer functions asserting both success and DB-error paths using a mocked query client.
08
Fill the gap between .env.example and actual required env vars
low impact
F · Docs & Onboarding
env_vars_missing_from_example shows SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read in source but absent from .env.example, meaning a fresh clone cannot discover every required variable.

Edit .env.example and add SUPABASE_URL= and SUPABASE_SERVICE_ROLE_KEY= placeholder lines with one-line comments describing their purpose.
Add a short 'Environment Variables' section to README.md listing each var in .env.example and which feature it gates.
09
Add an enforced coverage threshold and widen test breadth toward modules with no tests
medium impact
B · Test Coverage
test_source_ratio is 1:7 with coverage_threshold null, meaning the c8 tooling in package.json is never checked for a minimum; many domain files like agentOrchestrator.js (1540 LOC) and scrolly_engine.js have no visible corresponding spec in the sample.

Add a .c8rc.json with lines: 50, functions: 40 thresholds and wire it into the test:coverage script via 'c8 --check-coverage node --test tests/**/*.test.js'.
Write tests/unit/agentOrchestrator.test.js covering AgentOrchestrator.chat for the explore-portfolio and documentary-trigger branches shown in src/domain/agent/agentOrchestrator.js.
Commit each new test file alongside the behavior it exercises, one module at a time, and confirm pnpm run test:coverage exits 0 with the new threshold met.
Live score: structural signals plus a Claude judgment pass over a read-only copy of the repository. Hover any dimension for its evidence.

Score another
