
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
 
----------

## Seed data 

Here's the mapping. db:clean-slate (src/dblayer/seed/cleanSlate.ts) runs steps 3–8, each calling one seed module that reads specific JSON files from src/dblayer/seed/data/:

Step	Seed module	JSON file(s) consumed
3	seedIdentityBaseline.ts	authorityVocabulary.json (roles/badges only)
4	seedTransitionDefinitions.ts	transitionDefinitions.json
5	seedAuthorityVocabulary.ts	authorityVocabulary.json
5b	seedEventSubscriptions.ts	eventSubscriptions.json
6	seedCapabilityPatternPacks.ts	openup-requirements.pack.json, openup-architecture.pack.json, openup-development.pack.json, openup-test.pack.json, openup-project-management.pack.json, openup-configuration-and-change-management.pack.json
7	seedSdlcPhasePacks.ts	sdlc-phase-00-vision-opportunity.pack.json … sdlc-phase-15-ongoing-operations-governance.pack.json (16 files)
8	seedSdlcStandardTemplates.ts	the 9 *.template.json / *-development.profile.json pairs (saas-product, enterprise-web-application-parent, api-platform, data-platform, ai-platform, embedded-software, legacy-modernisation, mobile-application, package-implementation)
Not touched by db:clean-slate at all — three files in the same data/ directory that clean-slate deliberately leaves alone:

core-engineering.pack.json, technology-nodejs.pack.json — published once manually via pnpm pack:publish <file> --activate; clean-slate's BASE_PACK_CODES (cleanSlate.ts:107) protects platform-core-engineering and technology-nodejs from its own wipe rather than reseeding them from JSON.
domain-ebook-library.pack.json, ebook-library.template.json, ebook-library-development.profile.json — consumed by a separate, unrelated script, seedEbookLibraryPilot.ts (not imported by cleanSlate.ts).
So if you're chasing a "wrong data after clean-slate" bug, the file to edit is one of the ones in that table, keyed to whichever step's log line ([db:clean-slate] step N — ...) is producing the bad output. If it's about a base Pack (platform-core-engineering/technology-nodejs), editing the JSON alone won't do anything — it'd need re-publishing via pnpm pack:publish.

--------

https://zenfy.ac/get-started/

obj-propose@babylon.com
obj-propose@athens.com
obj-activate@athens.com

pack-define@athens.com
pack_all@platform.com
template-define@athens.com

Vocabulary 
https://www.iso.org/obp/ui/en/#iso:std:iso-iec:2382:ed-1:v2:en

https://www.sotc.in/india-tour-packages/bhutan-tour-packages/bhutan-escape?pkgId=PKG012337&packageClassId=0&destination=PKG012337_bhutan_COUNTRY_1?pkgId=PKG012337

https://www.trekpanda.in/tours/bhutan-tour-package-from-india

https://www.flamingotravels.co.in/india-tour-packages/bhutan-holiday-tour-packages


Capability Patterns (reusable process fragments)


--------
Update design/Change Requests.md. That is the master list. 

Build CR066. 
Update clean-slate seeds. 
Do not execute the test suite. 
Update the CR066, Chapter 10 implementation section and 
section 19.4 of chapter 5
 
https://www.facebook.com/reel/1884143292977556