import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { serviceDefinitionsDB } from "../serviceDefinitionsDB.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { transitionEntity, publishTransition } from "../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { eventBus } from "../../domain/engine/eventBus.js";
import type { ServiceDefinitionRow, ServiceLevelExpectation } from "../seuTypes.js";
import { ontologyDB } from "../ontologyDB.js";
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

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}
  
export async function seedServiceDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const platformTenantId = await getPlatformTenantId();
  const { data: deliverableConcepts, error: deliverableError } = await ontologyDB.findConceptsByType("deliverable-name", { isRoot: false, tenantId: platformTenantId });
  if (deliverableError) throw new Error(`[seedServiceDefinitions] failed to load deliverable-name Ontology: ${deliverableError.message}`);
  const deliverableNames = new Set((deliverableConcepts ?? []).map((c) => c.code));
  const invalid = seeds.flatMap((s) => [...s.inputs.map((v) => ({ code: s.code, field: "inputs", v })), ...s.outputs.map((v) => ({ code: s.code, field: "outputs", v }))]).filter((x) => !deliverableNames.has(x.v));
  if (invalid.length > 0) {
    throw new Error(`[seedServiceDefinitions] values not in Ontology deliverable-name: ${invalid.map((x) => `${x.code}.${x.field}="${x.v}"`).join(", ")}`);
  }

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Service");
  if (birthError) throw birthError;
  if (!birth) throw new Error("[seedServiceDefinitions] no birth Transition Definition for Service -- seed transition definitions first");
  if (!birth.event_type) throw new Error("[seedServiceDefinitions] the Service birth Transition Definition names no event");

  const { rowCount: deleted } = await query("DELETE FROM service_definitions WHERE tenant_id = $1", [platformTenantId]);
  logger.info(`[seedServiceDefinitions] deleted ${deleted ?? 0} platform-tenant rows -- creating ${seeds.length} baseline rows now`);

  const { data: serviceSchema } = await schemaDefinitionsDB.findLatest("Service");
  if (!serviceSchema) throw new Error("no schema_definitions grammar for Service -- run the schema-definitions data migration first");

  let i = 0;
  const PLATFORM_TENANT_ID = platformTenantId;
  for (const seed of seeds) {
    i++;
    logger.info(`[seedServiceDefinitions] (${i}/${seeds.length}) ${seed.code} -- creating draft...`);
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
      status: birth.to_state as ServiceDefinitionRow["status"],
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
      logger.info(`[seedServiceDefinitions] (${i}/${seeds.length}) ${seed.code} already exists, skipping`);
      continue;
    }

    await eventBus.publish({
      eventType: birth.event_type,
      originatingObjectType: "Service",
      originatingObjectId: created.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: actor.authoredBy,
      authorityBadge: actor.authorBadge,
      payload: { code: created.code, version: created.version },
      tenantId: created.tenant_id,
    });

    const validate = await transitionEntity({ entityType: "Service", entityId: created.id, targetState: "Validated", actorId: actor.authoredBy });
    if (!validate.ok) throw new Error(`[seedServiceDefinitions] failed to validate ${seed.code}: ${"detail" in validate ? validate.detail : validate.reason}`);
    await publishTransition(validate);

    const publish = await transitionEntity({ entityType: "Service", entityId: created.id, targetState: "Published", actorId: actor.authoredBy });
    if (!publish.ok) throw new Error(`[seedServiceDefinitions] failed to publish ${seed.code}: ${"detail" in publish ? publish.detail : publish.reason}`);
    await publishTransition(publish);

    const activate = await transitionEntity({ entityType: "Service", entityId: created.id, targetState: "Active", actorId: actor.authoredBy });
    if (!activate.ok) throw new Error(`[seedServiceDefinitions] failed to activate ${seed.code}: ${"detail" in activate ? activate.detail : activate.reason}`);
    await publishTransition(activate);

    logger.info(`[seedServiceDefinitions] (${i}/${seeds.length}) ${seed.code} -- created + validated + published + activated`);
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
