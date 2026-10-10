# dry-run-suite rework — decisions

Detail lives in [WHITEBOARD.md](WHITEBOARD.md). This file is the short index of decisions.

## Settled

### Purpose and users
- The suite becomes a Demo-tenant data seeder, not a test or HTTP client. No assertions, no pass/fail.
- Demo is the only tenant. Atlas and Babylon are dropped.
- A visitor signs in with Google as a non-superuser, lands in the Demo tenant, and maps to the shared "Demo User" participant.
- passportConfig.js is fixed: non-superuser Google users get users.tenant_id = Demo tenant (done).

### Part 1: seeding
- Seeds Packs (P1 to P6), Profiles (PR1 to PR4) and all 22 Objectives, all progressed to Active.
- No SEU is seeded. Commissioning belongs to part 2.
- Seed data is real and sensible. The mobile-application Template is not modified. Profiles differ by selected Packs.
- P7 (reader-privacy Compliance Pack) is seeded Published with a new compliance code; the simulator simulates Ontology acceptance, after which it can be activated.
- Seeding uses the governed path (real services and transitions, Demo User as actor), with no bulk-insert bypass.
- Reset is a Demo-tenant-only purge helper, independent of db:clean-slate. It is an approved exception to the "only participants and badges" direct-write rule.
- The purge deletes only Demo-tenant rows. It never deletes the Demo tenant row, users or participants_master, and never touches platform-level rows. It keeps its own copy of the USAGE_DATA_TABLES list from src/dblayer/seed/cleanSlate.ts (copied, not imported) in the same dependency order, plus any other tenant tables the demo writes to (for example the scenario catalogue and simulator state), so the demo returns to its seeded base state.
- The demo seeding code lives in src/dblayer/seed, beside the clean-slate seeding. The landing page reset button and the dry-run-suite command both call it.
- The seed data is the base. Anything the demo user introduces is transient and removed on reset.

### Part 2: demo landing page, simulator and root screen
- Both screens live in the main application, with route_authority rows and CR-083 styling.
- Demo landing page: explains the demo, has a reset button that runs the seeding, lists allowed scenarios, and lets the demo participant raise, release and waive blockers and issue commands such as "Deliverable complete".
- Root screen: everything the landing page does, plus enabling or disabling scenarios.
- Simulator modes: manual stepping and scripted playbooks.
- The simulator acts as the shared Demo User. A badge helper adds the badges an event needs at run time and never revokes them. There is no fixed badge set to decide.
- Scenario catalogue: tenant-scoped DB table seeded from JSON. Enabled flag only. No versioning or lifecycle. Category, severity and priority reference Ontology codes.
- SEU lifecycle covers commissioning only for now. An SEU is commissioned against one leaf Objective and uses one Profile.
- Releasing a blocker is the Attention Item chain. Re-dispatch follows as event consumption.

### Helpers
- Demo helpers are new files in dry-run-suite/lib, with no import from tests/.
- The only direct writes are authorisedBadges and authorisedRole on the existing Demo User participant, plus the Demo-tenant purge.
- Authority and tenant scope are enforced by the platform, never by the suite.

## Open
- Purge build detail: the copied table list must be extended with the tenant tables it omits (for example reviews and findings), checked at build time.
- README rewrite, after the design is agreed.
