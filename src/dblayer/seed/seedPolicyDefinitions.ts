// CR-089 — seed the 34 canonical Policy Definitions from
// design/fragments/policies.md, one JSON file per Policy (src/dblayer/seed/data/
// policy-*.json). Same "readFileSync + hardcoded file list" pattern
// seedCompliancePacks.ts already uses for its own 33 files. Unlike Packs
// (published through publishPack's own lifecycle machinery), these are
// written directly at status='Active' via policyDefinitionsDB — same
// convention 154_service_definitions_seed.sql used for the 60 Service
// Definitions: "a bulk import of an already-vetted catalog... Packs/
// Templates/Ontology concepts are never walked through their own authoring
// lifecycle one row at a time either."
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { PLATFORM_TENANT_ID } from "../constants.js";
import type { PolicyCondition, PolicyScope } from "../seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

interface PolicyDefinitionSeedFile {
  code: string;
  name: string;
  description: string;
  category: string;
  constraintType: "Policy" | "Standard";
  // Migrations 214/216 — these three named the OLD, now-dropped
  // policy_definitions columns' own JSON shape (applicability_deliverables,
  // governed_transition, governing_condition — all folded into each element
  // of `conditions` now, PolicyCondition.applicabilityDeliverables/
  // governingCondition). None of the 34 real seed files ever set any of
  // them to begin with ("seed data work is deferred" — owner), so the
  // mechanical fold below (attached to every condition, or left as the
  // packs.ts DEFAULT_CONDITION fallback when `conditions` is empty) is never
  // actually exercised on real data today — this only keeps this script
  // from referencing columns that no longer exist.
  applicabilityDeliverableNames: string[];
  applicabilityEnvironments: string[];
  applicabilityDeliverableLifecycle: string[];
  conditions: PolicyCondition[];
  // CR-104 follow-up — optional; none of the 34 original real files set
  // these, so they fall back to the DB column defaults (scope "Transition")
  // exactly as before this field existed.
  scope?: PolicyScope;
  governingCondition?: Record<string, unknown> | null;
  version: string;
}

function loadJson(fileName: string): PolicyDefinitionSeedFile {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as PolicyDefinitionSeedFile;
}

const POLICY_DEFINITION_FILES = [
  "policy-architecture-documentation-required.json",
  "policy-test-coverage-threshold.json",
  "policy-coding-standards.json",
  "policy-requirements-traceability-required.json",
  "policy-baseline-integrity.json",
  "policy-requirements-and-discovery-artifact-completeness.json",
  "policy-design-completeness-and-review.json",
  "policy-build-and-configuration-artifact-integrity.json",
  "policy-ai-embedded-and-data-specialisation-artifact-completeness.json",
  "policy-encryption-required.json",
  "policy-secrets-management.json",
  "policy-dependency-vulnerability-threshold.json",
  "policy-code-review-required.json",
  "policy-static-analysis-required.json",
  "policy-performance-validation.json",
  "policy-test-and-quality-evidence-completeness.json",
  "policy-deployment-approval-required.json",
  "policy-backup-validation.json",
  "policy-rollback-capability.json",
  "policy-change-approval-required.json",
  "policy-release-and-operations-artifact-completeness.json",
  "policy-adr-required.json",
  "policy-api-documentation-mandatory.json",
  "policy-operational-runbook-required.json",
  "policy-customer-sign-off-required.json",
  "policy-business-approval-required.json",
  "policy-release-notification.json",
  "policy-internal-review-process.json",
  "policy-engineering-standards.json",
  "policy-vendor-risk-assessment-required.json",
  "policy-governance-tier-alignment.json",
  "policy-change-and-decision-governance-artifact-completeness.json",
  "policy-vendor-and-compliance-evidence-completeness.json",
  "policy-organisational-knowledge-currency.json",
  // CR-104 follow-up — real, seeded validation fixtures for the SEU-scoped
  // and Eligibility-scoped Policy scopes (owner: "we have to fix publishPack
  // also. it should not override anything" — these adopt through the same
  // real Definition -> Pack -> materialised Policy path every other real
  // Policy does, no bypass).
  "policy-cr104-demo-seu-commence-work.json",
  "policy-cr104-demo-background-check.json",
];

export async function seedPolicyDefinitions(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let count = 0;
    for (const file of POLICY_DEFINITION_FILES) {
      const seed = loadJson(file);
      // Migrations 214/216/219 — mechanical fold of the old independent
      // names/lifecycle-transitions/governingCondition fields into each
      // condition's own applicabilityDeliverables rows, each carrying the
      // fold's own governingCondition (moved off the condition and onto
      // each row by migration 219): every name paired with every listed
      // transition, attached to every condition that doesn't already
      // declare its own rows. Never exercised on real data today (see the
      // interface's own comment above) — the real per-condition authoring
      // is the deferred reseed pass.
      const applicabilityDeliverables = seed.applicabilityDeliverableNames.map((name) => ({
        name, transitions: seed.applicabilityDeliverableLifecycle, governingCondition: seed.governingCondition ?? null,
      }));
      const conditions: PolicyCondition[] = (seed.conditions ?? []).map((c) => ({
        ...c,
        applicabilityDeliverables: c.applicabilityDeliverables?.length
          ? c.applicabilityDeliverables.map((row) => ({ ...row, governingCondition: row.governingCondition ?? seed.governingCondition ?? null }))
          : applicabilityDeliverables,
      }));
      await client.query(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_environments, conditions, scope, version, status, draft_content, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10, $11)
         ON CONFLICT (code, version, tenant_id) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
           applicability_environments = EXCLUDED.applicability_environments,
           conditions = EXCLUDED.conditions,
           scope = EXCLUDED.scope,
           draft_content = EXCLUDED.draft_content`,
        [
          seed.code, seed.name, seed.description, seed.category, seed.constraintType,
          seed.applicabilityEnvironments,
          JSON.stringify(conditions), seed.scope ?? "Transition",
          seed.version, JSON.stringify(seed), PLATFORM_TENANT_ID,
        ]
      );
      count++;
    }
    await client.query("COMMIT");
    logger.info(`[seed:policy-definitions] ${count} Policy Definitions seeded (Active, Platform-owned).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedPolicyDefinitions()
    .catch((err) => {
      logger.error("[seed:policy-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
