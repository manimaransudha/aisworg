// CR-116 — generic supersession validation, reused by every entity whose
// transition set includes a "Superseded" target (Objective today; Pack/
// Template/etc. later, per the same pattern). Deliberately validation-only:
// it never writes superseding_<x>_id itself and never publishes anything —
// each entity's own transitionX core function (e.g. transitionObjective)
// calls this inline, in the exact spot Reject's own mandatory-comment check
// already sits, then does the write and the eventBus.publish itself.
//
// NOT an event subscriber (CLAUDE.md's own event-subscriber rule): the
// effect here (recording who superseded whom) lands on the same row that is
// transitioning, not a different entity_type, so it is single-entity,
// definition-only wiring — never a HANDLER_REGISTRY/event_subscriptions case.
export type SupersessionCheckResult =
  | { ok: true; supersedingId: string; comment: string }
  | { ok: false; reason: "superseding_target_required"; detail: string }
  | { ok: false; reason: "superseding_target_not_found"; detail: string }
  | { ok: false; reason: "comment_required"; detail: string };

export const supersessionEngine = {
  // Call only when the transition's own targetState is the entity's
  // "Superseded" state — a caller for any other target never calls this.
  async check(input: {
    // The entity being superseded (A) — included for symmetry/logging even
    // though this check doesn't use it directly; every real caller already
    // has it in scope.
    supersededId: string;
    supersedingId: string | undefined;
    comment: string | undefined;
    actorId: string;
    authorityBadge: string;
    // Looks up the candidate (B or C) by id, scoped however the caller's own
    // entity requires (e.g. objectivesDB.findById) — this engine has no
    // knowledge of any one entity's own table.
    findCandidate: (id: string) => Promise<{ id: string } | null | undefined>;
  }): Promise<SupersessionCheckResult> {
    if (!input.supersedingId) {
      return { ok: false, reason: "superseding_target_required", detail: "Supersede requires the superseding entity's id." };
    }
    const candidate = await input.findCandidate(input.supersedingId);
    if (!candidate) {
      return { ok: false, reason: "superseding_target_not_found", detail: `superseding entity not found: ${input.supersedingId}` };
    }
    // Comment is mandatory whenever a superseding id is supplied (owner:
    // "make it mandatory when supersession id exists") — stricter than a
    // normal transition's optional comment, same enforcement point as
    // Reject's own mandatory-new-comment rule.
    const trimmed = input.comment?.trim() ?? "";
    if (!trimmed) {
      return { ok: false, reason: "comment_required", detail: "Supersede requires a comment explaining the supersession." };
    }
    return { ok: true, supersedingId: candidate.id, comment: trimmed };
  },
};
