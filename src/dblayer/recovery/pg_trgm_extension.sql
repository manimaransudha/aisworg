-- Run once, before run.ts, as a role allowed to create extensions.
-- objectives_schema_recovery.sql builds a pg_trgm GIN index on objectives.statement.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
