# CR-115 — Schema meta data / registry 

**Raised:** 2026-09-26 · **Origin:** Fix Schema definition lifecycle to align to Chapter 39

**Status:** 🟡 Raised — design in progress

# Fix the following:

- schema_definitions table structure should be updated to capture lifecycle state, author_id, author_badge
- Create/wire a new transition_definitions row for SDK Element as per Chapter 39 specification

The full pipeline is built. Summary:

- Migration: 281_schema_definition_lifecycle_state.sql: schema_definitions gets lifecycle_state (Created→Validated→Tested→Packaged→Published, or →PublicationRejected), author_id, author_badge; wires the 5 transition_definitions rows (3 governed/auto, 2 manual/badge-gated); adds the noun_verb mappings and route_authority rows for the two new routes.
- Seed data: added the same rows to transitionDefinitions.json and authorityVocabulary.json so they survive db:clean-slate (these are the real source of truth, not the migration insert).
- Types: SchemaDefinition added to TransitionEntityType; SchemaDefinitionRow carries the new fields.
- DB layer: schemaDefinitionsDB.create takes authorId; new advanceLifecycle.
- Core (schemaRegistry.ts): createSchemaVersion now auto-advances a new row Created→Packaged via transitionEngine.evaluate + event publish per hop (same pattern as commissioning.ts's SEU chain); new publishSchemaVersion/rejectSchemaVersion do the one real manual Packaged→Published/Rejected decision.
- Web/views: new POST .../:id/publish and .../:id/reject routes; detail and list views show lifecycle state, with Publish/Reject buttons appearing only on a Packaged row.
- Chapter 39: added an Implementation Notes section (§19) documenting this mapping, per the "append-only, implementation-section-only" rule.

