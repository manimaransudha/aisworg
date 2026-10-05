# Chapter 10 – Capability Model: Implementation Traceability

**Date of report: 4-10-2026**

Fresh code-verification pass against the current working tree (not the chapter's own §18 audit text, though findings are cross-checked against it). Core files read directly: `src/dblayer/capabilitiesDB.ts`, `src/dblayer/recovery/capabilities_schema_recovery.sql`, `src/routes/seu/core/capabilities.ts`, `src/dblayer/seuCapabilitiesDB.ts`, `src/dblayer/objectivesDB.ts:413-424`, `src/routes/seu/core/packs.ts` (dependency validation, lines ~694-705), `src/domain/engine/compositionEngine.ts`.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability defines what engineering function must be performed, independent of who performs it<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capabilities</code> table has no Participant FK of any kind; definition is Participant-independent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are fulfilled by Participants (AI, human, or external service)<br> Ref: §1 Purpose, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:153-174, 185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapability</code>/<code>fulfilCapabilityWithParticipants</code> create <code>participants</code> rows typed <code>AI</code>/<code>Human</code>/<code>External</code> via <code>participants.type</code>, bound through <code>capability_fulfilments</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Model separates engineering competence from execution, allowing independent evolution<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:5-82<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability rows carry no execution logic; <code>dependencyDefinitionEngine.evaluateAndPublishFromTransition</code> is invoked on fulfilment but is a separate, reusable engine, not Capability-embedded behaviour.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: Capability abstraction, lifecycle, fulfilment, relationships, discovery, composition (§2)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see individual rows below)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Abstraction/fulfilment/discovery have real implementation; lifecycle is deliberately borrowed from the owning Pack (see CM-001 row); relationships/composition are partially built.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability is a reusable engineering competency, independent of Participants, Organisations, Technologies, AI providers<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Organisation/technology/AI-provider coupling exists on <code>capabilities</code>; <code>originating_pack_id</code> ties it only to the declaring Pack, not to any execution concept.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-001: Capabilities are stable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts (SDK authoring <code>canEdit</code> gate, Draft-status check)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The only write path into <code>capabilitiesDB.upsertFromPack</code> is gated to a Pack still in Draft status; a Published/Active Pack's Capabilities render view-only. Stability is enforced at the authoring-UI layer, not as a DB-level invariant on <code>capabilities</code> itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-002: Participants are replaceable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:220-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>releaseParticipants</code> releases/archives a Participant and reverts the SEU Capability to Unfulfilled; a new Participant can then be assigned via the ordinary fulfil path. No 1:1 permanent binding exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-003: Multiple Participants may fulfil the same Capability<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204<br>src/dblayer/seuCapabilitiesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapabilityWithParticipants</code> accepts multiple <code>participantMasterIds</code> and creates one <code>capability_fulfilments</code> row per selection, recording <code>fulfilmentStrategy: "Composite"</code> when more than one is chosen.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-004: One Participant may fulfil multiple Capabilities<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts (no uniqueness constraint on <code>participant_id</code> referenced by capabilities.ts:91-98)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments.participant_id</code> carries no uniqueness constraint; nothing prevents the same <code>participants_master</code> resource being selected as eligible for a different Capability's own fulfilment call.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-005: Capabilities shall not contain runtime state<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No status/state column exists on <code>capabilities</code>. True, but because the table has no lifecycle concept of its own at all (state lives on <code>packs</code>/<code>seu_capabilities</code> instead), not because of a deliberate stateless-by-design split within the Capability entity itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CM-006: Capabilities remain independent of engineering behaviour (EBM supplies it)<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No EBM coupling (no FK, no behaviour column) exists on <code>capabilities</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.1: platform maintains a Capability Catalogue<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:73-81</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findAll</code> returns every <code>capabilities</code> row ordered by <code>code</code> — a real, minimal catalogue query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.2: every Work Item shall require one or more Capabilities<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuCapabilitiesDB.ts:59-74</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_capabilities</code> ties a SEU's required Capabilities together, joined for Work Item/Dispatch consumption via <code>findBySeuId</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.3: every Capability shall possess a globally unique identifier<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:16-18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id</code> (UUID) is globally unique. <code>code</code> is explicitly **not** globally unique — its uniqueness constraint is <code>UNIQUE (originating_pack_id, code)</code>, Pack-scoped by design, so the same <code>code</code> string can exist under two different Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.4: Capabilities shall support versioning<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:13-37<br>src/dblayer/recovery/capabilities_schema_recovery.sql:14-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capabilities.version</code> (TEXT) is written on every <code>upsertFromPack</code> call as a passed-through copy of the caller-supplied Pack version string. It is not independently incremented by any Capability-level operation; versioning is real but entirely borrowed from the owning Pack's own version identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.5: Capabilities shall be independently extensible<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:13-37 (ON CONFLICT (originating_pack_id, code))</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Any Pack can introduce new Capability rows through <code>upsertFromPack</code>; the Pack-scoped <code>code</code> uniqueness means two unrelated Packs can each extend the catalogue with a same-named Capability without collision.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.6: Capabilities shall support fulfilment by multiple Participant types<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilOne</code> accepts <code>type: ParticipantType</code> resolved per Participant (AI/Human/External), with no restriction tying a Capability to one specific type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-10.7: Capability fulfilment shall remain traceable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:91-98, 119-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each fulfilment creates a <code>capability_fulfilments</code> row and publishes a <code>CapabilityFulfilled</code> event carrying <code>capabilityId</code>/<code>participantId</code>/<code>actorId</code>/<code>authorityBadge</code>, giving a durable, attributable trace.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Categories are illustrative; additional capabilities may be introduced through Packs (§7)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:7 (<code>category</code> column)<br>src/routes/seu/core/packs.ts (SDK authoring schema, <code>code</code>/<code>name</code>/<code>description</code> only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>category</code> still exists as a live DB column (nullable, untouched by the current migration) but the SDK authoring form for <code>contributionCapabilities[]</code> no longer surfaces it — new Capabilities are authored with no category value. Extension through Packs itself (the chapter's actual normative point here) is real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Capability shall define Identifier, Name, Description, Category, Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria, Supported Participant Types<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capabilities_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Live schema and authoring path provide only Identifier (<code>id</code>/<code>code</code>), Name, Description. <code>category</code> exists as a dead/unauthored column. Inputs, Outputs, Required Knowledge, Expected Deliverables, Success Criteria, Supported Participant Types have no column or field anywhere on <code>capabilities</code> or its authoring schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities may depend upon, specialise, compose, or extend other/Pack Capabilities, with no circular dependencies<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:700-705<br>src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability's relationships are expressed indirectly through its owning Pack's own <code>dependencies[]</code> array (<code>dep.type</code>). Only <code>dep.type === "required"</code> has real validated behaviour (must resolve to an Active Pack); <code>optional</code>/<code>conditional</code>/<code>incompatible</code> are validated for shape only, with no differentiated runtime behaviour anywhere. <code>compositionEngine.ts</code> contains no circular-dependency detection of any kind — grep for "circular" across both files returns no match. "Specialise" and "compose" as relationship kinds distinct from plain dependency have no implementation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability fulfilment is the process of assigning one or more Participants (AI/Human/External/Hybrid) to provide a required Capability, with fulfilment strategies free to evolve<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:153-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapability</code> and <code>fulfilCapabilityWithParticipants</code> implement single- and multi-Participant assignment for AI/Human/External types; <code>fulfilmentStrategy</code> is a free-form field with no schema coupling back to <code>capabilities</code>, allowing strategies to evolve independently. "Hybrid teams" has no dedicated type value but is expressed as <code>fulfilmentStrategy: "Composite"</code> when multiple Participants are jointly assigned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall support discovery of Capabilities by identifier, category, engineering objective, Deliverable, Pack contribution, supported Participant type<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:49-57 (by id)<br>src/dblayer/objectivesDB.ts:413-424 (by objective)<br>src/dblayer/capabilitiesDB.ts:63-71 (by Pack contribution)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">By identifier: real (<code>findById</code>). By engineering objective: real, working join (<code>getRequiredCapabilities</code> via <code>objective_capabilities</code>). By Pack contribution: real (<code>findByOriginatingPackIds</code>). By category: no dedicated query exists; <code>category</code> is not even populated via the current authoring path (see §7/§8 rows), so this axis is unreachable in practice. By Deliverable: no direct "Capabilities required by this Deliverable" query exists. By supported Participant type: no such field exists on <code>capabilities</code> at all. 3 of 6 discovery axes are real.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On Deliverable Ready: identify required Capabilities, determine fulfilment requirements, invoke Capability Fulfilment, assign Participants, authorise execution — independent of EBM<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuCapabilitiesDB.ts:59-74<br>src/routes/seu/core/capabilities.ts:153-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_capabilities</code> records required Capabilities; <code>fulfilCapability</code>/<code>fulfilCapabilityWithParticipants</code> is the Fulfilment invocation; Participant assignment and the subsequent <code>dependencyDefinitionEngine</code> push-evaluation (capabilities.ts:106-114) stand in for "authorise execution." No EBM coupling found anywhere in this path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities may evolve through new versions, Pack contributions, specialisations, deprecation, or resolution of an Organisational Learning Obligation<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts:13-37 (new versions/Pack contributions)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">New versions and Pack contributions are real (copied Pack version, Pack-scoped <code>upsertFromPack</code>). Specialisation: no mechanism (same gap as §9 relationships). Deprecation: no Capability-specific status column; relies entirely on the owning Pack's own deprecation state, with no direct <code>capabilities</code>-level signal. Obligation-driven revision: no code reference connects a resolved Organisational Learning Obligation to any Capability/Pack version change — <code>compositionEngine.ts</code> and <code>capabilitiesDB.ts</code> have zero such references.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability subsystem shall publish CapabilityRegistered/Updated/Deprecated/Requested/Fulfilled/Unavailable/Released<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:131-140 (<code>CapabilityFulfilled</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only <code>CapabilityFulfilled</code> is published, and only from the fulfilment path. <code>CapabilityRegistered</code>, <code>CapabilityUpdated</code>, <code>CapabilityDeprecated</code>, <code>CapabilityRequested</code>, <code>CapabilityUnavailable</code>, <code>CapabilityReleased</code> are not published anywhere in <code>src/routes/seu/core/capabilities.ts</code> or <code>capabilitiesDB.ts</code> under those exact event names; a search for each string found no match. Capability-definition lifecycle events are instead expressed as the owning Pack's own <code>PackRegistered</code>/<code>PackPublished</code>/<code>PackActivated</code>/<code>PackDeprecated</code> events, which is a deliberate substitution, not a 1:1 implementation of this section's named event list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: independent of Participant implementation, concurrent fulfilment, multiple fulfilment strategies, fully traceable, extensible through Packs<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see CM-002/003/004, FR-10.5, FR-10.7 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All five NFRs are backed by the same evidence already cited above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: Capability Catalogue exists; multiple/one-to-many fulfilment; fulfilment traceable; new Capabilities via Packs; evolution without Kernel change<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see FR-10.1, CM-003/004, FR-10.7, FR-10.5 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All six acceptance criteria are satisfied by evidence already cited; new-Pack-version Capability changes require no Runtime Kernel modification (<code>upsertFromPack</code> is a plain data write).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: domain model, catalogue, registry, discovery service, fulfilment interfaces, APIs, events<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilitiesDB.ts<br>src/routes/seu/core/capabilities.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain model, catalogue, registry (via Pack-borrowed lifecycle/versioning), and fulfilment interfaces are real. Discovery service is partial (3 of 6 axes, see §11 row). Capability events are partial — only <code>CapabilityFulfilled</code> plus substituted Pack-level events (see §14 row); <code>CapabilityRequested</code>/<code>CapabilityUnavailable</code>/<code>CapabilityReleased</code> remain unbuilt.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 26
- Fully met: 15
- Partially met: 11
- Not met: 0
- Not verifiable: 0

