-- design/mvp-build-plan/SEU Composition.md, 2026-09-07 — Chapter 3 §15's own
-- EBMRetired event, finally given a real status to land in. Owner: "There is
-- a possibility that packs, profiles etc could have been retired. So when
-- EBMValidation happens, do a checkliveness. If it is all still valid, then
-- EBMValidation is emitted. If not, emit EBMRetired." — a Validate attempt
-- against an EBM whose own Template/Profile/composed Packs are no longer all
-- live sets this instead of ever reaching Validated.
ALTER TABLE ebms DROP CONSTRAINT IF EXISTS ebms_status_check;
ALTER TABLE ebms ADD CONSTRAINT ebms_status_check
  CHECK (status IN ('Composed', 'Validated', 'Active', 'Superseded', 'Retired'));
