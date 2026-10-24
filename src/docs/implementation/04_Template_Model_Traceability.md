# Implementation Traceability: Chapter 4 – Template Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/04_Template.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template is a reusable blueprint for commissioning an SEU and carries no runtime state.<br>Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/templates_schema_recovery.sql:3-31<br>src/dblayer/templatesDB.ts:35-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The templates table holds only authored content (draft_content, catalogue, version, status). SEU runtime data lives in seus and ebms. Many SEUs reference one Template row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template defines structure and does not define engineering behaviour.<br>Ref: §1, §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:2080-2200<br>src/domain/engine/compositionEngine.ts:229-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Template grammar carries code, name, purpose, version, Pack codes, catalogue, graph and parameters only. Behaviour is produced by the Composition Engine from Packs into the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Template is the structural input to the Composition Engine, then EBM, then SEU.<br>Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:442-456<br>src/domain/engine/profileCompositionUnravel.ts:107-117,168-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning passes templateIds to unravelComposition, which feeds the EBM composition and the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU originates from exactly one Template.<br>Ref: §6 FR-4.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:6<br>src/dblayer/seusDB.ts:15-27<br>src/routes/seu/core/commissioning.ts:442-456</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seus.template_id is a single NOT NULL FK, so each SEU row has one Template.<br>Gap: commissionSeu accepts several selections and composes templateIds[] (commissioning.ts:447, 235-264). The composition scope reads templates[0] as the identity. The one-Template rule is not enforced across the composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates are reusable across multiple SEUs.<br>Ref: §6 FR-4.3, §4, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:15-27<br>src/dblayer/templatesDB.ts:188-198</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template id is a FK on many seus rows. Active Templates are looked up by code for any commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates are independently versioned with a semantic version, unique per code and tenant.<br>Ref: §6 FR-4.2, §14, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/templates_schema_recovery.sql:18-27<br>src/routes/seu/core/templates.ts:276-281, 544-546</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">template_version is TEXT semver validated by semverError. UNIQUE(code, template_version, tenant_id). copyTemplateAsNewDraft creates the next patch version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Template versions remain available.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:176-186, 210-218<br>src/routes/seu/core/templates.ts:513-516</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Superseded versions move to Deprecated and are never deleted. findByCodeAndVersion and findAll return them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU permanently references the Template version it was commissioned from.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:6<br>src/routes/seu/core/commissioning.ts:91-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seus.template_id points at a specific row, which is one code and version. Gap: published rows can still be mutated (see FR-4.8), so the reference is not guaranteed to resolve to unchanged content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates are grouped into categories such as Enterprise Web Application, API Platform and SaaS Product, and further categories may be introduced through Packs.<br>Ref: §8 (illustrative)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/templates_schema_recovery.sql:3-27<br>src/routes/seu/core/templates.ts:55-71</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The templates table, TemplateSeedInput and the Template schema grammar have no category field. The section is illustrative.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates support inheritance from a parent Template.<br>Ref: §6 FR-4.4, §9, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:35-64<br>src/routes/seu/core/templates.ts:343-384<br>src/routes/seu/core/sdkAuthoring.ts:569-590,731-743</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">parent_template_id is stored and validated on save. A new Draft can be started from an Active parent: inheritedTemplateContent copies the parent's code, name, purpose, Pack lists and deliverable catalogue into the Draft content. validateTemplateSeed requires the same code, all parent mandatory Packs and all locked parent edges.<br>Gap: inheritance is a copy at creation plus validation. No code reads the parent after creation, so later parent changes do not reach a child, and no delta against the parent is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A derived Template may add capabilities, add deliverables, modify structure and declare additional mandatory Packs.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:343-384, 432-449<br>src/routes/seu/core/sdkAuthoring.ts:569-590</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the derived Draft starts with the parent's Packs and deliverable catalogue and is fully editable, so Packs and deliverables can be added, and capabilities derive from the selected Packs. Validation requires the parent's mandatory Packs and locked edges to remain.<br>Gap: no delta against the parent is stored, so additions and modifications cannot be told apart from inherited content. The copy at creation omits the dependency graph, so a child restates the parent's locked edges itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A derived Template may not modify its parent Template.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:343-384<br>src/dblayer/templatesDB.ts:35-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The child is a separate row. Validation requires the same code, all parent mandatory Packs and all locked parent edges. No write path touches the parent row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates declare mandatory Packs.<br>Ref: §6 FR-4.5, §5, §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:198-205, 292-299, 432-439<br>src/dblayer/templatesDB.ts:298-329</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack codes per category are validated against packs and stored in template_packs. They are read back as mandatory Pack codes for commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates declare recommended Packs.<br>Ref: §6 FR-4.5, §5, §7 (struck through)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:198-205</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 marks recommended Packs as resolved by the Profile optionalPackCodes. No Template field exists, which matches §7. FR-4.5 and §5 still list recommended Packs, so the spec text is internally inconsistent. Resolved at Profile level only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates define default deliverables as a catalogue.<br>Ref: §6 FR-4.6, §10, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:303-320, 329-336, 594-596<br>src/dblayer/templatesDB.ts:121-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The catalogue is validated against the deliverable-name Ontology, checked for duplicates and persisted. The dependency graph is validated and materialised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The deliverable catalogue may be extended during commissioning.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:263-295</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning builds deliverableCatalogueByCode from the selected Templates.<br>Gap: no step adds commissioner-supplied deliverables beyond the Template catalogues.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates define the initial capability catalogue.<br>Ref: §6 FR-4.7, §11, §19 (struck through)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:211-220, 417-439<br>src/dblayer/templatesDB.ts:264-296</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are derived from the selected Packs and stored in template_capabilities. The Template does not author them directly. §19 strikes the capability catalogue model, so derivation matches the amended spec. FR-4.7 text is unamended.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are placeholders. Participants are assigned during commissioning.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:242-260<br>src/domain/engine/seuCompositionScope.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template capabilities carry no Participant. Participants are fulfilled against the SEU capabilities at commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template defines default roles.<br>Ref: §5, §7 Default Roles</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">none</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Template grammar has no roles field and no code reads roles from a Template. Roles are not authored in a Template.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template may define reference workflows.<br>Ref: §5 default workflows, §7, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">none</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No workflow field exists in the Template grammar or tables. Workflows appear only as Pack contributions through the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template defines the SEU purpose.<br>Ref: §5, §7 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:2080-2110<br>src/routes/seu/core/templates.ts:553</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">purpose is a required field of the Template grammar and is copied on new drafts.<br>Gap: no consumer carries Template purpose into the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template has an identifier, name and version.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/templates_schema_recovery.sql:3-27<br>src/routes/seu/core/templates.ts:278-281</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">id, code, name and template_version exist. Name and version are validated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template exposes configurable commissioning parameters supplied at commissioning.<br>Ref: §5, §7, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:73-193, 440-463<br>src/routes/seu/core/commissioning.ts:27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">exposedParameters are derived from Pack parameter candidates and value-checked. Profile overrides are applied through extractExposedParameterOverrides.<br>Gap: parameters come from Packs and Profiles. Methodology, stack and environment are not distinct Template fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates follow the lifecycle Draft, Validated, Published, Active, Deprecated, Retired, Archived.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Template rows)<br>src/routes/seu/core/templates.ts:507-534</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Seven forward transitions plus Validated to Draft reject are seeded. Each carries a verb, event_type and version_event. Transitions run through transitionEntity with a real actor.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Template subsystem publishes TemplateCreated, Validated, Published, Activated, Deprecated and Retired.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Template rows)<br>src/routes/seu/core/templates.ts:494-503, 512</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">TemplateValidated, Published, Activated, Deprecated and Retired are published through publishTransition. The birth event is named TemplateDefined, not TemplateCreated. TemplateRejected and TemplateArchived are extra.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates remain immutable after publication.<br>Ref: §6 FR-4.8, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:66-92, 94-119, 121-132, 134-142<br>src/dblayer/templatesDB.ts:20-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">updateDraftContent restricts to status Draft. Version changes go through copyTemplateAsNewDraft.<br>Gap: setDraftContent, setDeliverableCatalogue, setPackSelection, setRequiredCapabilities and upsert (ON CONFLICT DO UPDATE) carry no status guard. unravelTemplate rewrites them at the Published transition by design. Immutability is by convention, not enforced in the DB layer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates are independent of runtime execution.<br>Ref: §17, §2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:467-505<br>src/domain/engine/profileCompositionUnravel.ts:168-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template authoring and unravel do not read SEU runtime state. Commissioning consumes Templates one way.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates can be created.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:467-505, 536-542</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createTemplateDraft validates, begins a birth transition, inserts the Draft and publishes the birth event with a real actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template registry and lifecycle services exist.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:611-624<br>src/routes/seu/web/templateRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">listTemplatesWithNextStates lists Templates with manual next states. The web registry renders them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template APIs are provided.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/templates.ts:10-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The API exposes only GET /templates for candidate lookup by capability codes. Create, version and lifecycle operations are web routes only, not API endpoints.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template versioning service exists.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:544-591</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">nextAvailableVersion and copyTemplateAsNewDraft produce the next version as a new Draft.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 31
- Fully met: 16
- Partially met: 12
- Not met: 3
- Not verifiable: 0

Major implementation gaps:

- Default roles and reference workflows are not part of the Template model.
- Inheritance is a copy at creation plus validation on save. The parent is not read afterwards and no delta is stored.
- Template categories (§8) have no field or behaviour.
- Immutability after publication is not enforced in the DB layer.
- Commissioning accepts several Templates, against the one-Template rule.
- Template API exposes candidate lookup only.
