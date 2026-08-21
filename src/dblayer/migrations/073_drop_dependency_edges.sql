-- CR-039 — dependency_edges (the old per-SEU-instance dependency model) is
-- fully replaced by dependency_definitions (migration 072), Template-scoped
-- and name-keyed. Every live caller (commissioning, transitionDeliverable's
-- gate, the SEU detail page, traceability, assignment delivery) has been
-- rewired onto the new engine, and dependencyEdgesDB.ts/dependencyEngine.ts
-- are deleted. No code reads or writes this table anymore.
DROP TABLE IF EXISTS dependency_edges;
