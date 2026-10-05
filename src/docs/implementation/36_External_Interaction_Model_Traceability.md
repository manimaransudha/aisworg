# Chapter 36 – External Interaction Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU exchanges information/invokes capability outside Runtime Kernel; Runtime Kernel stays authoritative, external systems never own/modify engineering state<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:20-53<br>src/dblayer/externalInteractionsDB.ts:5-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ExternalInteraction is a pure record: creating one writes a row and publishes an event; no code path lets an external system write back into <code>seus</code>/<code>deliverables</code>/other engineering tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Interaction abstraction (scope item)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (ExternalInteractionRow)<br>src/dblayer/recovery/external_interactions_schema_recovery.sql:1-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A dedicated <code>external_interactions</code> entity exists with its own table, DB layer, core service and lifecycle, distinct from any specific tool.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction boundaries, lifecycle, governance, traceability, extensibility (scope items)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle and governance (via transitionEngine/qualityGateEngine) exist. Extensibility and boundary concepts are addressed separately below (§10, §11) with gaps.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Runtime Kernel → External Interaction Model → Interaction Adapters → External Systems<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:1-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The record/lifecycle layer exists directly under the Runtime Kernel. The "Interaction Adapters" layer in the diagram has no corresponding code — see §10 finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Interaction is a controlled exchange (request info, publish info, invoke capability, receive notification, synchronise state); external systems never participate in state transitions<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:20-53, 85-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>interaction_type</code> is a free-text field (no controlled vocabulary of the five exchange kinds). No code path allows an external system to call into <code>transitionEngine</code> for any entity other than <code>ExternalInteraction</code> itself, so engineering-state isolation holds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-001 External interactions are isolated<br> Ref: §5 EI-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/external_interactions_schema_recovery.sql:5-6<br>src/routes/seu/core/externalInteractions.ts:30-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An interaction is scoped to one SEU and optionally one Deliverable belonging to that SEU (checked at creation); it cannot reference or mutate unrelated engineering objects.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-002 Runtime Kernel owns engineering state<br> Ref: §5 EI-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:85-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionExternalInteraction</code> only ever updates the <code>external_interactions</code> row via <code>externalInteractionsDB.updateStatus</code>; no other table is written as a side effect of an interaction transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-003 External interactions are adapter-based<br> Ref: §5 EI-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:1-10 (comment)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The file's own header states: "No real Interaction Adapter exists yet (Ch.36 §10)." Recording is a manual, human-entered act, not an adapter translating to/from an external technology. No <code>InteractionAdapter</code>/<code>Connector</code> abstraction exists in the codebase (the <code>src/adapters/*</code> modules are Participant-onboarding adapters, unrelated to Ch.36).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-004 Interactions are traceable<br> Ref: §5 EI-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:41-50, 127-136<br>src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>InteractionCreated</code>/<code>InteractionFailed</code>/<code>InteractionCompleted</code> events are appended immutably to the <code>events</code> table with <code>seuId</code>, <code>originatingObjectId</code>, <code>actorId</code>, <code>authorityBadge</code>. Governing-policy codes and payload are not captured on the event or the row (see §14 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-005 External interactions are asynchronous wherever practical<br> Ref: §5 EI-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:20-53, 85-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Creation and every lifecycle transition are synchronous request/response calls (HTTP POST → immediate DB write/response). No queued/async dispatch mechanism exists for interactions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EI-006 External interactions are technology-independent<br> Ref: §5 EI-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>target_system</code>/<code>interaction_type</code> are free text, so no technology-specific code is baked into the Runtime Kernel. Independence is achieved only because no real integration exists yet, not because an adapter boundary was built and proven swappable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.1 Every external interaction shall possess a unique identifier<br> Ref: §6 FR-36.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/external_interactions_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.2 Interactions shall occur through Interaction Adapters<br> Ref: §6 FR-36.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:1-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Interaction Adapter exists; interactions are created directly via the API/web route calling <code>createExternalInteraction</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.3 External systems shall never bypass Governance<br> Ref: §6 FR-36.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:92-122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every status transition runs through <code>transitionEngine.evaluate</code> (authority) and <code>qualityGateEngine.evaluate</code> (quality gates) before the row is updated, matching every other governed entity type in the platform.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.4 Interactions shall preserve engineering traceability<br> Ref: §6 FR-36.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:30-34, 41-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>deliverableId</code> is validated to belong to the same SEU, and events carry <code>seuId</code>/<code>originatingObjectId</code>/actor/badge. No link is preserved to a "triggering Event" that caused the interaction to be created (see §14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.5 Interaction failures shall not corrupt engineering state<br> Ref: §6 FR-36.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:124-152</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A transition to <code>Failed</code> only updates the interaction's own <code>status</code> column, publishes <code>InteractionFailed</code>, and raises an Attention Item (Ch.34). No other engineering table is touched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.6 Interaction policies shall be contributed through Packs<br> Ref: §6 FR-36.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:691-744 (<code>requiredPolicyCodes: ["policy-externalinteraction-transition-baseline"]</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A baseline policy code gates every ExternalInteraction transition, consistent with the platform's Pack-contributed policy mechanism used for every other entity type. No interaction-specific policies are contributed by <code>integration-github.pack.json</code> or <code>integration-slack.pack.json</code> (their <code>"policies": []</code> arrays are empty) — only the generic baseline applies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-36.7 Interaction behaviour shall support replacement of external systems without Runtime Kernel modification<br> Ref: §6 FR-36.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>target_system</code> is free text with no adapter abstraction to swap; replacing "GitHub" with another system today means typing a different string, not swapping an Adapter implementation, because no Adapter layer exists (see FR-36.2).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Interaction Categories (Engineering Tool, Enterprise, Cloud, Regulatory, Customer, SEU-to-SEU), extensible via Packs<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/integration-github.pack.json:1-40<br>src/dblayer/seed/data/integration-slack.pack.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>integration-github.pack.json</code>/<code>integration-slack.pack.json</code> contribute Capabilities, authority rules, checklists and review gates for an "Engineering Tool" category integration, but contribute no <code>interaction_type</code>/category vocabulary, and no SEU-to-SEU interaction category is represented anywhere in seed data or code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction Structure: Identifier, Type, Direction, Target System, Purpose, Triggering Event, Payload Reference, Status, Traceability References, Version<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/external_interactions_schema_recovery.sql:3-18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present: <code>id</code>, <code>interaction_type</code>, <code>direction</code>, <code>target_system</code>, <code>purpose</code>, <code>status</code>, <code>author_id</code>/<code>author_badge</code> (partial traceability), <code>deliverable_id</code> (partial traceability). Absent: no <code>triggering_event</code> column, no <code>payload_reference</code> column, no <code>version</code> column anywhere in the table or <code>ExternalInteractionRow</code> type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction Lifecycle: Created → Validated → Dispatched → Acknowledged → Completed → Archived; failed interactions may be retried<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:691-744<br>src/routes/seu/core/externalInteractions.ts:85-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The six states and the <code>Dispatched → Failed</code> branch are wired exactly as specified via <code>transition_definitions</code> rows. No <code>InteractionRetried</code> transition/event exists — the spec's "may be retried" is not implemented; a <code>Failed</code> interaction has no transition back into the lifecycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction Adapters translate engineering ↔ external representations, isolate technology-specific behaviour, remain replaceable<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:1-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>InteractionAdapter</code> type, interface, or implementation exists in the codebase. The file's own header comment states this explicitly as a known, scoped-out gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction Adapters preserve engineering meaning via translation to/from platform Ontology<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No translation code exists because no Adapter exists (§10). <code>interaction_type</code>/<code>target_system</code> are stored as free text with no Ontology-term validation (e.g. no <code>assertCanonicalCategory</code>-style check against a controlled interaction-type vocabulary).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External interactions respect Authority, Policies, Quality Gates, Compliance, EBM; never circumvent governance<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:92-122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority (<code>transitionEngine</code>) and Quality Gates (<code>qualityGateEngine</code>) are enforced on every transition, same as every other governed entity. No distinct "Compliance requirements" or "Engineering Behavior Model" check is invoked specifically for ExternalInteraction beyond the generic policy/quality-gate mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failure handling: preserve state, generate Events, generate Attention Items where appropriate, support retry, remain traceable<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:124-152</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A <code>Failed</code> transition preserves engineering state, publishes <code>InteractionFailed</code>, and raises a Ch.34 Attention Item with category "Exception". Retry is not implemented — no transition out of <code>Failed</code> exists in <code>transition_definitions.json</code>, so a failed interaction is a dead end, not retryable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction traceability: triggering Event, originating object, external target, outcome, timestamp, governing policies, associated Deliverables; history immutable<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/external_interactions_schema_recovery.sql:3-18<br>src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present: external target (<code>target_system</code>), outcome (<code>status</code>), timestamp (<code>created_at</code>/<code>updated_at</code>), associated Deliverable (<code>deliverable_id</code>, singular). Absent: no stored "triggering Event" reference, no stored "originating engineering object" beyond the optional Deliverable link, no stored governing-policy reference on the row. The <code>external_interactions</code> row itself is mutated in place on each transition (<code>UPDATE ... SET status = $1</code>), so row-level history is not immutable — only the separate, append-only <code>events</code> table preserves an immutable trail of what happened.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: InteractionCreated, InteractionValidated, InteractionDispatched, InteractionSucceeded, InteractionFailed, InteractionRetried, InteractionCompleted<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:41-50, 127-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only three event types are actually published: <code>InteractionCreated</code> (on create), <code>InteractionFailed</code> (when <code>targetState === "Failed"</code>), and <code>InteractionCompleted</code> (for every other target state, including <code>Validated</code>, <code>Dispatched</code>, and <code>Acknowledged</code>). <code>InteractionValidated</code>, <code>InteractionDispatched</code>, <code>InteractionSucceeded</code>, and <code>InteractionRetried</code> are never published — a transition from <code>Created</code> to <code>Validated</code> publishes an event literally typed <code>InteractionCompleted</code>, misrepresenting the lifecycle stage reached.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: heterogeneous systems, isolate technologies, async, preserve integrity, extensible via adapters<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Integrity is preserved (§FR-36.5). Heterogeneity/technology isolation hold only incidentally, because no technology-specific integration is implemented. Asynchronous communication and adapter-based extensibility are not implemented (§EI-005, §10).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: external systems never directly modify engineering state<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:85-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed — see EI-002/FR-36.5 findings.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: all interactions occur through Interaction Adapters<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Adapter exists (§10); interactions are created directly by API/web routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: engineering semantics are preserved<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not applicable in a demonstrable sense: no translation occurs because no Adapter exists. Free-text fields carry no semantic validation against the Ontology.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: interaction failures do not corrupt engineering state<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts:124-152</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed — see FR-36.5 finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: interaction history is fully traceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/external_interactions_schema_recovery.sql:3-18<br>src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partial — see §14 finding (no triggering-event/originating-object/governing-policy fields; row itself is mutated, not append-only).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: interaction adapters are independently replaceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Adapter exists to be replaceable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: External Interaction framework, Interaction Adapter framework, Interaction registry, Interaction lifecycle service, External interaction APIs, Interaction events, Adapter development guidelines<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/externalInteractions.ts<br>src/dblayer/externalInteractionsDB.ts<br>src/routes/seu/api/externalInteractions.ts<br>src/routes/seu/web/seus.ts:735-796</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Delivered: External Interaction framework (record model + core service), Interaction lifecycle service (<code>transitionExternalInteraction</code>), External interaction APIs (REST + web form), a subset of Interaction events. Not delivered: Interaction Adapter framework, Interaction registry (a registry of available adapters/target-system types), Adapter development guidelines — none of these exist anywhere in the repository.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 29
- Fully met: 6
- Partially met: 15
- Not met: 8
- Not Verifiable: 0

