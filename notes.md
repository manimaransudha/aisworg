**This file should not be loaded into the context** 

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










---------
 

