// Runs the test suite in two passes. Files that create, empty or fulfil with the shared fixture Participants of test-platform run one at a time,
// so two of them never change the Participant pool together. Every other file runs in parallel. The serial files are found by the helpers they use.
// Usage: node tests/runTests.mjs [--reporter=spec]
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const POOL_HELPERS = /ensureEligibleParticipant|emptyParticipantPool|deactivateParticipants|getEmptyPoolTenantId|fulfilCapability/;
const reporter = process.argv.find((a) => a.startsWith("--reporter="))?.slice("--reporter=".length) ?? "dot";

const files = readdirSync("tests", { recursive: true })
  .map(String)
  .filter((f) => /\.test\.(ts|js)$/.test(f))
  .map((f) => path.join("tests", f))
  .sort();
const serial = files.filter((f) => POOL_HELPERS.test(readFileSync(f, "utf8")));
const parallel = files.filter((f) => !serial.includes(f));

function run(label, list, extra) {
  if (list.length === 0) return 0;
  console.log(`[tests] ${label}: ${list.length} files`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", "--test-global-setup=tests/globalSetup.ts", `--test-reporter=${reporter}`, ...extra, ...list],
    { stdio: "inherit", env: { ...process.env, NODE_ENV: "test" } }
  );
  return result.status ?? 1;
}

const first = run("parallel pass", parallel, []);
const second = run("serial pass (shared Participant pool)", serial, ["--test-concurrency=1"]);
process.exit(first || second);
