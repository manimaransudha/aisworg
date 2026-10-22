import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { eventBus } from "./eventBus.js";
import { transitionEngine } from "./transitionEngine.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, OntologyConceptRow } from "../../dblayer/seuTypes.js";
import { INITIAL_VERSION } from "../../dblayer/constants.js";

interface ConceptCreatedPayload {
  code: string;
  conceptType: string;
  tenantId: string;
  version?: string;
}

export const conceptCreatedHandler: EventHandler = async (event: EventRow) => {
  const { code, conceptType, tenantId, version } = event.payload as unknown as ConceptCreatedPayload;
  if (version) return;
  if (!code || !conceptType || !tenantId) {
    logger.error(`[conceptCreated] malformed payload on event ${event.id}: missing code/conceptType/tenantId`);
    return;
  }
  if (!event.actor_id || !event.authority_badge) {
    logger.error(`[conceptCreated] event ${event.id} has no actor_id/authority_badge — cannot author the Draft concept insert`);
    return;
  }
  const { data: existing } = await ontologyDB.findLatestVersion(conceptType, code, tenantId);
  if (existing) return;

  const birth = await transitionEngine.beginBirth({ entityType: "Ontology", actorId: event.actor_id });
  const { data: created, error } = await ontologyDB.insertConceptVersion({
    conceptType, code, tenantId, version: INITIAL_VERSION, defaultLabel: code, status: birth.initialState as OntologyConceptRow["status"],
    authorId: event.actor_id, authorBadge: event.authority_badge,
  });
  if (error || !created) {
    logger.error(`[conceptCreated] failed to insert Draft concept ${conceptType}/${code} (tenant ${tenantId})`, error ?? undefined);
    return;
  }
  await eventBus.publish({
    eventType: birth.eventType,
    versionEvent: birth.versionEvent,
    originatingObjectType: "Ontology",
    originatingObjectId: created.id,
    seuId: null,
    correlationId: event.correlation_id,
    causationId: event.id,
    payload: { conceptType, code, version: INITIAL_VERSION, tenantId },
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
  });
};
