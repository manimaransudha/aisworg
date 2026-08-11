// Entry point. Usage:
//   SUITE_BASE_URL=http://127.0.0.1:4900/aisworg node run.mjs
// Requires a running platform instance (NODE_ENV=test) with the seed prerequisite
// applied. See README.md.
import { run } from "./scenarios.mjs";
import { summary, urls, http } from "./lib/harness.mjs";

console.log(`\nParticipant Integration dry-run suite → ${urls.base}`);

// Preflight: fail fast with a clear message if the instance isn't reachable.
try {
  const r = await http("GET", urls.api("/tenants"));
  if (r.status !== 200) {
    console.error(`\nServer reachable but GET /tenants returned ${r.status}. Is NODE_ENV=test and the app fully started?`);
    process.exit(2);
  }
} catch (e) {
  console.error(`\nCannot reach ${urls.base} (${e.message}).`);
  console.error("Start a NODE_ENV=test instance and run the seed prerequisite first — see README.md.");
  process.exit(2);
}

await run();
const { fail } = summary();
process.exit(fail ? 1 : 0);
