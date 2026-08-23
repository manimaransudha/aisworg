-- CR-060, revised same day — Mandatory/Recommended moved off Checklist Item
-- entirely (owner: "you cannot determine a checklist item to be mandatory.
-- Checklist is generic. Pack has the specifics.") onto the referencing
-- gate: checklist_ids (migration 101) is now specifically the REQUIRED
-- (AND) set; recommended_checklist_ids is the advisory set — completing
-- them doesn't block the gate, the same "doesn't by itself determine the
-- outcome" role Ch.47's own Recommended designation always had, relocated
-- from item to reference.
ALTER TABLE quality_gates ADD COLUMN IF NOT EXISTS recommended_checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE review_gates ADD COLUMN IF NOT EXISTS recommended_checklist_ids UUID[] NOT NULL DEFAULT '{}';
