export type SupersessionCheckResult =
  | { ok: true; supersedingId: string; comment: string }
  | { ok: false; reason: "superseding_target_required"; detail: string }
  | { ok: false; reason: "superseding_target_not_found"; detail: string }
  | { ok: false; reason: "comment_required"; detail: string };

export const supersessionEngine = {
  async check(input: {
    supersededId: string;
    supersedingId: string | undefined;
    comment: string | undefined;
    actorId: string;
    authorityBadge: string;
    findCandidate: (id: string) => Promise<{ id: string } | null | undefined>;
  }): Promise<SupersessionCheckResult> {
    if (!input.supersedingId) {
      return { ok: false, reason: "superseding_target_required", detail: "Supersede requires the superseding entity's id." };
    }
    const candidate = await input.findCandidate(input.supersedingId);
    if (!candidate) {
      return { ok: false, reason: "superseding_target_not_found", detail: `superseding entity not found: ${input.supersedingId}` };
    }
    const trimmed = input.comment?.trim() ?? "";
    if (!trimmed) {
      return { ok: false, reason: "comment_required", detail: "Supersede requires a comment explaining the supersession." };
    }
    return { ok: true, supersedingId: candidate.id, comment: trimmed };
  },
};
