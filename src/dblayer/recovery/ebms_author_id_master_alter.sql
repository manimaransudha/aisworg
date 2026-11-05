-- ebms.author_id references participants_master(id) (the acting user), not participants(id) (a per-SEU Participant row).
-- Run once against the live database. Existing rows hold Participant ids; they are mapped to the master id first.
BEGIN;
ALTER TABLE ebms DROP CONSTRAINT IF EXISTS ebms_author_id_fkey;
UPDATE ebms SET author_id = p.participant_id FROM participants p WHERE p.id = ebms.author_id AND p.participant_id IS NOT NULL;
ALTER TABLE ebms ADD CONSTRAINT ebms_author_id_fkey FOREIGN KEY (author_id) REFERENCES participants_master(id);
COMMIT;