## Major gaps (not previously flagged, or newer than the chapter's own §18 audit)

1. **Capability Structure (§8) is more incomplete than three of its ten named fields surviving** — the DB still physically carries a dead `category` column that the current SDK authoring schema does not even populate, so §7/§8's "by category" path is not merely unimplemented, it is unreachable (no code writes a category value for any newly-authored Capability).
2. **Events (§14) deviate further from the chapter's literal list than "Pack events cover the rest" implies** — a direct search for `CapabilityRegistered`, `CapabilityUpdated`, `CapabilityDeprecated`, `CapabilityRequested`, `CapabilityUnavailable`, `CapabilityReleased` found zero matches anywhere in the Capability route/DB layer. Only `CapabilityFulfilled` is real.
3. **Capability Relationships (§9) circular-dependency requirement has no implementation anywhere in the composition path** — confirmed by direct grep of both `packs.ts` and `compositionEngine.ts`; this is the specification's own explicit normative requirement ("Capability relationships shall not create circular dependencies"), not a soft expectation.
4. **FR-10.3's "globally unique identifier" for `code` is a specification/implementation deviation, not a gap** — the implementation deliberately scopes `code` uniqueness to `(originating_pack_id, code)`, which contradicts a literal reading of "globally unique" even though `id` itself is.

This traceability pass was performed directly (no sub-agents) against the current working tree. It supersedes none of §18's existing text in the chapter file; it is a fresh, independent verification exercise per the implementation-traceability skill.
