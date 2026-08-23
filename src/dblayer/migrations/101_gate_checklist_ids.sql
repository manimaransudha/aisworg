-- CR-060 — Review Gate and Quality Gate both gain checklist_ids: an array
-- of real checklists(id) values, not a single FK (owner: "A review and
-- quality gate can have multiple checklist ids"). Semantics: AND within one
-- gate's own list (owner: "Every quality gate is defined by category and
-- that is an AND" — every listed Checklist must complete); if the same
-- checklist id appears on more than one gate, it is executed once and
-- satisfies all of them (owner: "If gates point to same checklist, it is
-- taken once") — a dedup concern for whatever builds execution later, not
-- expressed as a DB constraint here.
--
-- No FK constraint on the array elements (Postgres has no native array FK)
-- — validatePackSeed checks each id resolves to a real checklists row at
-- publish time, the same discipline requires_accepted_review's own
-- deliverableName->reviewGateId resolution already uses.
ALTER TABLE quality_gates ADD COLUMN IF NOT EXISTS checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE review_gates ADD COLUMN IF NOT EXISTS checklist_ids UUID[] NOT NULL DEFAULT '{}';
