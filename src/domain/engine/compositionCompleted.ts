// design/mvp-build-plan/SEU Composition.md, 2026-09-07 — the CompositionCompleted
// consumer for the conflict-resolution retry path. Owner: "The conflicts if
// resolved emits Composition completed. And composition completes here...
// the handler should call ebmcreate()." Fires from POST .../compose-ebm
// once every composition conflict is resolved (compositionConflicts.length
// === 0 after the recompute) — mirrors ebmComposerHandler's own success
// path exactly (ebmsDB.create -> seusDB.setActiveEbm -> publish EBMCreated),
// just triggered by resolution instead of a conflict-free first pass.
//
// Payload is {seuId} only — composedPacks/compositionReport are read off
// seus.composition_report, already written by the compose-ebm route right
// before this event was published, not recomputed here.
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { eventBus } from "./eventBus.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, EbmCompositionReport, EbmComposedPack } from "../../dblayer/seuTypes.js";

interface CompositionCompletedPayload {
  seuId: string;
}

export const compositionCompletedHandler: EventHandler = async (event: EventRow) => {
  const { seuId } = event.payload as unknown as CompositionCompletedPayload;
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) {
    logger.error(`[compositionCompleted] SEU not found: ${seuId}`);
    return;
  }
  const stashed = seu.composition_report as {
    composedPacks?: EbmComposedPack[];
    compositionReport?: EbmCompositionReport;
    unraveled?: { pool: unknown[] };
    resolvedCompositionConflicts?: Record<string, unknown>;
  } | null;

  // Owner: "the ebm should carry this [the real behavioural content] . that
  // is what drives the behavior. that is the reason why conflicts are
  // resolved." The full flat pool unravelComposition already computed
  // (already persisted here by ebmComposerHandler/the compose-ebm route),
  // plus what every conflict actually resolved to — not recomputed, just
  // carried onto the EBM itself instead of staying stranded in
  // seus.composition_report.
  const behaviors = { pool: stashed?.unraveled?.pool ?? [], resolvedCompositionConflicts: stashed?.resolvedCompositionConflicts ?? {} };

  const { data: ebm, error: ebmErr } = await ebmsDB.create({
    seuId,
    templateId: seu.template_id,
    profileId: seu.profile_id,
    composedPacks: stashed?.composedPacks ?? [],
    compositionReport: stashed?.compositionReport ?? { warnings: [], conflicts: [], parameterConflicts: [], resolutions: [] },
    behaviors,
  });
  if (ebmErr || !ebm) {
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seuId,
      seuId,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      payload: { stage: "compose_ebm", reason: (ebmErr ?? new Error("failed to create EBM")).message },
    });
    return;
  }

  await seusDB.setActiveEbm(seuId, ebm.id);
  await eventBus.publish({
    eventType: "EBMCreated",
    originatingObjectType: "EBM",
    originatingObjectId: ebm.id,
    seuId,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
  });
};
