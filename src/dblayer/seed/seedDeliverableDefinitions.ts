import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { deliverableDefinitionsDB } from "../deliverableDefinitionsDB.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { transitionEntity, publishTransition } from "../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { eventBus } from "../../domain/engine/eventBus.js";
import type { DeliverableDefinitionRow } from "../seuTypes.js";
import { ontologyDB } from "../ontologyDB.js";
import { userDB } from "../userDB.js";
import { getPlatformTenantId, DELIVERABLE_DEFINITION_ACTIVE_STATE, INITIAL_VERSION } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface DeliverableDefinitionSeed {
  code: string;
  description: string;
}

function loadSeeds(): DeliverableDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "deliverableDefinitions.json"), "utf8");
  return JSON.parse(raw) as DeliverableDefinitionSeed[];
}

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export async function seedDeliverableDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();
  const platformTenantId = await getPlatformTenantId();

  const { data: deliverableConcepts, error: deliverableError } = await ontologyDB.findConceptsByType("deliverable-name", { isRoot: false, tenantId: platformTenantId });
  if (deliverableError) throw new Error(`[seedDeliverableDefinitions] failed to load deliverable-name Ontology: ${deliverableError.message}`);
  const deliverableNames = new Set((deliverableConcepts ?? []).map((c) => c.code));
  // A Deliverable Definition's name is the label of its code in the Ontology, loaded once.
  const nameByCode = new Map((deliverableConcepts ?? []).map((c) => [c.code, c.default_label]));
  const invalid = seeds.filter((s) => !deliverableNames.has(s.code));
  if (invalid.length > 0) {
    throw new Error(`[seedDeliverableDefinitions] codes not in Ontology deliverable-name: ${invalid.map((s) => s.code).join(", ")}`);
  }

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("DeliverableDefinition");
  if (birthError) throw birthError;
  if (!birth) throw new Error("[seedDeliverableDefinitions] no birth Transition Definition for DeliverableDefinition -- seed transition definitions first");
  if (!birth.event_type) throw new Error("[seedDeliverableDefinitions] the DeliverableDefinition birth Transition Definition names no event");

  const { data: defs, error: defsError } = await transitionDefinitionsDB.listAll();
  if (defsError) throw defsError;
  const nextByFrom = new Map<string, string[]>();
  for (const d of defs ?? []) {
    if (d.entity_type !== "DeliverableDefinition" || !d.is_active) continue;
    nextByFrom.set(d.from_state, [...(nextByFrom.get(d.from_state) ?? []), d.to_state]);
  }

  const { data: deliverableSchema } = await schemaDefinitionsDB.findLatest("Deliverable");
  if (!deliverableSchema) throw new Error("no schema_definitions grammar for Deliverable -- run the schema-definitions data migration first");

  const { rowCount: deleted } = await query("DELETE FROM deliverable_definitions WHERE tenant_id = $1", [platformTenantId]);
  logger.info(`[seedDeliverableDefinitions] deleted ${deleted ?? 0} platform-tenant deliverable_definitions rows -- creating ${seeds.length} now`);

  for (const { code, description } of seeds) {
    const { data: created, error } = await deliverableDefinitionsDB.createDraft({
      code,
      name: nameByCode.get(code)!,
      description,
      version: INITIAL_VERSION,
      status: birth.to_state as DeliverableDefinitionRow["status"],
      authoredBy: actor.authoredBy,
      authorBadge: actor.authorBadge,
      draftContent: { code, name: nameByCode.get(code)!, description, definitionVersion: INITIAL_VERSION },
      tenantId: platformTenantId,
      parentDeliverableDefinitionId: null,
      schemaDefinitionId: deliverableSchema.id,
    });
    if (error) throw new Error(`[seedDeliverableDefinitions] failed to create Deliverable Definition ${code}: ${error.message}`);
    if (!created) continue;

    await eventBus.publish({
      eventType: birth.event_type,
      originatingObjectType: "DeliverableDefinition",
      originatingObjectId: created.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: actor.authoredBy,
      authorityBadge: actor.authorBadge,
      payload: { code: created.code, version: created.version },
      tenantId: created.tenant_id,
    });

    const visited = new Set<string>([birth.to_state]);
    let state = birth.to_state;
    while (state !== DELIVERABLE_DEFINITION_ACTIVE_STATE) {
      const hops = (nextByFrom.get(state) ?? []).filter((to) => !visited.has(to));
      if (hops.length !== 1) throw new Error(`[seedDeliverableDefinitions] expected one forward DeliverableDefinition hop out of ${state}, found ${hops.length}`);
      const result = await transitionEntity({ entityType: "DeliverableDefinition", entityId: created.id, targetState: hops[0], actorId: actor.authoredBy });
      if (!result.ok) throw new Error(`[seedDeliverableDefinitions] failed to move Deliverable ${code} to ${hops[0]}: ${"detail" in result ? result.detail : result.reason}`);
      await publishTransition(result);
      visited.add(hops[0]);
      state = hops[0];
    }
  }
  logger.info(`[seedDeliverableDefinitions] created + activated ${seeds.length} Deliverable Definitions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  seedDeliverableDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedDeliverableDefinitions] failed", err as Error);
      process.exit(1);
    });
}
