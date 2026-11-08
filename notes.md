**This file should not be loaded into the context** 

--------


use pnpm manager and not npm to centralise the nodule modules. The projects will now have the symlinks to the downloads.

- Install pnpm
brew install pnpm
pnpm --version

- Use pnpm per project
From your project root:  pnpm install

- Where modules are actually stored
pnpm store path

- Migrating existing projects (important)
 

rm -rf node_modules package-lock.json
pnpm install

- After migrating projects
rm -rf ~/.npm
rm -rf ~/.yarn

If you want maximum savings, Add once (global). Ensures all projects share the same store.

pnpm config set store-dir ~/Library/pnpm/store


- Always use pnpm commands in that project:
pnpm add express
pnpm remove lodash
pnpm update

- Even though npm run works, you should prefer:
pnpm run <script>

Use Corepack + pnpm only

Node ships with Corepack, which manages package managers.

Enable it:
corepack enable

Pin pnpm per project:
corepack prepare pnpm@latest --activate


Now:

pnpm is the official manager

versions are pinned

npm still exists, but is irrelevant

This is how teams do it.

---------

ssh-keygen -t ed25519 -f ~/.ssh/aisworg_deploy -N ""
cat ~/.ssh/aisworg_deploy.pub


git clone --filter=blob:none --no-checkout git@github-aisworg:manimaransudha/aisworg.git aisworg
cd aisworg
git sparse-checkout set --no-cone /src /public /package.json /pnpm-lock.yaml /tsconfig.json
git checkout main
ls

cd /root/aisworg
pm2 start "pnpm start" --name aisworg --cwd /root/aisworg
pm2 logs aisworg --lines 30


------------

CREATE DATABASE aisworg;
CREATE USER weirdo WITH PASSWORD 'b3@conf2026';
ALTER DATABASE aisworg OWNER TO weirdo;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO weirdo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO weirdo;
GRANT USAGE ON SCHEMA public TO weirdo;

npx tsc --noEmit -p . 2>&1

# Connect to postgres tunnel
autossh -M 0 -N vps-db


Add node_modules/ and .env to .gitignore

bash# Initialize a new Git repository
git init

# Stage all project files (except node_modules)
git add .

# Create your first local save point
git commit -m "Initial commit: Express server setup"

# Rename your default branch to 'main'
git branch -M main

Link to GitHub and PushNow, link your local project to a cloud repository on GitHub.Go to GitHub in your browser.Click the + icon in the top-right corner and select New repository.Give your repository a name (e.g., my-express-app).Leave "Add README", "Add .gitignore", and "Choose a license" unchecked (you already have your files).Click Create repository.Copy the SSH or HTTPS URL provided under the "Quick setup" section.Run the following commands in your terminal (replace the placeholder URL with your actual copied URL):bash# Link your local project to the GitHub remote repository
git remote add origin https://github.com


# Push your local code up to GitHub
git push -u origin main

# Clean db
pnpm db:clean-slate
pnpm seed:identity-baseline

# Test suite

pnpm test


If you ever need to run a single file directly instead of the whole suite, keep the same env var:
NODE_ENV=test npx tsx --test tests/<file>.test.ts
 
### Restricting concurrency:
NODE_ENV=test node --import tsx --test --test-concurrency=1 tests/**/*.test.ts > output.txt 2>&1

### kill the dead ones
pgrep -fl node | grep -i aisworg

### Kill pgprocess

Killing idle connections is reasonable, but it's a direct action against the live DB — I'll confirm before running anything.

The safe version only targets idle/stale sessions, not active queries:


SELECT pid, usename, state, state_change, now() - state_change AS idle_for
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle'
  AND pid <> pg_backend_pid();
then terminate just those:


SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes'
  AND pid <> pg_backend_pid();
 
systemctl restart postgresql@18-main
ss -ltnp | grep 5432

--------

https://zenfy.ac/get-started/

obj-all@babylon.com

pack-define@athens.com
pack_all@platform.com
template-define@athens.com

human-415@babylon.com
tenant-admin@babylon.com

phase1-tenant-move-athens-child-a24dfa19-7784-47a7-95e2-9c5c398c0941 v1.0.1

Vocabulary 
https://www.iso.org/obp/ui/en/#iso:std:iso-iec:2382:ed-1:v2:en

Capability Patterns (reusable process fragments)

---------------

