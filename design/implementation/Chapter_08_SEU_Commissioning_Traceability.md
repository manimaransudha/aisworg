# Chapter 8 – SEU Commissioning — Implementation Traceability

**Date of report: 4-10-2026**

Code-verified 2026-10-04. Chapter 8 carries its own §22 "Implementation Specifics" (last updated 2026-09-07), which already documents a code-verified audit in detail. This document supersedes §22 where current code has moved past it — notably the event-flow architecture — and otherwise cross-references §22 rather than repeating it. §22 itself is not edited (per the skill's no-spec-modification rule); this file is the up-to-date record.

## Headline finding: §22's own "ebmComposer.ts" narrative is now stale

§22 (2026-09-07) describes Compose EBM as a single asynchronous event-bus consumer, `ebmComposer.ts`/`ebmComposerHandler`, triggered off `CommissionValidated`. No such file exists in the repository today (`src/domain/engine/` has no `ebmComposer.ts`; `ebmComposerHandler` appears only in stale comments, never as a registered handler). The real current flow, per `src/domain/engine/eventHandlerRegistry.ts:37-49`:

1. `validateRequestHandler` (`src/domain/engine/validateRequest.ts:54-157`) consumes `CommissionRequested`, runs the Authority gate + `checkRequestLiveness` (`commissioning.ts:87-137`), and publishes `CommissionValidated` or `CommissionFailed`.
2. Compose EBM itself is **not** event-driven. It is a manual, repeatable, human-triggered web action — `POST /aisworg/seu/objectives/:id/compose-ebm` (`src/routes/seu/web/objectives.ts:777-879`) — calling `previewCommissioningValidation` directly and stashing the result on `seus.composition_report`. This is deliberate ("Apply & re-validate" — a pure recompute, not a transition).
3. Once the human-resolved `compositionConflicts` list is empty, that same web route publishes `CompositionCompleted` itself (`objectives.ts:858-867`), carrying a resolved `authorBadge`.
4. `compositionCompletedHandler` (`src/domain/engine/compositionCompleted.ts`) consumes `CompositionCompleted` and is the sole place `ebmsDB.create()` runs — it creates the EBM row.
5. A human then manually transitions the EBM (`transitionEbm`, `commissioning.ts:636+`) toward `Activated`.
6. `ebmActivatedHandler` (`src/domain/engine/ebmActivated.ts`) consumes `EBMActivated` and calls `finalizeCommissioning` (`commissioning.ts:353-521`) — Create Engineering Assets, then the `Commissioned → Activated` hop and `SEUActivated` publish, with nothing after per the platform's "no code after an event publish" rule.
7. `executionEngineKickoffHandler` (off `SEUActivated`/`ObligationTransitioned`) calls `attemptSeuCommenceWork` (`commissioning.ts:538-611`), which now also raises real Obligations (Policy-based and Pack-Obligation-Definition-based) before allowing `Activated → Operational`.

This is a materially different pipeline shape from §22's description: Compose EBM is human-driven and synchronous-on-request, not an automatic async consumer of `CommissionValidated`; and `CompositionCompleted`/EBM creation sit between two further human gates (resolve conflicts, then Activate), not immediately after `CommissionValidated`. §22's event-count claims and ordering descriptions in §22.2, §22.6, §22.8, §22.14 are accordingly out of date; this file's own table below reflects current code.

## Also contradicted by current code: Obligations ARE now raised

§22.4/§22.10/§22.12/§22.16 (FR-8.10, "Initial Obligation State") state no obligation-creation code exists in this pipeline. This is no longer true. `attemptSeuCommenceWork` (`commissioning.ts:567-603`) calls `raiseObligationForBlockedTransition` (Policy-blocked `Activated→Operational`) and `raiseObligationsForPackDefinitions` (composed Pack's own Obligation Definitions applicable to that same hop), both real DB writes gating the final lifecycle hop. This is narrower than §16's own list (mandatory compliance/governance/review/approval at commissioning time generally) — it fires only at the `Activated→Operational` hop, not at commissioning's start — but it is real, not absent.

---

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning creates an SEU from one Template and one Profile; Template-only commissioning is disallowed<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:198-227</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissionSeu</code> requires at least one Template and exactly one Profile (<code>profileIds.length > 1</code> rejected), and verifies the Profile targets one of the given Templates. Template-only commissioning is impossible — no code path creates an SEU with a Profile unresolved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning is the only mechanism by which an SEU may be created<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:298</code> (<code>seusDB.create</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No other call site in the repository invokes <code>seusDB.create</code>; confirmed by the same finding §22.1 already records.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning validates the request, composes the EBM, allocates runtime resources, establishes governance, creates initial engineering state<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>validateRequest.ts:54-157</code>; <code>objectives.ts:777-879</code>; <code>commissioning.ts:353-521</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Validate and Compose EBM are real (see headline finding); "allocating runtime resources" is real only for the SEU identifier (§22.9, unchanged); "establishing governance" is real via the Authority gate plus the newly-real Obligation raising above, thinner than "governance" implies but not absent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope: commissioning workflow, validation, composition, runtime allocation, participant recruitment, initialisation, activation<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(table rows below)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Workflow/Validation/Composition/Initialisation/Activation are real in some form; Runtime Allocation and Participant Recruitment are not (§22.9, §22.11, unchanged).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural flow: Request → Template+Profile → Composition Engine → EBM → Runtime Allocation → Commissioned SEU<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts</code>; <code>validateRequest.ts</code>; <code>objectives.ts:777-879</code>; <code>compositionCompleted.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The shape holds but is now a multi-hop, multi-human-gate pipeline across several files/events rather than two boxes joined by one arrow: Request → Validate (automatic, event-driven) → Compose (manual, human-triggered, repeatable) → human conflict resolution → <code>CompositionCompleted</code> (human-triggered) → EBM created (event-driven) → human Activate → Engineering Assets created (event-driven). No step from the diagram is skipped, but every arrow after "Template+Profile" is now either human-gated or event-driven rather than one synchronous call, superseding §22.2's own already-partial account.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU begins from a valid engineering foundation; governance established before work begins<br> Ref: §4 Commissioning Objectives</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>validateRequest.ts:86-138</code>; <code>commissioning.ts:573-587</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A failed Authority gate, dead reference, or unresolved composition conflict blocks commissioning (SEU → <code>Failed</code>). A blocked commence-work Policy at <code>Activated→Operational</code> now also raises a real Obligation rather than silently proceeding. "Knowledge repositories initialised" and "traceability begins at SEU creation" remain unmet — no <code>knowledge_items</code> row is ever written by this pipeline (confirmed: no reference to a knowledge-item table in <code>commissioning.ts</code>, <code>validateRequest.ts</code>, <code>compositionCompleted.ts</code>, or <code>objectives.ts</code>'s compose-ebm route); traceability is only as real as the event trail.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Inputs: Authorised Requestor, Engineering Objectives, Profile (Project Metadata, Commissioning Parameters, Templates/Capabilities/Services/Packs)<br> Ref: §5 Inputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:166-227</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Unchanged from §22.4's own table — Template/Profile/Objective/Requestor are real; Commissioning Parameters and Project Metadata are structurally present via <code>profileId</code> but not yet consumed by any composition logic. No change found in this pass.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Optional inputs: existing Knowledge Repository, Deliverables, Legacy Code Base, Ontology, Engineering Assets<br> Ref: §5 Inputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No brownfield-import code path exists anywhere in <code>commissioning.ts</code>/<code>objectives.ts</code>. Unchanged from §22.4.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Outputs: Commissioned SEU, EBM, Deliverable Catalogue, Capability Catalogue, Participant Requirements, Knowledge Repository, Dependency Graph, Obligation Register, Traceability Repository<br> Ref: §6 Outputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:402-475</code> (Deliverables/Capabilities); <code>compositionCompleted.ts:132</code> (EBM)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU, EBM, Deliverable Catalogue, Capability Catalogue are real. Dependency Graph is reused, not freshly produced (unchanged, §22.4). Participant Requirements, Knowledge Repository, and a distinct Traceability Repository remain absent. Obligation Register is now partially real — see the "also contradicted" finding above — but only at the <code>Activated→Operational</code> hop, not as a general commissioning output.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.1 Only authorised users may commission<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>validateRequest.ts:86-119</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real <code>transitionEngine.evaluate</code> Authority/Policy gate, now run inside <code>validateRequestHandler</code> rather than inline in <code>commissionSeu</code> (moved since §22.5, same substance).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.2 Every commissioning request references one Template<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:198,208-213</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required; existence-checked. CR-092 Part 6 allows multiple Templates to be given, with <code>templateIds[0]</code> recorded as primary — a broader-than-"one" structural allowance, but every given Template is still validated and used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.3 Every commissioning request references one Profile<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:199,206,214-227</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required, existence-checked, and now hard-capped at exactly one (<code>profileIds.length > 1</code> rejected) — matches the FR literally, stricter than §6's own plural "Profile consisting of" framing (an existing spec/FR tension already settled per CR-092 Part 6's reversal, not a new finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.4 Validate mandatory Packs before composition<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:87-137</code>; <code>validateRequest.ts:121-138</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>checkRequestLiveness</code> checks every mandatory/selected Pack code's Active status before <code>CommissionValidated</code> is published, i.e. before Compose EBM can be invoked at all. Unchanged in substance from §22.5's updated finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.5 Composition Engine produces exactly one EBM<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionCompleted.ts:132</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One <code>ebmsDB.create</code> call per <code>CompositionCompleted</code> event, no loop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.6 Commissioning fails if behavioural conflicts remain unresolved<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>objectives.ts:841,851-868</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionConflicts.length === 0</code> gates whether <code>CompositionCompleted</code> is published at all; a non-empty conflict list simply re-renders the resolution page without ever reaching EBM creation. Functionally equivalent to failing — no <code>CommissionFailed</code> event fires for this specific case, it instead sits open and human-visible rather than terminating.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.7 Allocate runtime resources only after successful composition<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:298</code> (<code>seusDB.create</code>, before Validate Request)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Violated, unchanged — the SEU identifier (the only real "runtime resource", §22.9) is created before Validate Request and Compose EBM even run, not after. Same headline finding §22 already records at the top of its own §22.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.8 Initialise Knowledge Repository<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>knowledge_items</code> write exists anywhere in this pipeline (confirmed above). Unchanged from §22.5.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.9 Initialise Dependency Graph<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:414-420</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliberately reused from Template-authoring time, not freshly initialised per SEU — a documented design decision, unchanged from §22.5.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.10 Initialise Obligation Register<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:582-603</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No longer fully unmet: real Obligations are now raised at the <code>Activated→Operational</code> hop (Policy-blocked and Pack-Obligation-Definition-based). Narrower than "initialise...at commissioning" implies — nothing is raised earlier in the pipeline, and only when that specific hop is actually blocked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.11 Complete traceability before execution begins<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">event publishes throughout <code>commissioning.ts</code>, <code>validateRequest.ts</code>, <code>compositionCompleted.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real via the event trail (<code>correlationId</code>/<code>causationId</code> chained across every publish) — not a dedicated traceability service or repository. Same basis as §22.5.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-8.12 No engineering work begins until commissioning completes successfully<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:402-475</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables/Capabilities are only created inside <code>finalizeCommissioning</code>, itself only reachable via a successfully-created, successfully-composed EBM reaching a human Activate. A rejected or stalled commission creates neither.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning Workflow stages (Request→Validate→Resolve Template/Profile/Packs→Compose EBM→Validate Engineering Model→Allocate Runtime→Create Engineering Assets→Recruit Participants→Activate→Ready for Execution)<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts</code>; <code>validateRequest.ts</code>; <code>objectives.ts:777-879</code>; <code>compositionCompleted.ts</code>; <code>ebmActivated.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Request/Validate/Resolve Template+Profile/Compose EBM/Create Engineering Assets/Activate are all real, per the headline finding's step-by-step mapping. Resolve Packs stays folded inside Compose EBM, not an independent step (unchanged). Validate Engineering Model is real as a distinct human-gated <code>transitionEbm</code> hop (<code>Composed→Validated</code>), matching §22.6's updated finding. Allocate Runtime remains out of order (SEU row created first) and functionally unbuilt. Recruit Participants remains entirely absent. "Ready for Execution" is never a literally-named lifecycle state — the real terminal state is <code>Operational</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Request Validation: Template/Profile existence, user authorisation, Pack availability, version compatibility, commissioning parameters, mandatory configuration<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>validateRequest.ts:54-138</code>; <code>commissioning.ts:87-137</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Template/Profile existence, Authority, and Pack availability (via liveness) are real. "Version compatibility" as a distinct concept from "does an Active version exist" is not checked. Commissioning parameters and mandatory configuration are not validated — neither is consumed as an input at all (per §5 finding above). Validation failures do produce a structured list (<code>LivenessCheck[]</code>) surfaced on the Validate page, closer to a real diagnostic than a single string.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Composition: discover Packs, resolve dependencies, compose behaviour, validate behaviour, produce EBM; no runtime resources allocated before successful composition<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>objectives.ts:777-879</code>; <code>profileCompositionUnravel.ts</code> (<code>unravelComposition</code>/<code>detectCompositionConflicts</code>); <code>compositionCompleted.ts:132</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Discover/resolve/compose/validate/produce are all real, now split across a human-triggered recompute route and an event-driven EBM-creation handler rather than <code>compositionEngine.compose()</code> (confirmed: no call to <code>compositionEngine.compose()</code> found anywhere in <code>commissioning.ts</code> or <code>objectives.ts</code>). "No runtime resources allocated before successful composition" is violated by the same FR-8.7 finding — the SEU identifier already exists long before this stage runs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Allocation: SEU identifier, runtime services, event channels, configuration, persistence, security context, observability context; allocated only after successful composition; Runtime Kernel independent of engineering behaviour<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:298</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Unchanged from §22.9: only the SEU identifier is real, and it is created before composition, not after. No per-SEU runtime service, event channel, security context, or observability context is provisioned anywhere in the codebase.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Asset Initialisation: Deliverable Catalogue, Capability Catalogue, Role Catalogue, Knowledge Repository, Dependency Graph, Obligation Register, Traceability Repository<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:402-475</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable Catalogue and Capability Catalogue are real (<code>deliverablesDB.create</code> per entry with resolved producing-Capability; <code>seuCapabilitiesDB.createMany</code>). Role Catalogue: no <code>Role</code> entity exists anywhere in the codebase. Knowledge Repository: not initialised. Dependency Graph: reused, not initialised fresh. Obligation Register: real only at <code>Activated→Operational</code>, not here. Traceability Repository: no distinct entity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant Recruitment: determines which Participants provide Template-defined capabilities; AI/Human/External; automatic/manual/hybrid; does not modify the EBM<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Entirely unbuilt within commissioning — confirmed no <code>participants</code>/<code>seuParticipants</code>-style row-creation call exists in <code>commissioning.ts</code>, <code>validateRequest.ts</code>, <code>compositionCompleted.ts</code>, or <code>finalizeCommissioning</code>. Unchanged from §22.11: participants are attached later via <code>fulfilCapability</code>, a separate mechanism outside this pipeline. Commissioning produces the Capability *requirement* only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Initial Deliverable State: Planned / Awaiting Dependency Resolution / Awaiting Human Input / Awaiting External Asset / Ready<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:462-475</code> (<code>deliverablesDB.create</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are created, but no per-Deliverable initial state from this named set is asserted at creation time here — whatever <code>deliverablesDB.create</code>'s own default status is applies uniformly. Unchanged from §22.12.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Initial Knowledge State: commissioning metadata, Template/Profile/EBM references, Pack references, composition report, commissioning decisions<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>knowledge_items</code> row is created. The equivalent data exists only in <code>CommissioningReport</code> (<code>commissioning.ts:483-496</code>) and the <code>seus</code> row's own FK columns, never copied into a Knowledge Repository. Unchanged from §22.12.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Initial Obligation State: obligations from mandatory compliance/governance/review/required approvals/unresolved recommendations<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:573-603</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Narrower than specified but no longer absent: Obligations are raised when a commence-work Policy blocks <code>Activated→Operational</code>, or when a composed Pack's own Obligation Definitions apply to that hop. Nothing is raised from "mandatory compliance/governance/review" generically, and nothing fires at commissioning time proper (only at this one later hop).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning Report: Identity, Composition, Validation, Runtime, Traceability sections<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:483-496</code>; <code>seuTypes.ts:613-632</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Four of five named sections exist (<code>identity</code>, <code>composition</code>, <code>runtime</code>, <code>validation</code>); Traceability is entirely absent from the real type. <code>validation.errors</code> is hardcoded to <code>[]</code> — nothing populates it; composition warnings/conflicts are raw arrays, not the named "Composition summary"/"Behaviour summary" fields. Pack versions, Manual resolutions, Outstanding recommendations, Participants recruited, Runtime services allocated, and Initial Obligations are all absent fields. Identity now also carries <code>templateCodes</code>/<code>profileCodes</code> (plural, CR-092 Part 6) beyond what §17 names. Unchanged in substance from §22.13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: CommissionRequested, CommissionValidated, CompositionStarted, CompositionCompleted, RuntimeAllocated, KnowledgeInitialised, ParticipantsRecruited, SEUActivated, CommissionCompleted, CommissionFailed<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts:312</code>; <code>validateRequest.ts:140-156</code>; <code>objectives.ts:858-867</code>; <code>commissioning.ts:516-519</code>; <code>validateRequest.ts:41-51,107-117,126-136</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>CommissionRequested</code>, <code>CommissionValidated</code>, <code>CompositionCompleted</code>, <code>SEUActivated</code>, and <code>CommissionFailed</code> are real and exact-name matches. <code>CompositionStarted</code> is **not found** in current code (the file that used to publish it, the now-nonexistent <code>ebmComposer.ts</code>, is gone; no replacement publishes it) — a regression from §22.14's own "6 of 10" count. <code>RuntimeAllocated</code>, <code>KnowledgeInitialised</code>, and <code>ParticipantsRecruited</code> remain unpublished, consistent with the corresponding sections above. <code>CommissionCompleted</code> as a distinct terminal event still does not exist — the pipeline's last event is <code>SEUActivated</code>, then eventually <code>SEUOperational</code> (<code>commissioning.ts:607</code>). Net: 5 of 10 named events real as of this pass, down from §22.14's own "6 of 10," because <code>CompositionStarted</code>'s publisher was removed along with <code>ebmComposer.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: deterministic, repeatable, fully auditable, preserve complete traceability, support concurrent commissioning, support rollback upon failure<br> Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>objectives.ts:777-879</code> (Compose EBM recompute); event publishes throughout</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic/repeatable hold (no randomness; recompute is pure over inputs). Concurrent commissioning holds (no shared mutable state between calls). Fully auditable and complete traceability remain partial, same basis as FR-8.11/§22.15. Rollback on failure: still no compensating logic anywhere — a failure partway through <code>finalizeCommissioning</code> (e.g. mid-loop) leaves already-created Deliverables/Capabilities in place. Unchanged from §22.15.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: authorised commission, EBM composed, runtime after composition, assets created, participants recruited, report generated, Ready for Execution reached<br> Ref: §20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authorised commission ✅. EBM composed ✅. Runtime-after-composition 🚩 (FR-8.7). Assets created ⚠️ (Deliverables/Capabilities yes; Role/Knowledge/Obligation-at-commissioning/Traceability no). Participants recruited 🚩. Report generated ⚠️ (thinner than specified). "Ready for Execution" ⚠️ — real terminal state is <code>Operational</code>, never literally named this. Unchanged from §22.16.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Commissioning Service, Commissioning Workflow, Commissioning Validation Service, Runtime Allocation Service, Participant Recruitment Service, Commissioning Report Generator, Commissioning APIs, Commissioning Events<br> Ref: §21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commissioning.ts</code> (whole file); <code>validateRequest.ts</code>; <code>compositionCompleted.ts</code>; <code>ebmActivated.ts</code>; <code>src/routes/seu/api/*</code>; <code>src/routes/seu/web/objectives.ts</code></td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning Service and Commissioning APIs are real. Commissioning Workflow is real but now spread across one core file plus three event handlers plus a web route, not the three separate services §21 names as distinct deliverables (Validation/Runtime-Allocation/Participant-Recruitment Service) — Commissioning Validation Service exists as a named function (<code>checkRequestLiveness</code>) inside a handler, not a standalone service; Runtime Allocation Service is just <code>seusDB.create</code>; Participant Recruitment Service does not exist. Commissioning Report Generator is real (inline construction). Commissioning Events: 5 of 10 real, per the §18 finding above.</td>
    </tr>
  </tbody>
</table>
---

## Summary

Total intents analysed: 28

- Fully met: 8
- Partially met: 15
- Not met: 5
- Not verifiable: 0

Major implementation gaps (current, superseding §22 where noted):

- **§22's own "ebmComposer.ts" narrative is stale.** Compose EBM is a manual, human-triggered, repeatable web action (`objectives.ts` `/compose-ebm`), not an automatic event-bus consumer of `CommissionValidated`. There is no file named `ebmComposer.ts`; `ebmComposerHandler` exists only as a name in comments. EBM creation itself happens inside `compositionCompletedHandler`, off a `CompositionCompleted` event the web route publishes directly.
- **`CompositionStarted` regressed to unpublished.** It was real as of §22.14's 2026-09-07 update (published from the now-deleted `ebmComposer.ts`); no current code publishes it.
- **Runtime Allocation (§11, FR-8.7) remains fundamentally unbuilt and out of order.** The SEU identifier is created before Validate Request/Compose EBM, not after; no other named runtime resource (service, event channel, security/observability context) is per-SEU allocated anywhere.
- **Participant Recruitment (§13) remains entirely absent** from the commissioning pipeline.
- **Knowledge Repository initialisation (§8.8/§15) remains entirely absent.**
- **Obligation Register (§8.10/§16) is no longer entirely absent** — real Obligations are now raised at the `Activated→Operational` hop (Policy-blocked, and Pack Obligation Definitions), a genuine build since §22 was last updated, though narrower than the specification's "at commissioning" framing.
- **Commissioning Report (§17) stays four of five sections**, several named fields unpopulated (Pack versions, Manual resolutions, Outstanding recommendations, Participants recruited, Runtime services allocated, Initial Obligations, the entire Traceability section).
