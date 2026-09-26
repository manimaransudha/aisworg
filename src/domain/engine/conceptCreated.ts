// CR-113 item 6 — ConceptCreated's own cross-entity consumer. Real subscriber
// territory (CLAUDE.md's event-subscriber rule): the x-ontology-composable
// schema-field path (core/ontology.ts's emitConceptCreated — Pack.code,
// Profile.environment, etc.) originates from Pack/Profile/Policy/Template but
// only ever publishes the event; unlike Ontology Management's own "Add item"
// (addConcept), it never inserts the Draft ontology_concepts row itself —
// nothing for an ontology_approve holder's Approvals tab to show. This
// handler is that missing insert, landing on a different entity_type
// (Ontology) than the one that published the event.
//
// addConcept's own ConceptCreated (row already inserted, payload carries
// `version`) is a no-op here — same event, already-done effect.
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
  if (version) return; // addConcept's own path — the row already exists.
  if (!code || !conceptType || !tenantId) {
    logger.error(`[conceptCreated] malformed payload on event ${event.id}: missing code/conceptType/tenantId`);
    return;
  }
  const { data: existing } = await ontologyDB.findLatestVersion(conceptType, code, tenantId);
  if (existing) return; // already inserted (a retried/duplicate event) or has since become a real concept.

  // No defaultLabel is carried on this payload (the composable field IS the
  // code, no separate label was ever entered) — the code doubles as its own
  // label, same as every other composable field's own form has no distinct
  // label input.
  const { error } = await ontologyDB.insertConceptVersion({
    conceptType, code, tenantId, version: "1.0.0", defaultLabel: code, status: "Draft",
  });
  if (error) logger.error(`[conceptCreated] failed to insert Draft concept ${conceptType}/${code} (tenant ${tenantId})`, error);
};
