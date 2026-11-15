import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { DEMO_ENGAGEMENT_LOCK_NAMESPACE, DEMO_TENANT_NAME } from "../../../dblayer/constants.js";
import { withAdvisoryLock } from "../../../utils/db.js";
import type { EventHandler } from "../../../domain/engine/eventBus.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

// Records the acting user's engagement Participant in the SEU. The lock makes the check and the create one step, so the handler
// below and the simulator cannot both create the row.
export async function ensureEngagement(seuId: string, participantMasterId: string): Promise<void> {
  await withAdvisoryLock(`${DEMO_ENGAGEMENT_LOCK_NAMESPACE}:${seuId}:${participantMasterId}`, async () => {
    const { data: existing, error } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, participantMasterId);
    if (error) throw error;
    if (existing) return;
    const { data: master, error: masterError } = await participantsMasterDB.findById(participantMasterId);
    if (masterError || !master) throw masterError ?? new Error(`participants_master ${participantMasterId} not found`);
    const { error: createError } = await participantsDB.create({ seuId, type: master.type, displayName: master.display_name, participantId: master.id });
    if (createError) throw createError;
  });
}

// Subscribed to CommissionInitiated. An SEU born in the Demo tenant gets the acting user as its engagement Participant.
export const demoEngagementHandler: EventHandler = async (event: EventRow) => {
  if (!event.seu_id) return;
  const { data: demoTenant, error: tenantError } = await tenantsDB.findByName(DEMO_TENANT_NAME);
  if (tenantError) throw tenantError;
  if (!demoTenant) return;
  const { data: seu, error } = await seusDB.findById(event.seu_id);
  if (error || !seu) throw error ?? new Error(`SEU ${event.seu_id} not found`);
  if (seu.tenant_id !== demoTenant.id) return;
  await ensureEngagement(seu.id, event.actor_id);
};
