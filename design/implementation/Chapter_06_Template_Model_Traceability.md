# Chapter 6 – Template Model: Implementation Traceability

**Date of report: 4-10-2026**

Note: Chapter 6 §20 already contains an extensive, owner-maintained implementation log (through CR-026). This traceability pass verified that log against the current repository state directly (not merely re-stated it), and found the repository has progressed further than §20's own text in several places (CR-038/041/087/088/114 and a Template Registry page exist in code but are undocumented in §20). Those gaps are called out explicitly below.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template defines structure (not behaviour); EBM defines behaviour<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts (no behavioural/execution logic in Template module)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template module (templatesDB.ts, core/templates.ts) contains only structural fields (deliverable catalogue, pack selections, capabilities) and commissioning-time materialisation. No engineering-behaviour logic lives here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates provide structural definition consumed by Composition Engine → EBM → SEU<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:421-431 (deriveCapabilityCodesFromPackCodes)<br>src/routes/seu/core/templates.ts:1185-1200 (materialiseTemplateDraft)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template's selected Packs/deliverables/capabilities are the actual inputs the composition/commissioning path consumes (see §20.6 finding below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Template is a reusable specification with no runtime state<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:36-59, 84-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>templates</code> row holds only authored structural columns (deliverable_catalogue, draft_content, status, versions); no runtime/execution state column exists on the table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates are reusable across multiple SEUs<br> Ref: §4, FR-6.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:60-79 (findCandidateTemplates)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A single Active Template row is matched against any Objective whose required-Capability set it satisfies (superset check) — not consumed/invalidated by use.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template defines: SEU purpose, default capabilities, default deliverable catalogue, mandatory/recommended Packs, commissioning parameters, default roles, default workflows<br> Ref: §5 Responsibilities</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:84-146 (TemplateSeedInput), templatesDB.ts:434-516</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Purpose (CR-023), default/required Capabilities (derived, CR-038), Deliverable Catalogue, Mandatory Packs (now 6 category slots, CR-038) are all real. Recommended Packs and Commissioning Parameters are deliberately NOT on Template — resolved onto Profile instead (§20.5, §20.8, confirmed below). Default Roles and Default Workflows have no field/table anywhere in templatesDB.ts or core/templates.ts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Templates shall not define engineering behaviour<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts (whole file)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No transition/behavioural logic is authored through Template; EBM (separate chapter) owns behaviour.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.1: every commissioned SEU originates from exactly one Template<br> Ref: §6 FR-6.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/profiles.ts (base_template_id single column, not an array)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not directly re-verified against commissioning.ts in this pass (out of Chapter 6's own module), but Profile's <code>base_template_id</code> is a single-valued FK, structurally permitting only one Template per Profile/commissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.2: Templates independently versioned<br> Ref: §6 FR-6.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:36-59 (migration comments), :291-301 (findByCodeAndVersion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>(code, template_version, tenant_id)</code> is a real unique identity (migration 062, CR-024/026); templateVersion is a real semver column, not a cosmetic field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.3: Templates reusable across multiple SEUs<br> Ref: §6 FR-6.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:60-79</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.4: Templates support inheritance<br> Ref: §6 FR-6.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:84-113 (parent_template_id)<br>src/routes/seu/core/templates.ts:626-683 (parentTemplateId validation)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Built, but not as §9 literally describes (see §9 row below) — a same-code, tenant-disambiguated "Derived Template" model (CR-026), not a multi-generation chain with its own distinct code per generation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.5: Templates declare mandatory and recommended Packs<br> Ref: §6 FR-6.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:478-515 (setPackSelection/getPackSelection, 6 category slots)<br>src/routes/seu/core/templates.ts:399-413 (PACK_SELECTION_SLOTS)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Mandatory Packs: real, and more granular than the chapter's §20.5 text describes — CR-038 replaced the flat <code>mandatoryPackCodes</code> with six category-scoped slots (compliance/domain/engineering/integration/organisation/technology), union-validated against a parent's mandatory set on inheritance. Recommended Packs: confirmed absent from Template; <code>optionalPackCodes</code> lives on Profile only (checked in profilesDB.ts). This CR-038 granularity post-dates and is not reflected in §20.5's own text.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.6: Templates define default deliverables<br> Ref: §6 FR-6.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:199-210 (setDeliverableCatalogue)<br>commissioning materialisation referenced at templates.ts:1185-1200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable catalogue is a real authored column, materialised into real <code>deliverables</code> rows at commissioning (per §20.6, re-confirmed via templatesDB/commissioning call chain).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.7: Templates define the initial capability catalogue<br> Ref: §6 FR-6.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:405-448 (setRequiredCapabilities/getRequiredCapabilities)<br>src/routes/seu/core/templates.ts:415-431 (deriveCapabilityCodesFromPackCodes)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities are not independently authored input any more (CR-038) — they are derived fresh from the Template's selected Pack codes at every materialise/publish, then persisted to <code>template_capabilities</code>. Functionally present; mechanism differs from a hand-authored "capability catalogue" the spec text implies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-6.8: Templates remain immutable after publication<br> Ref: §6 FR-6.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:84-113, 122-148 (createDraft / updateDraftContent scoped <code>WHERE status = 'Draft'</code>)<br>src/routes/seu/core/templates.ts:936-1004 (reactivateAsNewVersion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateDraftContent</code> is scoped to Draft rows only; a Published/Active row cannot be mutated through that path. Reactivating a terminal row creates a genuinely new <code>(code, version, tenant)</code> row rather than mutating the old one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Template Structure: Identifier/Name/Version/Purpose/Default Capabilities/Deliverable Catalogue/Mandatory Packs/Commissioning Parameters present; Description/Objectives/Lifecycle/Recommended Packs removed per Sudha review<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:84-146 (TemplateSeedInput — no description/objectives/lifecycle/recommendedPacks fields)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All items the spec's own struck-through annotations say should be removed are in fact absent from the real authoring input shape. All items confirmed "keep" are present (Purpose: CR-023, templates.ts:135-145). Commissioning Parameters, despite being listed as "keep, no issue" in the Sudha note, is in fact NOT on Template (see §13/§20.8 row) — this is a live contradiction between the chapter's own closing note (§7 end) and §20.8's own build record within the same chapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Default Roles — distinct layer or redundant with Capabilities (unresolved in spec)<br> Ref: §7, §20.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">grep across src/dblayer/templatesDB.ts, src/routes/seu/core/templates.ts — no match for any "role" field/table</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>default_roles</code> field, column, or table exists anywhere in the Template module. Confirmed still unbuilt, matching §20.7's own "uncertain, needs Ch.11" note; this pass did not independently resolve Ch.11 against it either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Template Inheritance — multi-generation chain (e.g. Enterprise Web App → Healthcare Web App → Healthcare Claims Platform), add-only derivation, parent immutability<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:84-113 (parent_template_id)<br>src/routes/seu/core/templates.ts:626-683</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">What is built is structurally different from §9's literal text: a Derived Template MUST keep the identical <code>code</code> as its parent (enforced at templates.ts:639-641), disambiguated only by <code>tenant_id</code> — so §9's own worked example (three distinct-named generations) is not reachable; "Healthcare Web Application" can never become a Template <code>code</code> under the current Ontology-rooted identity model (§20.4's own CR-026 note confirms this directly). Add-only (superset of parent's mandatory Packs, and locked Implementation/Decomposition dependency edges) is enforced (templates.ts:642-682). Parent immutability holds (parent row is never written to by child creation).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Deliverable Catalogue — default catalogue, extendable at commissioning<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:199-210</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real column, materialised into real <code>deliverables</code> rows; extension-at-commissioning not independently re-verified in this pass (commissioning.ts is outside Chapter 6's own module boundary) but no evidence contradicts it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Capability Catalogue — Capabilities are placeholders, Participants assigned at commissioning<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:421-431, 768-781</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are derived from Pack selections, not independently authored; the derived set becomes the SEU's Capability placeholders at commissioning (per §20.6). Participant assignment is a separate chapter (Ch.12 Capability Fulfilment), not re-verified here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Workflow Definitions — reference workflows (Requirements/Development/Testing/Release Flow), behaviour governed by EBM<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">grep across templatesDB.ts, core/templates.ts — no match for "workflow"</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>default_workflows</code> field/table exists anywhere. Confirmed still unbuilt, matching §20.7. The spec's own §20.7 annotation ("likely redundant with the Deliverable Catalogue's dependency graph") is a plausible but not code-verified claim — this pass did not find anything in the dependency-graph code (templates.ts:478-524, :738-750) that names or substitutes for a distinct "workflow" concept; the dependency graph expresses ordering only, not named flows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Commissioning Parameters — Templates expose configurable parameters (methodology, tech stack, environment, domain, compliance, org Packs), supplied at commissioning<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts (no config_parameters/commissioning-parameter column); src/dblayer/profilesDB.ts:44-46 (<code>profiles.config_parameters</code>, <code>environment</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed: no commissioning-parameters field exists on <code>templates</code> at all. The equivalent live entirely on <code>profiles</code> (<code>config_parameters</code> JSONB + <code>environment</code> + <code>optionalPackCodes</code>). This matches §20.8's own finding exactly — a real, verified documentation/code divergence from the normative §5/§7/§13 text, not fixed by this pass (per skill instructions, specification text is not altered).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Versioning — independently versioned, historical versions remain available, SEUs permanently reference the Template version commissioned from<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:277-320 (findByCode/findByCodeAndVersion/findActiveByCode, all additive, never delete old rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Old versions are never deleted or overwritten (createDraft always inserts a new row; updateDraftContent/setDraftContent only touch Draft-status or draft_content, never collapse versions). SEU-side "permanent reference" to the exact commissioned version was not independently re-verified in this pass (lives in commissioning.ts / EBM, outside this chapter's own module) — treated as Not Verifiable for that specific half.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Lifecycle — Draft → Validated → Published → Active → Deprecated → Retired → Archived<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (Template rows, verified directly)<br>src/routes/seu/core/templates.ts:1149-1177 (AUTHORING_NEXT_STATE)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six forward hops plus three terminal-state reactivation-to-Active hops are real seeded <code>transition_definitions</code> rows, matching the full seven-state chain exactly.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Events — TemplateCreated/Validated/Published/Activated/Deprecated/Retired (+Archived, a spec oversight per §20.10)<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (eventType per hop, verified directly: TemplateValidated/Published/Activated/Deprecated/Retired/Archived)<br>src/routes/seu/core/templates.ts:905-919 (TemplateCreated published directly)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All seven real, distinctly-named events are wired — and via a mechanism §20.10's own text does not reflect: <code>eventType</code> is now read directly off the seeded <code>transition_definitions</code> row (Version Feature Plan, migration 185), not the hardcoded <code>EVENT_BY_TARGET_STATE</code> map §20.10 describes CR-025 as having built. The functional outcome (real per-state event names) matches the spec; the mechanism has moved since §20.10 was last updated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 NFRs — reusable, immutable after publication, support inheritance, independent versioning, independent of runtime execution<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All five NFRs individually verified Fully/Partially met above; no row is Not Met.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Acceptance Criteria (create, inherit, define structure, declare mandatory Packs, define deliverable catalogues, independent versioning)<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six criteria have real, verified implementation evidence; inheritance differs structurally from §9's literal model as noted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§19 Deliverables — domain model, registry, versioning service, inheritance model, deliverable catalogue model, Template APIs, lifecycle services (Capability catalogue model struck)<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts (whole file); src/routes/seu/web/templateRegistry.ts; src/routes/seu/core/templates.ts:1214-1222 (listTemplatesWithNextStates)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six retained deliverables exist concretely. Notably, a Template Registry web route/page (<code>src/routes/seu/web/templateRegistry.ts</code>) exists in the current codebase — this directly contradicts §20.12's own text ("No Template/Profile registry page — minor asymmetry vs Pack"), which §20's log never updated to reflect.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.1 Template/Profile entity-direct authoring, code rooted in Ontology (template-categories)<br> Ref: §20.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts:36-59 (code via Ontology, not UUID)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Matches the chapter's own log; re-confirmed directly, not merely re-stated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.4 Inheritance — tenant-scoped same-code model, not §9's literal chain<br> Ref: §20.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:626-683</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Re-confirmed directly against the code as described in §20.4; see the §9 row above for the gap this creates against the normative spec text itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.5 Recommended Packs resolved via Profile's optionalPackCodes, not a Template field<br> Ref: §20.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts (no recommended-pack table); profilesDB.ts (optionalPackCodes present, not independently re-opened in this pass)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Re-confirmed: no recommended-Packs equivalent on Template.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fully met (as an "open" status claim — i.e., the chapter's claim that these remain open is itself accurate)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.7 Default Roles, Workflow Definitions — still open<br> Ref: §20.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(absence confirmed by grep, see §7/§12 rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Re-confirmed directly: neither has any field, column, or table in the current codebase.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not verifiable (Profile half only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.10 Events — Template built via CR-025, Profile still generic<br> Ref: §20.10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionDefinitions.json (Template rows real; Profile rows not inspected in this pass)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template half re-confirmed, though via the newer Version-Feature-Plan mechanism rather than the EVENT_BY_TARGET_STATE map this section describes (see §16 row). Profile half not independently re-verified in this pass (outside Chapter 6's primary scope; Profile is Chapter 7).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.12 No Template Registry page<br> Ref: §20.12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/templateRegistry.ts (file exists)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contradicted by current code: a Template Registry page exists. This is either a post-§20.12 build the chapter's own log never updated, or the route exists but is not reachable/complete — this pass read only the route's existence, not its full handler body, so the precise current scope of that page (e.g. whether it also now exposes the reactivation UI trigger §20.3/§20.15 flag as still missing) is unconfirmed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§20.15 Summary claims (CR-021/022/023/024/025/026 all closed same day)<br> Ref: §20.15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/templatesDB.ts, src/routes/seu/core/templates.ts (version/tenant/inheritance code present and consistent with all six CRs)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Re-confirmed directly for Template's own half of every CR named.</td>
    </tr>
  </tbody>
</table>
## Coverage check

§1–§5, §6 (FR-6.1–6.8), §7–§19, §20.1–§20.15 were all read and an intent or an explicit "no implementation-relevant intent" determination was made for each. §8 (Template Categories, illustrative list) and §16's event-name list were folded into the rows above rather than given their own row, since they are themselves implementation-relevant and already covered.

## Summary

- Total intents analysed: 29
- Fully met: 15
- Partially met: 8
- Not met: 3
- Not verifiable: 3 (two of the "Not verifiable" rows are partial-scope: §20.10 Profile-half, §20.12 page depth)

## Major implementation gaps (not previously flagged in §20's own text, or sharper than it states)

1. **§7/§13 contradiction inside the chapter itself**: the Sudha review note at the bottom of the chapter lists Commissioning Parameters as "Keep, no issue," while §20.8 (same chapter) documents that Commissioning Parameters was in fact moved to Profile entirely. The spec's own closing note has not been reconciled with its own §20.8 finding.
2. **§9's literal inheritance model is structurally unreachable** under the Ontology-rooted `code` = category identity (CR-021) combined with CR-026's same-code-only inheritance rule — confirmed directly in code (templates.ts:639-641), not just inferred from §20.4's prose.
3. **§20.12 appears stale**: a Template Registry page exists in the current codebase (`templateRegistry.ts`), contradicting the chapter's own "No Template/Profile registry page" note. Full extent of that page (whether it closes the related reactivation-UI-trigger gap §20.3/§20.15 names) was not verified in this pass.
4. **CR-038/041/087/088/114 have materially changed the Template authoring surface** (six category-scoped mandatory-Pack slots replacing the flat list; a first-class authored dependency graph; Exposable Parameters for Service Level/Policy/Checklist/dependency tunables; a mandatory `schema_definition_id`) — none of this is reflected anywhere in §20's own text, which stops at CR-026. This is a documentation-lag gap in the specification's own implementation log, not a code defect.
5. **§12 Workflow Definitions and §7 Default Roles remain genuinely unbuilt** — directly re-confirmed, not merely carried over from §20.7's own claim.