## Major Implementation Gaps

1. **No Interaction Adapter / Connector layer exists** (§3, §5 EI-003, §6 FR-36.2, FR-36.7, §10, §11, §17, §18). The chapter's central three-layer abstraction (External Interaction → Interaction Adapter → Connector) is explicitly scoped out in the implementation's own header comment. Only the top layer (the governed, traceable record) is built.
2. **Event vocabulary mismatch** (§15). The implementation publishes only `InteractionCreated`, `InteractionFailed`, and `InteractionCompleted` — every non-`Failed` transition (including `Created → Validated` and `Validated → Dispatched`) is published under the event type `InteractionCompleted`, which misrepresents intermediate lifecycle stages. `InteractionValidated`, `InteractionDispatched`, `InteractionSucceeded`, and `InteractionRetried` do not exist in the codebase.
3. **No retry path for `Failed`** (§9, §13). `transition_definitions` has no transition out of `Failed`, so the spec's "Failed interactions may be retried" is not implemented.
4. **Interaction Structure is missing two of ten required fields** (§8): no `triggering_event` and no `payload_reference` column exists on `external_interactions`.
5. **No `Version` field** anywhere on the ExternalInteraction entity, despite §8 requiring it.
6. **Interaction history is not immutable at the row level** (§14): `external_interactions.status` is updated in place on every transition; only the separate `events` table is append-only.
7. **No controlled vocabulary for `interaction_type`/category** (§4, §7, §11): both are free-text strings with no validation against an Ontology-backed set of interaction categories, and no SEU-to-SEU interaction category is represented anywhere.
