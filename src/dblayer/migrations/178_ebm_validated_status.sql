-- Add the 'Validated' EbmStatus value — Chapter 8's own separately-named
-- "Validate Engineering Model" workflow step (§8), currently folded into
-- composition with no distinct status (Chapter 8 §22.6's own audit finding:
-- "Validate Engineering Model — folded into composition — only a
-- conflict-count check, no separate 'model validation'").
--
-- Composed -> Validated (a human confirms the composed EBM; EBMValidated) ->
-- Active (a separate, later human action; EBMActivated) -> Superseded.
-- Validated and Active are two independently human-triggered transitions,
-- not a cascade (design/mvp-build-plan/SEU Composition.md, owner: "I can
-- validate an EBM and not yet activate it — I can have a project plan ready
-- but not yet start it"). An EBM may sit at Validated indefinitely with no
-- effect on its owning SEU.
ALTER TABLE ebms DROP CONSTRAINT IF EXISTS ebms_status_check;
ALTER TABLE ebms ADD CONSTRAINT ebms_status_check
  CHECK (status IN ('Composed', 'Validated', 'Active', 'Superseded'));
