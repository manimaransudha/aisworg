---
name: seed-scripts
description: Rules for writing or changing seed scripts under src/dblayer/seed — loading the Ontology once, validating in memory, writing in one batch with bulkInsert, and how seed data reaches the database. Use whenever the user asks to add, change or review a seed script or seed JSON, or work touches seedParticipantsMaster, seedOntologyConcepts or another seed*.ts file.
---

# Seed scripts

- A seed script loads the Ontology once (per tenant) and validates every row in memory against that set. It never queries the Ontology per row.
- A seed script that calls `assertCanonicalCategory` deviates from this rule. Do not change the validating functions themselves.
- A seed script writes in one batch through `bulkInsert` (`src/utils/db.ts`). A seed script that does not use `bulkInsert` deviates from this rule.
- Seed data reaches the database only through `db:clean-slate`. Do not add a `pnpm seed:X` entry to package.json.
- A new seed function is imported into `cleanSlate.ts` and wired into its run sequence after whatever it depends on.
- Run `db:clean-slate` only on the user's explicit instruction in that turn.
- The Demo tenant seed is separate. It writes through the governed path, not `bulkInsert`. See the `demo` skill.
