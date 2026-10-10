import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { capabilityDefinitionsDB } from "../capabilityDefinitionsDB.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { userDB } from "../userDB.js";
import { transitionCapabilityDefinition } from "../../routes/seu/core/capabilityDefinitions.js";
import type { CapabilityRole } from "../seuTypes.js";
import { getPlatformTenantId } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CapabilityDefinitionSeed {
  code: string;
  default_label: string;
  description: string | null;
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
  const { rows: existing } = await query<{ code: string; tenant_id: string }>(
    "SELECT code, tenant_id FROM capability_definitions"
  );
  const existingKeys = new Set(existing.map((r) => `${r.code}|${r.tenant_id}`));

  const missing = seeds.filter((s) => !existingKeys.has(`${s.code}|${s.tenant_id}`));
  if (missing.length === 0) {
    logger.info("[seedCapabilityDefinitions] every baseline row already present, nothing to do");
    return;
  }

  const { data: capabilitySchema } = await schemaDefinitionsDB.findLatest("Capability");
  if (!capabilitySchema) throw new Error("no schema_definitions grammar for Capability -- run the schema-definitions data migration first");

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  for (const seed of missing) {
    const { data: created, error } = await capabilityDefinitionsDB.createDraft({
      code: seed.code,
      defaultLabel: seed.default_label,
      description: seed.description,
      roles: seed.roles,
      version: "1.0.0",
      authoredBy: actor.authoredBy,
      authorBadge: actor.authorBadge,
      draftContent: { code: seed.code, defaultLabel: seed.default_label, description: seed.description ?? "", roles: seed.roles },
      tenantId: PLATFORM_TENANT_ID,
      parentCapabilityDefinitionId: null,
      schemaDefinitionId: capabilitySchema.id,
    });
    if (error) throw new Error(`[seedCapabilityDefinitions] failed to create draft for ${seed.code}: ${error.message}`);
    if (!created) {
      logger.info(`[seedCapabilityDefinitions] ${seed.code} already exists, skipping`);
      continue;
    }

    const publish = await transitionCapabilityDefinition({ capabilityDefinitionId: created.id, targetState: "Published", actorRole: actor.authorBadge, actorId: actor.authoredBy});
    if (!publish.ok) throw new Error(`[seedCapabilityDefinitions] failed to publish ${seed.code}: ${publish.reason}${publish.detail ? ` (${publish.detail})` : ""}`);

    const activate = await transitionCapabilityDefinition({ capabilityDefinitionId: created.id, targetState: "Active", actorRole: actor.authorBadge, actorId: actor.authoredBy});
    if (!activate.ok) throw new Error(`[seedCapabilityDefinitions] failed to activate ${seed.code}: ${activate.reason}${activate.detail ? ` (${activate.detail})` : ""}`);

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
