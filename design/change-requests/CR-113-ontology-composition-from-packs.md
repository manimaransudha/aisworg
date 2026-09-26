# CR-113 — Schema implementation Gaps

**Raised:** 2026-09-25 · **Origin:** OntologyComposition now does not have a consumer. This has to be enabled. 

**Status:** 🟡 Built pending testing.

# Requirement 

1. Values from schema to ontology are introduced by marking the fields as x-ontology-composable. ✅
2. The following fields have to be marked x-ontology-composable / enabled for Ontology Composition:
- Pack.code ✅
- Profile.environment ✅
- Policy.applicabilityEnvironments ✅
- Pack.Category ✅
- Template.Category ✅
- Dependency types (Template dependencyGraph[].relationshipKind — not Ontology-backed, a plain fixed enum; needs a bigger design change before "composable" applies)
- Deliverable categories (no `category` field exists on Template deliverableCatalogue[] — dropped in migration 164; deliverableCatalogue[].code, the only Ontology-backed field there, is ✅ below)
- Knowledge categories
- Evidence categories
- Decision categories
- Relationship types (traceability)
- Obligation categories ✅
- Engineering Capital Type ✅
- Policy categories ✅
- Review categories
- Quality Gate categories ✅
- Event categories
- Attention categories
- Interaction categories

The ones from the above list coming from schema are marked x-ontology-composable. The rest will get the ConceptCreated Event from the "Add item" in Ontology Management. 

3. Whatever is x-ontology-composable will be gated at publish time.
- Pack.code ✅
- Profile.environment ✅
- Policy.applicabilityEnvironments ✅
- Pack.Category ✅
- Template.Category ✅
- Policy categories ✅
- Obligation categories (Pack contributionObligationDefinitions[].category) ✅
- Engineering Capital Type (Pack contributionEngineeringCapital[].type) ✅
- Quality Gate categories (Pack contributionQualityGates[].category) ✅
- Template deliverableCatalogue[].code ✅

4. In Ontology Management, under each of the group/tab, there is a  Add/Save. If saving something that is already existing, current behavior continues; publish ConceptUpdated event. If there is a new addition, publish event ConceptCreated and update status to "Draft". ontology_concepts_status_check has to be updated to include "Draft". The event payload will capture all the information. 

5. When event ConceptCreated is published from the x-ontology-composable fields, it should include the required information. ✅

6. Add an event consumer for ConceptCreated. Any participant with badge ontology_approve should see these requests. Approving will send them to the "Active" state. Rejecting will keep it in the draft state. 