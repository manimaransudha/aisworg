// service_definitions recovery seed — restores the 63 baseline rows
// (extracted from src/dblayer/recovery/service_definitions_data_recovery.sql,
// folding in its own 155/159/161/165 per-row replays) as JSON in
// data/serviceDefinitions.json.
//
// Same governed-lifecycle discipline as seedCapabilityDefinitions.ts: a row
// starts life via serviceDefinitionsDB.createDraft (status 'Defined') and
// only becomes usable through the real governed transitions
// (transitionServiceDefinition, core/serviceDefinitions.ts) -- Defined ->
// Published -> Active. A raw bulk INSERT of the old flat rows would bypass
// that lifecycle entirely (the parallel-mechanism gap CLAUDE.md rules out),
// so this seed goes through createDraft + the two real governed hops for
// every missing row, same as a human author would.
//
// NOT wired into cleanSlate.ts (service_definitions is INSERT-only /
// lifecycle-governed at the application layer, same reasoning as
// capability_definitions/schema_definitions). Runnable from the Data
// Migrations admin UI (DATA_MIGRATION_TARGETS, core/dataMigrations.ts), and
// standalone:
//   npx tsx src/dblayer/seed/seedServiceDefinitions.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { serviceDefinitionsDB } from "../serviceDefinitionsDB.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { transitionServiceDefinition } from "../../routes/seu/core/serviceDefinitions.js";
import type { ServiceLevelExpectation } from "../seuTypes.js";
import { userDB } from "../userDB.js";
import { getPlatformTenantId } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServiceDefinitionSeed {
  code: string;
  name: string;
  capability_code: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  service_level: ServiceLevelExpectation[];
  governance: string;
  success: string;
  consumers: string[];
  version: string;
  tenant_id: string;
}

function loadSeeds(): ServiceDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "serviceDefinitions.json"), "utf8");
  return JSON.parse(raw) as ServiceDefinitionSeed[];
}

// authoredBy is a participants_master.id -- createDraft's authoredBy and
// transitionServiceDefinition's actorId are both this same
// participants_master.id.
export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}
  
export async function seedServiceDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const { rows: existing } = await query<{ code: string; tenant_id: string }>(
    "SELECT code, tenant_id FROM service_definitions"
  );
  const existingKeys = new Set(existing.map((r) => `${r.code}|${r.tenant_id}`));

  const missing = seeds.filter((s) => !existingKeys.has(`${s.code}|${s.tenant_id}`));
  if (missing.length === 0) {
    logger.info("[seedServiceDefinitions] every baseline row already present, nothing to do");
    return;
  }
  logger.info(`[seedServiceDefinitions] ${missing.length} of ${seeds.length} baseline rows missing -- creating now`);

  const { data: serviceSchema } = await schemaDefinitionsDB.findLatest("Service");
  if (!serviceSchema) throw new Error("no schema_definitions grammar for Service -- run the schema-definitions data migration first");

  let i = 0;
  // get platform tenant id
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  for (const seed of missing) {
    i++;
    logger.info(`[seedServiceDefinitions] (${i}/${missing.length}) ${seed.code} -- creating draft...`);
    const { data: created, error } = await serviceDefinitionsDB.createDraft({
      code: seed.code,
      name: seed.name,
      capabilityCode: seed.capability_code,
      purpose: seed.purpose,
      inputs: seed.inputs,
      outputs: seed.outputs,
      serviceLevel: seed.service_level,
      governance: seed.governance,
      success: seed.success,
      consumers: seed.consumers,
      version: seed.version,
      authoredBy: actor.authoredBy,
      authorBadge: actor.authorBadge,
      draftContent: {
        code: seed.code, name: seed.name, capabilityCode: seed.capability_code, purpose: seed.purpose, inputs: seed.inputs,
        outputs: seed.outputs, serviceLevel: seed.service_level, governance: seed.governance, success: seed.success, consumers: seed.consumers,
      },
      tenantId: PLATFORM_TENANT_ID,
      parentServiceDefinitionId: null,
      schemaDefinitionId: serviceSchema.id,
    });
    if (error) throw new Error(`[seedServiceDefinitions] failed to create draft for ${seed.code}: ${error.message}`);
    if (!created) {
      logger.info(`[seedServiceDefinitions] (${i}/${missing.length}) ${seed.code} already exists, skipping`);
      continue;
    }

    const publish = await transitionServiceDefinition({ serviceDefinitionId: created.id, targetState: "Published", actorRole: actor.authorBadge, actorId: actor.authoredBy});
    if (!publish.ok) throw new Error(`[seedServiceDefinitions] failed to publish ${seed.code}: ${publish.reason}${publish.detail ? ` (${publish.detail})` : ""}`);

    const activate = await transitionServiceDefinition({ serviceDefinitionId: created.id, targetState: "Active", actorRole: actor.authorBadge, actorId: actor.authoredBy});
    if (!activate.ok) throw new Error(`[seedServiceDefinitions] failed to activate ${seed.code}: ${activate.reason}${activate.detail ? ` (${activate.detail})` : ""}`);

    logger.info(`[seedServiceDefinitions] (${i}/${missing.length}) ${seed.code} -- created + published + activated`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`No participants_master row for user_id ${actorId} -- log in as root first.`);
  seedServiceDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedServiceDefinitions] failed", err as Error);
      process.exit(1);
    });
}
