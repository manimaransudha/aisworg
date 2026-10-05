# Chapter 18 – Ontology Model: Implementation Traceability

**Date of report: 4-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology is the shared semantic vocabulary for Participants, Deliverables, Knowledge, Evidence, Decisions, Packs<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:58<br>src/routes/seu/core/evidence.ts:73<br>src/routes/seu/core/decisions.ts:27<br>src/routes/seu/core/knowledge.ts:28<br>src/routes/seu/core/obligations.ts:29<br>src/routes/seu/core/profiles.ts:151<br>src/routes/seu/core/templates.ts:216<br>src/routes/seu/core/packs.ts (9 call sites)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>assertCanonicalCategory</code> gates a governed string field on each of these entities against <code>ontology_concepts</code>. Each entity references exactly one concept per governed field, not a general relationship model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology defines concepts, relationships, meanings, contextual interpretations (not merely a glossary)<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:1-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>concept_type/code/default_label/description</code> are real and populated. No relationship or "contextual interpretation" construct exists anywhere in the schema or code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-001 every concept has unique semantic identity<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:26-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>UNIQUE(concept_type, code, tenant_id, version)</code>, DB-enforced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-002 concepts independent of terminology<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:81-91, 948-963</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Canonical <code>code</code> is the stored/validated identity everywhere; <code>default_label</code>, <code>description</code>, tenant alias are presentation only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-003 multiple terms may represent the same concept<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:966-980<br>src/dblayer/ontologyDB.ts (tenant_concept_aliases)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A tenant may set exactly one <code>display_label</code> per <code>(tenant_id, concept_type, canonical_code)</code> — a rename, not several simultaneously-valid synonyms in one scope as §7's "Pull Request"/"Merge Request" example describes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-004 concept relationships shall be explicit<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No table, column, or function links one <code>ontology_concepts</code> row to another, confirmed by direct search (<code>contributed_by_pack</code>, <code>composition_sources</code> link a concept to a *source concept or Pack*, not concept-to-concept semantic relationships like is-a/depends-on).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-005 ontologies shall be composable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:881-943<br>src/routes/seu/web/ontology.ts:286-304</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>composeConcept</code> (Specialization/Override via <code>domain/engine/compositionEngine.ts</code>) composes one concept version from another concept version, with a working UI action. This is concept-level composition, not the chapter's own §8 "effective Ontology composed from Platform/Organisation/Domain/Technology/Compliance Packs" — <code>contributed_by_pack</code> remains unset by every caller including this one (confirmed: no call site passes a non-null value).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">OM-006 semantic consistency over linguistic consistency<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:81-91</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Canonical-code-over-label discipline holds everywhere checked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.1 the platform shall maintain an Ontology for every commissioned SEU<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>seu_id</code> column exists on <code>ontology_concepts</code>; nothing on <code>seus</code>/<code>seusDB.ts</code> references an Ontology instance. Every SEU under a tenant shares that tenant's (plus Platform's) vocabulary; nothing is snapshotted per commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.2 concepts shall possess globally unique identifiers<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:3-4,26-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">UUID PK plus <code>(concept_type, code, tenant_id, version)</code> unique constraint.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.3 every Knowledge Item shall reference one or more Ontology concepts<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exactly one governed <code>category</code> string per Knowledge Item, write-path validated — not an array of concept references.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.4 every Deliverable category shall reference Ontology concepts<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:58</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same shape as FR-18.3: one validated <code>category</code> string, not a reference array.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.5 Ontology composition shall occur during EBM composition<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No mechanism ties Ontology composition to EBM/Pack composition. <code>compositionEngine.compose()</code> composes whole Packs; <code>composeConcept</code> (new) is a standalone concept-to-concept action invoked directly by a user, not triggered during EBM composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.6 Ontology conflicts shall be detected during commissioning<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts (<code>detectGovernanceConflicts</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">That function checks authority-role and Quality-Gate-category disagreements across composed Packs — a governance concern, confirmed distinct from an Ontology/semantic-conflict check. No code anywhere inspects <code>ontology_concepts</code> for conflicts during commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-18.7 Ontology evolution shall preserve semantic traceability<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17,26-27<br>src/routes/seu/core/ontology.ts:633-712</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version</code>/<code>status</code> columns plus <code>nextAvailableVersion</code>/<code>transitionConcept</code> now give each edit a new, numbered row (old row stays readable, status moves through Draft→Active→Deprecated→Retired→Archived) — a real improvement over §18.7's "no version column" finding. Still no "effective Ontology" snapshot per se, and <code>updateConceptMeta</code>'s in-place edit of ui_grouping/text_type has no version bump or history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concepts (fundamental engineering ideas)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts (findConcept, upsertConcept family)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">25 live <code>concept_type</code> values confirmed in <code>ontologyConcepts.json</code>/seed, each <code>code</code>-addressable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Terms (human-readable labels, multiple terms per concept)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:948-963</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>default_label</code> plus a tenant's one alias label. No mechanism for *multiple simultaneous* terms per concept in the same scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions (authoritative descriptions independent of terminology)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts (<code>description</code> column)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Populated with real per-code guidance text in seed data; closer to a usage note than a full authoritative definition, but genuine content, not empty.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Relationships (is-a, part-of, depends-on, produces, validates, supersedes, implements)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No concept-to-concept relationship construct exists. <code>dependency_definitions</code> (Ch.15) links Deliverables/Templates/Packs to each other, never Ontology concepts to each other.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraints (semantic rules governing valid relationships)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No such construct exists; relationships themselves do not exist (see OM-004).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Synonyms (alternative names for the same concept, e.g. Pull Request / Merge Request)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No backing: a tenant may hold only one <code>display_label</code> per concept, never several simultaneously-valid names in one scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Aliases (organisation-specific terminology resolving to a common concept)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:966-980<br>src/dblayer/ontologyDB.ts (tenant_concept_aliases)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real and tested (<code>tests/ontology-model.test.ts:42-85</code>): a tenant sets its own alias directly via API; storage stays canonical and cross-tenant-joinable. Mechanism differs from the chapter's own framing (a Pack contributing the alias) — it is tenant-set, not Pack-authored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall construct an effective Ontology by composing Pack contributions (Platform/Organisation/Domain/Technology/Compliance Packs)<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts:263,268 (<code>contributedByPack</code> parameter)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The column and parameter exist end-to-end, but every call site (<code>addConcept</code>, <code>composeConcept</code>, <code>syncConceptFromEntity</code>) passes <code>contributedByPack: null</code> or omits it; confirmed zero callers ever supply a non-null value. No Pack-to-Ontology composition function exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology relationships shall possess explicit, versioned meaning (specialises, generalises, derives, validates, implements, fulfils, references, governs)<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No relationship construct exists at all (see OM-004); nothing to version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall resolve terminology differences between Packs (e.g. "Technical Design" / "Solution Architecture" → one concept)<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:948-963<br>src/routes/seu/api/ontology.ts (<code>GET /tenants/:id/vocabulary</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>resolveLabels</code>/<code>resolveLabel</code> implement exactly this resolution, and are tested. But they are wired into exactly one API endpoint; no web view or other API response in the product calls them — a tenant-facing client must call the vocabulary endpoint itself for resolution to actually happen anywhere.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontologies evolve independently of SEUs (new/revised/deprecated/merged concepts); historical semantic interpretations remain reproducible<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:633-741 (transitionConcept, deprecateConcept, retireConcept, archiveConcept)<br>src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17,30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New concepts, deprecation, retirement, and archival are all real, governed, badge-gated transitions, each publishing a real event. "Merged concepts" has no backing — no merge operation exists. Old rows remain queryable by version, giving genuine (if partial) reproducibility, unlike §18.7's "no history at all" finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Ontology records version, contributing Packs, semantic changes, deprecated concepts, compatibility information; historical Ontologies remain available<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17,26-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version</code>/<code>status</code> exist and are real per-concept. "Contributing Packs" is the permanently-null <code>contributed_by_pack</code> (see §8 finding). No "Ontology" object exists as its own versioned snapshot — only the per-concept version/status columns; "compatibility information" has no backing at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology changes shall require governance (semantic/engineering/domain review, Pack compatibility validation); changes shall never invalidate historical records<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:652-712 (transitionConcept via transitionEngine.evaluate)<br>src/routes/seu/web/ontology.ts:345-400 (Approvals tab)<br>src/dblayer/seed/data/transitionDefinitions.json:1333-1350</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A real Draft→Active governed approval step exists (CR-113 item 6): any concept-creating action can land in Draft, an <code>ontology_approve</code> badge holder approves or rejects (reject requires new, non-duplicate written feedback) via a dedicated Approvals UI. This is one real review gate, not the chapter's multi-discipline (semantic/engineering/domain/Pack-compatibility) review — those remain unbacked. <code>code</code> is never rewritten in place by any code path, so historical records stay valid, though this is an absence of a rename mechanism rather than a deliberate safeguard.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ontology subsystem shall publish ConceptCreated, ConceptUpdated, ConceptDeprecated, OntologyComposed, OntologyValidated, SemanticConflictDetected, SemanticConflictResolved<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:256-262 (ConceptCreated)<br>:605-613 (ConceptCreated/ConceptUpdated)<br>:618-626 (ConceptDeprecated)<br>:700-709 (ConceptDeprecated/OntologyConceptRetired/OntologyConceptArchived/ConceptApproved/ConceptRejected, via <code>gate.eventType</code>)<br>:804-813 (ConceptUpdated)<br>:861-870 (OntologyConceptRetired)<br>:931-940 (OntologyComposed)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">4 of the 7 named events are real and wired: <code>ConceptCreated</code>, <code>ConceptUpdated</code>, <code>ConceptDeprecated</code>, <code>OntologyComposed</code>. <code>OntologyValidated</code>, <code>SemanticConflictDetected</code>, <code>SemanticConflictResolved</code> have zero matches anywhere — no validation or conflict-detection mechanism exists to raise them (see FR-18.6). Two additional, chapter-unnamed events are also published (<code>OntologyConceptRetired</code>, <code>OntologyConceptArchived</code>, <code>ConceptApproved</code>, <code>ConceptRejected</code>) covering lifecycle hops the chapter's own §14 list omits.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support semantic composition<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:881-943</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concept-to-concept composition (Specialization/Override) is real. Pack-to-Ontology composition (§8) is not.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support multiple vocabularies<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">25 live concept types, tenant-scoped aliasing on top.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve semantic traceability<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>version</code>/<code>status</code> give per-concept history; no cross-concept or Pack-contribution traceability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of implementation technologies<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Plain relational table, no graph-DB dependency, matching §2's explicit exclusion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support incremental evolution<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1306-1350</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New concept types/codes added freely via seed data; the Draft→Active→Deprecated→Retired→Archived lifecycle is real incremental evolution at the per-concept level. Ontology-as-a-whole versioned evolution (§12) is not supported.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: every concept possesses a unique semantic identity<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:26-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DB-enforced unique constraint.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: multiple terminologies can map to the same concept<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:966-980</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tenant rename only, one label per tenant per concept — not the chapter's general synonym model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: semantic conflicts are detected during composition<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No mechanism exists (see FR-18.6).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Ontology evolution preserves historical meaning<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:633-712</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Version/status history is now real per-concept (improved over the chapter's own §18.7 finding), though there is still no "Ontology" object with its own versioned snapshot.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Deliverables, Knowledge, Evidence reference Ontology concepts<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:58<br>src/routes/seu/core/evidence.ts:73<br>src/routes/seu/core/knowledge.ts:28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One governed category string each, write-path validated — not a concept-relationship model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Organisation Packs can contribute terminology without introducing ambiguity<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:966-980</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The user-facing outcome (an organisation sees its own word) is real via tenant aliasing. The mechanism the chapter names (a Pack contributing the alias) is not built — aliasing is a direct tenant API action, no Pack authoring step involved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Ontology domain model<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql<br>src/dblayer/seuTypes.ts:1364</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ontology_concepts</code> plus <code>tenant_concept_aliases</code>, with version/status/composition columns.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Concept registry<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ontologyDB.ts<br>src/routes/seu/core/ontology.ts<br>views/seu/sdk/ontology/index.ejs, metadata.ejs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Full CRUD plus a dedicated Metadata admin page.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Semantic resolution service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:948-963<br>src/routes/seu/api/ontology.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real and tested, but wired into exactly one API endpoint — an available service, not yet a used one, inside the product's own web views.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Ontology composition service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts:881-943</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real at the concept-to-concept level (Specialization/Override) with a working UI action. The chapter's own Pack-to-Ontology composition (§8) remains entirely unbuilt.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Ontology versioning service<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ontology_concepts_schema_recovery.sql:16-17<br>src/routes/seu/core/ontology.ts:633-712</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Per-concept version/status lifecycle is real, governed, and badge-gated. No Ontology-as-a-whole versioning object exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Ontology APIs<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/ontology.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concept CRUD and tenant alias endpoints present and working.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Ontology events<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/ontology.ts (8 <code>eventBus.publish</code> call sites)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">4 of 7 named events plus 4 unnamed lifecycle events are real and wired, a substantial build-out from the chapter's own §18.9 "zero events" finding. <code>OntologyValidated</code>/<code>SemanticConflictDetected</code>/<code>SemanticConflictResolved</code> still unbuilt, tied to the still-missing conflict-detection mechanism.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 40
- Fully met: 11
- Partially met: 22
- Not met: 7
- Not Verifiable: 0

## Major implementation gaps (unchanged or newly confirmed)

1. **Pack-to-Ontology composition (§8, OM-005 partial, FR-18.5)** — `contributed_by_pack` remains permanently null across every call site; no function composes an Ontology from Platform/Organisation/Domain/Technology/Compliance Packs. The newly built `composeConcept` composes one concept from another concept, a materially different mechanism.
2. **Concept-to-concept relationships and constraints (§7 Relationships/Constraints, §9, OM-004)** — still a completely flat, unlinked registry; nothing has changed here since the chapter's own §18.4 finding.
3. **Semantic conflict detection (FR-18.6, §16 AC, §14 events)** — no mechanism exists; the real but unrelated `detectGovernanceConflicts` in the Composition Engine remains the closest, distinct, construct.
4. **Per-SEU Ontology scoping (FR-18.1)** — no `seu_id` on `ontology_concepts`; every SEU under a tenant shares one vocabulary, never snapshotted at commissioning.
5. **Resolution service has one caller (§10, §17 Semantic resolution service)** — `resolveLabels`/`resolveLabel` are real and tested but reach zero web views; only the dedicated vocabulary API endpoint uses them.

## Newly confirmed build-out since the chapter's own §18 (2026-08-25)

- A real Draft→Active→Deprecated→Retired→Archived lifecycle (`version`, `status` columns; `transitionConcept`, `deprecateConcept`, `retireConcept`, `archiveConcept`, `approveConcept`, `rejectConcept`), governed by `transitionEngine` and badge-gated (`ontology_define`/`ontology_approve`), with matching `transition_definitions` rows carrying `event_type`/`version_event` (Version Feature Plan wiring already in place at build time, consistent with CLAUDE.md's standing rule).
- A real approval workflow (CR-113 item 6): Draft concepts route through a dedicated Approvals UI; Reject requires new, non-duplicate written feedback.
- `composeConcept` (Specialization/Override), reusing `domain/engine/compositionEngine.ts`, with a working UI action and a published `OntologyComposed` event.
- 8 real `eventBus.publish` call sites, versus zero at the time of the chapter's own §18.9 audit.
- No event-subscriber (`HANDLER_REGISTRY`) entry exists for any Ontology-concept event — correct per CLAUDE.md's standing rule, since every Ontology Concept transition is definition-only and single-entity; `eventSubscriptions.json`'s `ConceptApproved`/`ConceptRejected` rows carry only descriptive metadata, no registered handler, and none is required.
- Test coverage remains unchanged at 4 tests (write-path enforcement, tenant aliasing) — the entire lifecycle/approval/composition surface built since 2026-08-25 has zero automated test coverage.
