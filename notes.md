
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



Going through Chapter 9's §19 findings systematically against this design — organized as: resolved, enabled-but-needs-a-decision, unaffected, and new questions the redesign itself introduces.

Directly resolved
§19.2 Dependency Types (2 of 7 built) — this is exactly what the redesign targets, for the types that have a stable, pre-declarable identity. Deliverable and Capability/Service both do (Template catalogues already enumerate them). This closes the type-widening problem for those two cleanly.

FR-9.7 traceability, the "no state-change history" half — removing the stored per-edge readiness_state doesn't lose anything, because satisfaction becomes a derived fact ("has the underlying Deliverable instance reached the required state") rather than owned state — and that transition already has full actor+badge traceability today (Chapter 15 §21.10). So the gap closes as a side effect, not because anyone builds new traceability.

Enabled, but needs an explicit decision from you — not automatic
§19.10 FR-9.5, circular dependency detection — real cycle detection becomes genuinely tractable once the graph is a fixed, finite, per-Template set of named nodes (you can statically walk it at authoring time, same spirit as templates.ts's existing "must reference an earlier catalogue entry" check, just a real graph traversal instead of a linear-order rule). This redesign enables it. It doesn't build it. Does this CR include real cycle detection, or is that still a separate follow-up? [Sudha: This will be a new CR . We create this as a widget and this will be the deliverable catalogue part of CR38. We do not have to build this as part of the dependency engine CR. I hope I understood this correctly ]

§19.6/§19.7, pull-not-push and lazy re-evaluation — unrelated to the node/edge shape per se, but a natural moment to fix, since you're touching this engine anyway. Does this CR also make satisfaction event-driven (subscribe to the underlying entity's transition event, proactively evaluate what it unlocks), or does evaluation stay pull-only (checked when someone attempts the next transition) and push-based triggering stays a separate future CR? [Sudha: This should be push. When a transition happens do the check and push it into the Event Bus]

§19.9 Events (0 of 9) — same shape of question. Wiring eventBus in is a natural add-on here, but it's additive to the schema redesign, not implied by it. [Sudha: Yes, let us do it as a separate CE]

The one real open design question the redesign surfaces
§19.4, and your own "all entities go through the same canonical form." Deliverable and Capability/Service have stable, pre-planned identities — a Template's catalogue names them ahead of time, so (name, state) is a real, known node. Decision/Obligation/Evidence/Knowledge don't work that way today — they're not planned in a catalogue, they arise during execution (an Obligation gets raised when a gate fails; a Decision gets created ad hoc). Today's mechanism for "does this Deliverable have an Approved Decision attached" is qualityGateEngine's requires_accepted_evidence_or_approved_decision — a category/existence check ("is there any Decision of this kind, in this state, attached to this Deliverable"), not a named node. [Sudha: How does it matter ? All of these have a transition definition. Those are the states. Are n't they?]

So "same canonical form for all entities" has two possible meanings, and they're quite different builds:

Unify the mechanism: fold Quality Gate criteria into the same dependency-engine table as a different kind of node — not (name, state) but something like (category, state, cardinality) — so Deliverable/Capability dependencies and Decision/Obligation/Evidence dependencies both live in one table, evaluated by one engine, just with two different node shapes.
Unify the identity model too: require Decision/Obligation/Evidence/Knowledge to also become named, pre-planned things a Template declares in advance (e.g. a Template says "this Deliverable requires a Decision named 'Architecture Approach'"), making them structurally identical (name, state) nodes like Deliverables.
(1) is a real, buildable consolidation of two existing engines. (2) is a much bigger behavioral change — it would mean Decisions/Obligations/Evidence stop being ad hoc and start being catalogue-planned, which is a genuine shift in how those entities work today, not just a dependency-engine refactor.

Which of these did you mean — or is Decision/Obligation/Evidence/Knowledge genuinely out of scope for this CR, and "all entities" means Deliverable + Capability/Service only for now?

Unaffected either way
§19.5 Constraint Detection, §19.8 Flow Optimisation — neither is touched by this redesign. Both stay separate, unbuilt features regardless of which direction the open question above goes.