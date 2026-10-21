import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { capabilityDefinitionsDB } from "../capabilityDefinitionsDB.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { ontologyDB } from "../ontologyDB.js";
import { userDB } from "../userDB.js";
import { transitionEntity } from "../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { eventBus } from "../../domain/engine/eventBus.js";
import type { CapabilityDefinitionRow, CapabilityRole } from "../seuTypes.js";
import { getPlatformTenantId, INITIAL_VERSION } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CapabilityDefinitionSeed {
  code: string;
  default_label: string;
  description: string | null;
  category: string;
  roles: CapabilityRole[];
  tenant_id: string;
}

function loadSeeds(): CapabilityDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "capabilityDefinitions.json"), "utf8");
  return JSON.parse(raw) as CapabilityDefinitionSeed[];
}

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export async function seedCapabilityDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { data: capabilitySchema } = await schemaDefinitionsDB.findLatest("Capability");
  if (!capabilitySchema) throw new Error("no schema_definitions grammar for Capability -- run the schema-definitions data migration first");

  const { data: categoryConcepts, error: categoryError } = await ontologyDB.findConceptsByType("category:capability", { isRoot: false, tenantId: PLATFORM_TENANT_ID });
  if (categoryError) throw new Error(`[seedCapabilityDefinitions] failed to load category:capability Ontology: ${categoryError.message}`);
  const categories = new Set((categoryConcepts ?? []).map((c) => c.code));
  const invalid = seeds.filter((s) => !categories.has(s.category));
  if (invalid.length > 0) {
    throw new Error(`[seedCapabilityDefinitions] category not in Ontology category:capability (${[...categories].join(", ")}): ${invalid.map((s) => `${s.code}="${s.category}"`).join(", ")}`);
  }

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Capability");
  if (birthError) throw birthError;
  if (!birth) throw new Error("[seedCapabilityDefinitions] no birth Transition Definition for Capability -- seed transition definitions first");
  if (!birth.event_type) throw new Error("[seedCapabilityDefinitions] the Capability birth Transition Definition names no event");

  const { rowCount: deleted } = await query("DELETE FROM capability_definitions WHERE tenant_id = $1", [PLATFORM_TENANT_ID]);
  logger.info(`[seedCapabilityDefinitions] deleted ${deleted ?? 0} platform-tenant rows -- creating ${seeds.length} baseline rows now`);

  for (const seed of seeds) {
    const { data: created, error } = await capabilityDefinitionsDB.createDraft({
      code: seed.code,
      defaultLabel: seed.default_label,
      description: seed.description,
      category: seed.category,
      roles: seed.roles,
      version: INITIAL_VERSION,
      status: birth.to_state as CapabilityDefinitionRow["status"],
      authoredBy: actor.authoredBy,
      authorBadge: actor.authorBadge,
      draftContent: { code: seed.code, defaultLabel: seed.default_label, description: seed.description ?? "", category: seed.category, roles: seed.roles },
      tenantId: PLATFORM_TENANT_ID,
      parentCapabilityDefinitionId: null,
      schemaDefinitionId: capabilitySchema.id,
    });
    if (error) throw new Error(`[seedCapabilityDefinitions] failed to create draft for ${seed.code}: ${error.message}`);
    if (!created) {
      logger.info(`[seedCapabilityDefinitions] ${seed.code} already exists, skipping`);
      continue;
    }

    await eventBus.publish({
      eventType: birth.event_type,
      originatingObjectType: "Capability",
      originatingObjectId: created.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: actor.authoredBy,
      authorityBadge: actor.authorBadge,
      payload: { code: created.code, version: created.version },
      tenantId: created.tenant_id,
    });

    const validate = await transitionEntity({ entityType: "Capability", entityId: created.id, targetState: "Validated", actorId: actor.authoredBy });
    if (!validate.ok) throw new Error(`[seedCapabilityDefinitions] failed to validate ${seed.code}: ${"detail" in validate ? validate.detail : validate.reason}`);

    const publish = await transitionEntity({ entityType: "Capability", entityId: created.id, targetState: "Published", actorId: actor.authoredBy });
    if (!publish.ok) throw new Error(`[seedCapabilityDefinitions] failed to publish ${seed.code}: ${"detail" in publish ? publish.detail : publish.reason}`);

    const activate = await transitionEntity({ entityType: "Capability", entityId: created.id, targetState: "Active", actorId: actor.authoredBy });
    if (!activate.ok) throw new Error(`[seedCapabilityDefinitions] failed to activate ${seed.code}: ${"detail" in activate ? activate.detail : activate.reason}`);

    logger.info(`[seedCapabilityDefinitions] created + activated ${seed.code}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  seedCapabilityDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedCapabilityDefinitions] failed", err as Error);
      process.exit(1);
    });
}
