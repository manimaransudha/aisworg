
CREATE DATABASE aisworg;
CREATE USER weirdo WITH PASSWORD 'b3@conf2026';
ALTER DATABASE aisworg OWNER TO weirdo;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO weirdo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO weirdo;
GRANT USAGE ON SCHEMA public TO weirdo;

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

# Test suite

pnpm test

If you ever need to run a single file directly instead of the whole suite, keep the same env var:
NODE_ENV=test npx tsx --test tests/<file>.test.ts
 



§4.3 is about the Quality Gate Model (Ch.26) being marked 🟡 Partial. There are two things in it, one real and one minor.

The real issue: Quality Gates structurally cannot gate Pack or Objective transitions.

Quality Gate evaluations are recorded in quality_gate_evaluations, and that table's seu_id column is NOT NULL. Every gate evaluation must belong to an SEU.
Pack and Objective are platform-level entities — they exist above/outside any single SEU, so they have no seu_id to supply.
Therefore a Pack transition (e.g. Active → Retired) or an Objective transition can be governed by Authority + Policy, but a Quality Gate can never be attached to them — the evaluation row can't be written without an SEU. It's a hard schema dependency, not a missing feature you can just configure.
This is logged as Open Design Question #3, and §8 states the fork it forces:

(a) make the gate's evaluation scope nullable — let quality_gate_evaluations.seu_id be null so platform-level entities can carry gates too; or
(b) accept permanently that Pack and Objective are Authority-and-Policy-governed only, and Quality Gates are an SEU-scoped concept by design.
It's a genuine design call (does a Pack's promotion deserve, say, a requires_accepted_review gate?), not an oversight. Nothing is broken today — it just bounds where gates can apply.

The minor point in the same section: only one gate can bind directly to a given (entity_type, from_state, to_state) triple, but transition_definitions.required_quality_gate_ids already lets you compose several gates onto one transition generically. So multi-gate composition exists; the "one gate per triple" is just the direct-binding limitation, not a real constraint. This part is a note, not a problem.

§4.3 is slated to be addressed in Phase 16 (Governance & EBM sharpening) — "unblock Quality Gates on Pack/Objective" is one of that phase's line items, which is where you'd make the (a)-vs-(b) decision.