# Implementation Traceability: Chapter 18 – Ontology Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/03_Trust Pipeline/18_Ontology.md

## Traceability Table

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology is a shared vocabulary of concepts and meanings, and it is more than a glossary of terms.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-40<br>src/dblayer/ontologyDB.ts:172-198<br>src/routes/seu/core/ontology.ts:308-358</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A concept is a row with type, code, default label, markdown description, version, status, tenant and author. Concepts are created, versioned and governed through addConcept and the Draft to Active lifecycle.<br>Gap:<br>The model holds concepts, labels and definitions. It holds no relationships between concepts and no contextual interpretation, so it is a typed, versioned vocabulary and not yet a relationship-bearing ontology.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants, Deliverables, Knowledge, Evidence, Decisions, Obligations and Packs use the shared vocabulary in the Ontology.<br>Ref: §1, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:35-42<br>src/routes/seu/core/ontology.ts:75-133<br>src/routes/seu/core/participants.ts:113<br>src/routes/seu/core/deliverables.ts:13<br>src/routes/seu/core/knowledge.ts:34<br>src/routes/seu/core/evidence.ts:43<br>src/routes/seu/core/decisions.ts:25<br>src/routes/seu/core/obligations.ts:58-60<br>src/routes/seu/core/packs.ts:146-170</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every listed write path calls assertCanonicalCategory against a concept type, and Pack, Template, Profile, Capability, Service, Policy and Deliverable Definition content is checked field by field through validateOntologyFieldsAgainstSchema. A value that is not an Active concept visible to the tenant is rejected with the allowed list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology is the foundation layer below the Platform, Organisation, Domain and Technology Pack layers.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:10-16<br>src/routes/seu/core/ontology.ts:177-247<br>src/policies/ontologyValuesPresent.ts:11-22<br>src/dblayer/seed/data/transitionDefinitions.json:1667-1726</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Concepts are tenant scoped. A tenant sees the Platform tenant concepts and its own. Pack, Template, Profile and other schemas mark fields x-ontology-composable, and publication is gated on every such value existing as a concept (policy-ontology-values-present).<br>Gap:<br>Layering is Platform tenant plus own tenant only. No Pack layer (Organisation, Domain, Technology, Compliance) is modelled as a distinct Ontology contribution layer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering artefacts reference concepts from the Ontology and not free-form interpretation.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:35-42<br>src/routes/seu/core/ontology.ts:75-133<br>src/routes/seu/core/ontology.ts:237-247</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>References are canonical concept codes, validated on write (categories) and at publish (composable fields). Free text that is not a canonical code is refused.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every concept has a unique semantic identity.<br>Ref: §5 OM-001, §6 FR-18.2, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-10<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:26-27<br>src/dblayer/ontologyDB.ts:172-198</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each row has a database generated UUID primary key. UNIQUE (concept_type, code, tenant_id, version) prevents duplicate identities per tenant and version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concepts are independent of the terminology used to display them.<br>Ref: §5 OM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-10<br>src/dblayer/ontologyDB.ts:261-276<br>src/routes/seu/core/ontology.ts:580-594</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The code is the stable identity. The default label and the tenant alias display label are separate and can change without changing the code. Storage stays canonical (tests assert two tenants see different labels for one code).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple terms can represent the same concept.<br>Ref: §5 OM-003, §7 Terms, §7 Synonyms, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-10<br>src/dblayer/recovery/tenant_concept_aliases_schema_recovery.sql:3-11<br>src/dblayer/ontologyDB.ts:261-296<br>src/routes/seu/core/ontology.ts:580-602<br>tests/ontology-model.test.ts:42-76</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A concept has one default label and each tenant can set one alias display label per concept (UNIQUE tenant_id, concept_type, canonical_code). Aliasing an unknown concept is refused.<br>Gap:<br>Only one alternative term per tenant per concept exists, and aliases are display only. There is no Synonym set (for example Pull Request and Merge Request) and no resolution from an arbitrary term back to a concept.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships between concepts are explicit.<br>Ref: §5 OM-004, §7 Relationships, §9, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>composition_sources on a concept records the source concept of a Specialization (src/dblayer/recovery/ontology_concepts_schema_recovery.sql:20), which is provenance of a compose action only.<br>Gap:<br>No relationship table, type or API exists. The relationships is-a, part-of, depends-on, produces, validates, supersedes, implements, specialises, generalises, derives, fulfils, references and governs cannot be stored or queried.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontologies are composable.<br>Ref: §5 OM-005, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:519-578<br>src/domain/engine/compositionEngine.ts<br>src/routes/seu/web/ontology.ts:204-226<br>tests/ontology-event-lifecycle-table.test.ts:132-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>composeConcept supports Specialization (derived from an Active source through compositionEngine.specialize, with the source recorded in composition_sources) and Override (a new version of the tenant&#x27;s own Active concept). Each result is born Draft and publishes OntologyComposed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Semantic consistency takes precedence over linguistic consistency.<br>Ref: §5 OM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:26-27<br>src/routes/seu/core/ontology.ts:328-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Identity is the code, and a duplicate code in a tenant produces a new version of that concept and not a second concept.<br>Gap:<br>Consistency is checked only by exact code. Two different codes with the same meaning are not detected, so semantic precedence is not enforced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform maintains an Ontology for every commissioned SEU.<br>Ref: §6 FR-18.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:10-16<br>src/routes/seu/core/commissioning.ts:44-77<br>src/actions/validateSeuRequest.ts:14-32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The vocabulary is held per tenant. Commissioning liveness checks that profile capability codes are Active capability-name concepts for the SEU tenant.<br>Gap:<br>No Ontology is established or recorded per SEU. There is no effective Ontology snapshot taken at commissioning, so an SEU does not own an Ontology.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concepts have globally unique identifiers.<br>Ref: §6 FR-18.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>id is UUID PRIMARY KEY DEFAULT gen_random_uuid(), unique across all tenants and versions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Knowledge Item references an Ontology concept.<br>Ref: §6 FR-18.3, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:34-55</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createKnowledgeItem asserts the category is an Active category:knowledge concept and stores it.<br>Gap:<br>The reference is a code string on the item with no foreign key and no concept version. Existing rows are not revalidated when a concept is retired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable category references an Ontology concept.<br>Ref: §6 FR-18.4, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:12-31<br>src/routes/seu/core/ontology.ts:322-324<br>src/routes/seu/core/ontology.ts:75-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createDeliverable asserts the name or category against deliverable-name concepts. Deliverable Definition content is checked through the schema ontology walk. Deliverable names are authored through Deliverable Definitions and not added directly in Ontology Management.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology composition occurs during EBM composition.<br>Ref: §6 FR-18.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:519-578<br>src/policies/ontologyValuesPresent.ts:11-22<br>src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Composition of concepts occurs when a user composes a concept and when authored Pack and Template values are proposed as Draft concepts and gated at publish.<br>Gap:<br>compositionEngine and the EBM composition flow hold no Ontology step. Ontology composition occurs at authoring and publish time and not during EBM composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology conflicts are detected during commissioning.<br>Ref: §6 FR-18.6, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/actions/validateSeuRequest.ts:14-32<br>src/routes/seu/core/commissioning.ts:44-77</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commissioning validation runs reference liveness (a capability code is an Active concept). This detects a missing concept and not a conflict.<br>Gap:<br>No logic detects two concepts or terms in conflict, and none runs at commissioning or at composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology evolution preserves semantic traceability.<br>Ref: §6 FR-18.7, §11, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:360-411<br>src/routes/seu/core/ontology.ts:447-456<br>src/dblayer/ontologyDB.ts:58-82<br>src/dblayer/ontologyDB.ts:314-339<br>src/dblayer/seed/data/transitionDefinitions.json:1667-1726</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A change creates a new version row (patch bump) born Draft. Approval moves the previous Active version to Deprecated through its own transition. Old rows remain with author, badge, status and comments, and each transition publishes an event with the real actor.<br>Gap:<br>Consumers store the concept code only and not the concept version, so the meaning an artefact held when it was written is not reproducible from the artefact alone. No as-of lookup exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concepts exist as an Ontology component with a definition.<br>Ref: §7 Concepts, §7 Definitions</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-10<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:14<br>src/dblayer/ontologyDB.ts:172-198</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>default_label, a markdown or text description (text_type) and a concept_type group each concept. The description is the authoritative definition for that version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraints (semantic rules on valid relationships) are part of the Ontology.<br>Ref: §7 Constraints</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:249-255</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Only a code format rule (lowercase hyphenated) and unique identity are enforced.<br>Gap:<br>No constraint model exists, because there are no relationships to constrain.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Synonyms and Aliases map Organisation specific terminology to the same concept.<br>Ref: §7 Synonyms, §7 Aliases, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:261-296<br>src/routes/seu/core/ontology.ts:580-602<br>src/routes/seu/api/ontology.ts:32-58<br>src/dblayer/seed/data/routeAuthority.json:521-552</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A tenant maps a display label onto a canonical concept code. resolveLabels returns the tenant label for the canonical code, and the API exposes list, set and clear.<br>Gap:<br>Alias is a rename of one concept&#x27;s display. It does not accept several terms per concept or lookup by term. The alias API rows in route_authority have empty badges and roles, and setAlias takes the tenant id from the URL parameter without a tenant scope check against the caller.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform builds an effective Ontology from Platform, Organisation, Domain, Technology and Compliance Pack contributions.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:10-16<br>src/dblayer/ontologyDB.ts:172-198<br>src/routes/seu/core/ontology.ts:135-175<br>src/domain/engine/conceptCreated.ts:16-51<br>src/routes/seu/core/ontology.ts:227-235<br>src/routes/seu/core/sdkAuthoring.ts:713</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Pack and other authored values that are not yet concepts are proposed through ConceptCreated, inserted Draft by the conceptCreated subscriber, and become effective after ontology_approve. Platform and tenant concepts merge in queries.<br>Gap:<br>contributed_by_pack exists but every insert path passes null, so the contributing Pack is not recorded. The Pack layer types are not distinguished.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition preserves semantic consistency.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:519-578<br>src/routes/seu/core/ontology.ts:328-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Override requires an existing Active concept, Specialization requires an Active source, and each result enters Draft for approval.<br>Gap:<br>Approval is a human check. No automatic semantic consistency check runs during composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationship semantics are versioned.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Concept versions exist (C: 360-399) but relationships do not.<br>Gap:<br>There are no relationship definitions, so no relationship semantics are versioned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform resolves terminology differences between Packs so Participants collaborate using concepts.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:580-594<br>src/routes/seu/core/ontology.ts:75-133<br>src/routes/seu/api/ontology.ts:22-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Packs reference canonical codes validated against the tenant vocabulary, and labels resolve per tenant through resolveLabels, so artefacts are stored with concepts.<br>Gap:<br>No mapping from a Pack specific term (Technical Design, Solution Architecture) to a shared concept exists. Resolution is by code and tenant label only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution adds new concepts, revises definitions and deprecates concepts.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:308-358<br>src/routes/seu/core/ontology.ts:360-411<br>src/routes/seu/core/ontology.ts:413-460<br>src/dblayer/seed/data/transitionDefinitions.json:1667-1726</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>addConcept creates a concept. A revised label or description creates a new Draft version. Deprecate, Retire and Archive are governed transition rows with events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evolution adds new relationships and merges concepts.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Neither operation exists in the DB layer, core or routes.<br>Gap:<br>There is no relationship creation and no merge operation. Retire and quick retire only end a concept&#x27;s life.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontologies evolve independently of SEUs.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:11-13<br>src/dblayer/ontologyDB.ts:18-33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Concepts are tenant scoped and not tied to an SEU. A new version does not change any SEU row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical semantic interpretations remain reproducible.<br>Ref: §11, §12, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:58-82<br>src/dblayer/ontologyDB.ts:84-100<br>src/routes/seu/core/ontology.ts:401-411</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every version stays in ontology_concepts, and findConceptByCodeAndVersion and includeInactive listings retrieve any version.<br>Gap:<br>Reproduction needs the version a consumer used, and consumers keep the code only. No date based lookup exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Ontology concept records its version and its status and keeps history.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:29-30<br>src/routes/seu/core/ontology.ts:401-411<br>src/dblayer/seed/data/transitionDefinitions.json:1667-1726</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each row has a version, a status (Draft, Active, Deprecated, Retired, Archived) and a creation time. Historical versions stay available.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Ontology records contributing Packs, semantic changes and compatibility information.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:8<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:19-20<br>src/routes/seu/core/ontology.ts:360-399</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Contributing Pack has a column, the composition strategy and sources are recorded, and each version carries its label and description.<br>Gap:<br>Contributing Pack is never populated. No semantic change summary is recorded apart from the version row and event. No compatibility information is recorded. Versioning is per concept and not per Ontology as a whole.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology changes require governance and never invalidate historical engineering records.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1667-1726<br>src/routes/seu/core/ontology.ts:446-460<br>src/routes/seu/core/ontology.ts:472-500<br>src/dblayer/seed/data/routeAuthority.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>New and revised concepts are born Draft, and approve or reject needs the ontology_approve badge through route_authority. Reject needs a comment (policy-comment-required). Retiring a concept does not alter artefact rows.<br>Gap:<br>Metadata edits (text type, grouping) apply in place with no approval. Semantic, engineering, domain and Pack compatibility reviews are not distinct steps, and the Pack compatibility validation is absent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes ConceptCreated.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:339-353<br>src/domain/engine/conceptCreated.ts:39-50<br>src/routes/seu/core/ontology.ts:158-174<br>src/dblayer/seed/data/eventSubscriptions.json:68<br>tests/ontology-event-lifecycle-table.test.ts:78-90</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Published from the birth row with the real actor and badge, both from Add and Compose, and from proposals by authored schema fields. The subscriber inserts the Draft concept when the payload carries no version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes ConceptUpdated.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:472-500<br>tests/ontology-event-lifecycle-table.test.ts:115-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>updateConceptMeta publishes ConceptUpdated with the actor and badge after the in-place edit.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes ConceptDeprecated.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1677-1686<br>src/routes/seu/core/ontology.ts:413-432<br>src/domain/engine/entityTransition.ts:83-93<br>tests/ontology-event-lifecycle-table.test.ts:192-210</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Active to Deprecated row carries ConceptDeprecated, and publishTransition publishes it. Retire, Archive, Approve and Reject publish their own events as extra rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes OntologyComposed.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:566-575<br>tests/ontology-event-lifecycle-table.test.ts:132-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>composeConcept publishes OntologyComposed with strategy and sources, using the actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes OntologyValidated.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>No code references this event type.<br>Gap:<br>No ontology wide validation runs and no event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology publishes SemanticConflictDetected and SemanticConflictResolved.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>No code references either event type.<br>Gap:<br>Conflict detection and resolution are not built, so neither event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Ontology supports semantic composition, multiple vocabularies, semantic traceability, technology independence and incremental evolution.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:519-578<br>src/dblayer/ontologyDB.ts:261-296<br>src/routes/seu/core/ontology.ts:401-411</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Composition, tenant vocabularies, patch versioning and incremental Draft approval exist. The model sits in plain tables and services with no graph technology.<br>Gap:<br>Semantic traceability is limited as noted for §6 FR-18.7. Multiple vocabularies are single label aliases.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Organisation Packs can contribute terminology without introducing ambiguity.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:135-175<br>src/domain/engine/conceptCreated.ts:27-28<br>src/routes/seu/core/ontology.ts:328-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A contributed value that already exists is skipped, a proposal is deduplicated per originating object, and a new value waits in Draft for approval.<br>Gap:<br>Ambiguity between different codes that mean the same thing is not detected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implementation delivers the Ontology domain model and concept registry.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-40<br>src/dblayer/ontologyDB.ts:18-340<br>src/dblayer/seuTypes.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>ontology_concepts, ontology_concept_comments and tenant_concept_aliases tables plus ontologyDB provide registry reads and writes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implementation delivers a semantic resolution service.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:580-602</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>resolveLabels and resolveLabel map canonical codes to tenant labels.<br>Gap:<br>Resolution runs from code to label only. No term to concept resolution exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implementation delivers an Ontology composition service and versioning service.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:519-578<br>src/routes/seu/core/ontology.ts:360-411<br>src/routes/seu/core/ontology.ts:446-460</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>composeConcept, createConceptVersion, nextAvailableVersion and approveConcept implement composition and versioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implementation delivers Ontology APIs.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/ontology.ts:11-58<br>src/routes/seu/web/ontology.ts:38-314</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The API serves concept lists, tenant vocabulary and aliases. The web layer serves add, compose, deprecate, retire, archive, metadata edit and approvals.<br>Gap:<br>No API exposes concept creation, composition, versioning or approval. Relationship and conflict APIs are absent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implementation delivers the Ontology events.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1667-1726<br>src/dblayer/seed/data/eventSubscriptions.json:43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Four of the seven named events publish, plus ConceptApproved, ConceptRejected, OntologyConceptRetired and OntologyConceptArchived.<br>Gap:<br>OntologyValidated, SemanticConflictDetected and SemanticConflictResolved are missing.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 44
- Fully met: 18
- Partially met: 19
- Not met: 7
- Not verifiable: 0
- Major implementation gaps: no concept relationships, constraints or relationship versioning (OM-004, §7, §9); no multi-term synonyms or term-to-concept resolution; no ontology conflict detection or OntologyValidated, SemanticConflictDetected and SemanticConflictResolved events (FR-18.6, §14); no Ontology step in EBM composition (FR-18.5) and no per-SEU Ontology (FR-18.1); contributing Pack never recorded; consumers store the concept code without the version; the alias API has no badge rows or tenant scope check; Ontology APIs cover reads and aliases only.
