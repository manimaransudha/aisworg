import "dotenv/config";
import { register } from "tsx/esm/api";

// Runs once before any test file. Test-only Ontology concepts live in
// test-ontology.json so the production clean-slate never loads them.
// The test runner loads this file without the tsx loader, so the .js specifiers of the .ts sources
// resolve only after tsx is registered here.
export async function globalSetup(): Promise<void> {
  register();
  const { default: pool } = await import("../src/utils/db.js");
  const { userDB } = await import("../src/dblayer/userDB.js");
  const { seedTestTenants } = await import("../src/dblayer/seed/seedTestTenants.js");
  const { seedTestIdentity } = await import("../src/dblayer/seed/seedTestIdentity.js");
  const { seedTestOntology } = await import("../src/dblayer/seed/seedTestOntology.js");
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error("[tests/globalSetup] No superuser provisioned -- run db:clean-slate first.");
  await seedTestTenants();
  await seedTestIdentity();
  await seedTestOntology({ authoredBy: actorId, authorBadge: actorBadge });
  await pool.end();
}
