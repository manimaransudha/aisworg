-- design/mvp-build-plan/SEU Composition.md, 2026-09-07 — "ebmComposerHandler
-- should display this page" (owner): this column holds Compose EBM's own
-- real output (unravelComposition/detectCompositionConflicts's result),
-- written by ebmComposerHandler and by "Apply & re-validate" (same
-- computation, run early) — never Validate Request's own output
-- (checkRequestLiveness). Named composition_report, matching ebms'
-- own composition_report at the SEU level, not "validation" — owner:
-- "why are you using the word validate and compose in the same sense?
-- Have i not told you multiple times they are not the same." (Corrects
-- this migration's own first pass, applied under the wrong name
-- validation_report and dropped here rather than left in place.)
ALTER TABLE seus DROP COLUMN IF EXISTS validation_report;
ALTER TABLE seus ADD COLUMN IF NOT EXISTS composition_report JSONB;
