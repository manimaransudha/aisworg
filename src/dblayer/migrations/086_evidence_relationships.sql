-- CR-051 item 1 (Ch.17 §20.2/§20.8) — Evidence multi-relationship support.
-- `evidence.related_object_type`/`related_object_id` was a single polymorphic
-- pointer — one Evidence row could only ever name one related object,
-- contradicting the chapter's own "one Evidence Item may support many
-- engineering artefacts" and the owner's own worked example (the same test
-- results supporting Source Code, a Deployment Readiness review, and a
-- Compliance obligation, simultaneously). Settled direction (owner): two
-- separate persistent entities, linked by reference — Evidence stays its
-- own top-level entity; the fix is the relationship mechanism.
--
-- Confirmed side effect: this also enables cross-SEU sharing (CR-051 item
-- 2) for free — findByRelatedObject never filtered by matching seu_id, and
-- still doesn't; an Evidence row's own origin SEU and the SEUs of whatever
-- it's linked to are already independent dimensions.
CREATE TABLE IF NOT EXISTS evidence_relationships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id           UUID NOT NULL REFERENCES evidence(id),
  related_object_type   TEXT NOT NULL,
  related_object_id     UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_relationships_unique UNIQUE (evidence_id, related_object_type, related_object_id)
);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_evidence ON evidence_relationships (evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_related ON evidence_relationships (related_object_type, related_object_id);

-- Backfill: every existing Evidence row's own single relationship becomes
-- its first row here — no data lost.
INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id)
SELECT id, related_object_type, related_object_id FROM evidence
ON CONFLICT (evidence_id, related_object_type, related_object_id) DO NOTHING;

ALTER TABLE evidence DROP COLUMN IF EXISTS related_object_type;
ALTER TABLE evidence DROP COLUMN IF EXISTS related_object_id;