NODE_ENV=test node --import tsx --test tests/web-flow.e2e.test.ts > output.txt 2>&1 
NODE_ENV=test node --import tsx --test tests/attestation.test.ts > output.txt 2>&1 


------

pgrep -fl autossh
pkill -f "ssh -N vps-db"; sleep 2; lsof -i:5433

psql "postgresql://weirdo:b3%40conf2026@127.0.0.1:5433/aisworg" -c "select 1"


psql "postgresql://weirdo:b3%40conf2026@127.0.0.1:5433/aisworg" -c "select pid,state,wait_event_type,left(query,60) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()"


psql "postgresql://weirdo:b3%40conf2026@127.0.0.1:5433/aisworg" -c "select pg_terminate_backend(p) from unnest(array[1436428,1436503,1436536,1436789]) p"


----------
msudha@SudhaM aisworg % pkill autossh                        
msudha@SudhaM aisworg % ps aux | grep -E "autossh|ssh .*vps-db" | grep -v grep

--------

TAILSPACE
https://console.tailscale.com/admin/machines GMAIL

git log -1 --oneline

----------

NODE_OPTIONS=--trace-deprecation pnpm test:dot (trace depreciation)

pnpm test:coverage:html ( to get the test coverage)

NODE_ENV=test node --import tsx --test --test-global-setup=tests/globalSetup.ts --test-reporter=spec tests/governing-condition.test.ts > output.txt 2>&1


---------

pnpm exec tsx src/dblayer/seed/seedRouteAuthority.ts

----------
##### The test scripts
- pnpm test: compact output, written to /tmp/output.txt.
- pnpm test:report: spec output plus test-results.xml.
- pnpm test:coverage:html: text table plus coverage/index.html.

##### Reset the database completely
pnpm tsx src/dblayer/recovery/run.ts

##### Import the test results

scp root@100.65.51.120:/tmp/output.txt /Volumes/Chennai/gitrepo/aisworg/output.txt

##### Coverage test report
On VPS
> pnpm test:coverage:html

Browsable HTML, from your Mac (recommended):
> scp -r root@100.65.51.120:~/aisworg/coverage ~/Downloads/aisworg-coverage

open ~/Downloads/aisworg-coverage/index.html


##### Run only specific seeds

pnpm tsx src/dblayer/seed/seedOntologyConcepts.ts
pnpm tsx src/dblayer/seed/seedPolicyDefinitions.ts
pnpm tsx src/dblayer/seed/seedSchemaDefinitions.ts
pnpm tsx src/dblayer/seed/seedTransitionDefinitions.ts
pnpm tsx src/dblayer/seed/seedRouteAuthority.ts
pnpm tsx src/dblayer/seed/seedEventSubscriptions.ts

pnpm tsx src/dblayer/seed/demo/demoSeed.ts

##### Nginx

reload without dropping connections:
> sudo nginx -t && sudo systemctl reload nginx

restart
> sudo systemctl restart nginx

run .claude/skills/implementation-traceability skill correctly, accurately and completely including verifying all cited range on src/docs/SEU Studio Specifications/06_Platform Architectire/41_Version Management.md . There should be nothing that should be unchecked. 

Fw2 L2 Bw U Bw Dw' B2 Lw2 Bw' L' F Dw2 R B2 R' D U2 L' B' Uw2
Lw' D2 U Bw F' Uw' U Fw2 R Rw Bw2 F Dw Rw2 D R B2 Lw U2 R
Bw' L Dw2 F' Rw Bw U Fw2 Rw2 Dw2 B2 Rw Fw D Uw2 L' B F L B'


-----------


Live but untested files, by size of gap

File	Uncovered	Reachable how
redispatch.ts	40–122	DispatchDeferred → redispatchRequest → RedispatchRequested → redispatch (max attempts, attention threshold, retry)
redispatchRequest.ts	6–17	same chain
dispatchStrategies.ts	40–101	six strategies (specialist, cost, confidence, load, locality, organisation), configured per SEU
governingConditionTypes.ts	10–20, 32–38	comparison and threshold conditions on a Policy
ebmActivated.ts	10–52	EBMActivated handler, mostly guard branches
dependencyDefinitionEngine.ts	43–81, 91–93	not traced yet
deliverableKickoff.ts	198–232	not traced yet
compositionCompleted.ts	103–117 and guards	not traced yet
compositionEngine.ts	268–318	not traced yet
dispatchEngine.ts	92–118, 160–171	not traced yet
qualityGateEngine.ts	141–156, 211–229	not traced yet