import { seusDB } from "../../dblayer/seusDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { finalizeCommissioning } from "../../routes/seu/core/commissioning.js";
import { eventBus } from "./eventBus.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

async function failCommissioning(seuId: string, event: EventRow, reason: string): Promise<void> {
  logger.error(`[ebmActivated] finalizeCommissioning failed for SEU ${seuId}: ${reason}`);
  await seusDB.updateLifecycleState(seuId, "Failed");
  await eventBus.publish({
    eventType: "CommissionFailed",
    originatingObjectType: "SEU",
    originatingObjectId: seuId,
    seuId,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
    payload: { stage: "finalize_commissioning", reason },
  });
}

export const ebmActivatedHandler: EventHandler = async (event: EventRow) => {
  const ebmId = event.originating_object_id;
  const { data: ebm } = await ebmsDB.findById(ebmId);
  if (!ebm) {
    logger.error(`[ebmActivated] EBM not found: ${ebmId}`);
    return;
  }
  const { data: seu } = await seusDB.findById(ebm.seu_id);
  if (!seu) {
    logger.error(`[ebmActivated] owning SEU not found for EBM ${ebmId}`);
    return;
  }
  const { data: template } = await templatesDB.findById(ebm.template_id);
  const { data: profile } = await profilesDB.findById(ebm.profile_id);
  if (!template || !profile) {
    await failCommissioning(seu.id, event, "Template/Profile referenced by this EBM not found");
    return;
  }

  let finalizeResult: Awaited<ReturnType<typeof finalizeCommissioning>>;
  try {
    finalizeResult = await finalizeCommissioning({
      seu,
      ebm,
      templates: [template],
      profiles: [profile],
      tenantId: seu.tenant_id,
      actorRole: "system",
      actorId: event.actor_id ?? undefined,
      correlationId: event.correlation_id,
      causationId: event.id,
    });
  } catch (err) {
    await failCommissioning(seu.id, event, (err as Error).message);
    return;
  }
  if (!finalizeResult.ok) {
    await failCommissioning(seu.id, event, finalizeResult.reason);
  }
};
