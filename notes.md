
CREATE DATABASE aisworg;
CREATE USER weirdo WITH PASSWORD 'b3@conf2026';
ALTER DATABASE aisworg OWNER TO weirdo;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO weirdo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO weirdo;
GRANT USAGE ON SCHEMA public TO weirdo;

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
 
https://zenfy.ac/get-started/

obj-propose@babylon.com
obj-propose@athens.com
pack-define@athens.com
pack_all@platform.com
template-define@athens.com

Capability Patterns (reusable process fragments)


--------


Summary of the most load-bearing new findings for §20
EBM has no transition mechanism at all — status set once at INSERT, never updated by any code (ebmsDB.ts), despite being one of the chapter's 9 named "Managed Objects."
"Runtime Services" is a pure documentation concept — zero matches anywhere in src/.
9 additional real governed entity types exist beyond the chapter's list of 9 — full real set is 16, confirmed identical between the live transition_definitions table and the TransitionEntityType TypeScript union.
Participant has a concrete FR-29.4 violation: 4 of its 10 governed transitions (Assigned→Executing, Assigned→Released, Available→Released, Executing→Released) commit state with zero event published, due to a stale lookup table (CH13_EVENT_BY_TRANSITION, participants.ts:27-34) that only covers 6 of the 10 real transitions.
No optimistic/pessimistic concurrency control exists anywhere in the transition-write path — every checked entity's UPDATE is unconditional on id, no FOR UPDATE, no version column guard. This is the single most consequential gap versus FR-29.6/§14's claims.
No versioning exists on any of the six primary governed entities (Deliverable, Decision, Knowledge, Evidence, Obligation, Participant) — directly falsifying FR-29.2 for all of them.
"Transition Definitions contributed through Packs" is not implemented — they are seeded from a static JSON file and/or edited through a separate SDK-authoring admin API; Pack installation code never writes to transition_definitions.
No recovery mechanism exists anywhere (SM-006/FR-29.5/§13 all collapse to the same zero-result grep).
No generic "transition rationale" concept exists in the running code (§9); "applicable policies satisfied" is never recorded in history (§15) — only blocking/deviation policies leave any trace.