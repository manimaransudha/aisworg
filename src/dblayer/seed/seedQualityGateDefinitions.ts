import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { bulkInsert } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { getPlatformTenantId } from "../constants.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

interface QualityGateDefinitionSeedFile {
  code: string;
  name: string;
  description?: string;
  category: string;
  governedTransition: string;
  criteriaType: string;
  evidenceCategory?: string;
  deliverableName?: string;
  requiredPolicyCodes?: string[];
  checklistIds?: string[];
  recommendedChecklistIds?: string[];
  applicabilityDeliverableNames?: string[];
  version: string;
}

const QUALITY_GATE_DEFINITION_FILES = [
  "quality-gate-no-unresolved-obligations.json",
  "quality-gate-accepted-evidence-or-approved-decision.json",
  "quality-gate-fixture-quality-gate.json",
];

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

// The Platform's Quality Gate Definitions, Active and Platform-owned, written in one batch. The Ontology values they name are checked by the Pack and the
// definition authoring paths, and this seed reads no Ontology.
export async function seedQualityGateDefinitions(actor: SeedActor): Promise<void> {
  const platformTenantId = await getPlatformTenantId();
  const seeds = QUALITY_GATE_DEFINITION_FILES.map((file) => JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as QualityGateDefinitionSeedFile);
  const rows = seeds.map((s) => [
    s.code, s.name, s.description ?? null, s.category, s.governedTransition, s.criteriaType, s.evidenceCategory ?? null, s.deliverableName ?? null,
    s.requiredPolicyCodes ?? [], s.checklistIds ?? [], s.recommendedChecklistIds ?? [], s.applicabilityDeliverableNames ?? [],
    s.version, "Active", JSON.stringify(s), platformTenantId, actor.authoredBy, actor.authorBadge,
  ]);
  await bulkInsert(
    "quality_gate_definitions",
    [
      "code", "name", "description", "category", "governed_transition", "criteria_type", "evidence_category", "review_gate_code",
      "required_policy_codes", "checklist_ids", "recommended_checklist_ids", "applicability_deliverable_names",
      "version", "status", "draft_content", "tenant_id", "authored_by", "author_badge",
    ],
    rows,
    {
      onConflict: `ON CONFLICT (code, version, tenant_id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, governed_transition = EXCLUDED.governed_transition,
        criteria_type = EXCLUDED.criteria_type, evidence_category = EXCLUDED.evidence_category, review_gate_code = EXCLUDED.review_gate_code,
        required_policy_codes = EXCLUDED.required_policy_codes, checklist_ids = EXCLUDED.checklist_ids, recommended_checklist_ids = EXCLUDED.recommended_checklist_ids,
        applicability_deliverable_names = EXCLUDED.applicability_deliverable_names, draft_content = EXCLUDED.draft_content`,
    }
  );
  logger.info(`[seed:quality-gate-definitions] ${rows.length} Quality Gate Definitions seeded (Active, Platform-owned).`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  seedQualityGateDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:quality-gate-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
