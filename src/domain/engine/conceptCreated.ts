import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

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

  const { error } = await ontologyDB.insertConceptVersion({
    conceptType, code, tenantId, version: "1.0.0", defaultLabel: code, status: "Draft",
    authorId: event.actor_id, authorBadge: event.authority_badge,
  });
  if (error) logger.error(`[conceptCreated] failed to insert Draft concept ${conceptType}/${code} (tenant ${tenantId})`, error);
};
