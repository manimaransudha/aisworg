# CR-111 — Capability Registry

**Raised:** 2026-09-22 · **Origin:** Capability in the current implementation remains as an Ontology. src/dblayer/migrations/046_capability_name_ontology.sql. Expand this to include capability roles and role work types. This is required to expand capability fulfillment feature later. 

**Status:** 🟡 Raised — Designed

## Design

1. Add role codes to Ontology - src/dblayer/migrations/263_capability_role_ontology.sql
2. Add worktype codes to Ontology - src/dblayer/migrations/264_worktypes_code_ontology.sql
3. Create a new table capability_definitions and migrate 265 to populate this table. 
4. Create a new "Capability Registry" under the Registry page. (Dont forget route_authority) to list the capability definitions. Role: general
5. Create a CRUD for capability definitions under SDK/Authoring. Role:


