# Book 3 Refined – Events and Lifecycle States Catalog

This document consolidates all Lifecycle States, Transitions  and Events defined across all chapters of *Book 3 (Refined)* specification for the `aisworg` application.

Versioning - no: implies, there is no VersionCreated event. Revisions are allowed, but they are not traceable. 

## ✅ Chapter 1 – Objective
 
### States and transitions

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge  
--|-----|-----|-----|-----|-----|----|----- 
1. | When a new objective is created | New | No | No | Proposed | None | objective_propose 
2. | Editing a proposed objective | Edit | No | No | Proposed | None | objective_propose 
3. | Send for Validation | Queue to Validate | Yes | VersionCreated | Proposed | ObjectiveProposed | objective_propose 
4. | Reject an objective | Reject | Yes | No | Proposed | ObjectiveRejected | objective_validate 
5. | Validate an objective | Validate | Yes | VersionValidated  | Validated | ObjectiveValidated | objective_validate  
6. | Activate an objective | Activate | Yes | VersionActivated | Activated | ObjectiveActivated | objective_activate  
7. | Supersede an objective | Supersede | Yes | VersionSuperseded  | Superseded | ObjectiveSuperseded | objective_supersede 
8. | Retire an objective | Retire | Yes | VersionDeprecated  | Retired | ObjectiveRetired |objective_retire 
9. | Achieve an objective | Achieved | Yes | VersionPublished | Achieved | ObjectiveAchieved| governed 
10. | Archive an objective | Archived | Yes | VersionArchived  | Activated | ObjectiveArchived | objective_activate 

### Implementation

No. | Implementation details   
--|-----
1. | 
2. | 
3. | 
4. | 
5. | 
6. | 
7. | Supersede is allowed on objective that has an active SEU. The parent should have the lifecycle state "superseded". SEU has to be versioned up and tied to the new objective id. Superseded has to be based on an engineering decision. Implementation defered.
8. | Retire is on objective that does not have an active SEU. Implementation defered.
9. | Not implemented yet
10. | Not implemented yet
  
---

## Chapter 2 – Software Engineering Unit (SEU)
 
Every SEU shall transition through the following lifecycle.

```
Requested

↓

Engineering Behavior Composition

↓

Commissioned

↓

Executing

↓

Monitoring

↓

Completing

↓

Knowledge Preservation

↓

Archived
```

### Requested

The project objective has been defined.

No runtime resources exist.


### Engineering Behavior Composition

The Composition Engine constructs the Engineering Behavior Model.

No participants are active.


### Commissioned

Runtime resources are allocated.

Capabilities become available.

Participants may be recruited.


### Executing

The SEU performs engineering work.

The Dependency Engine continuously evaluates execution readiness.


### Monitoring

The SEU continuously evaluates:

- dependency health;
- engineering obligations;
- governance;
- knowledge completeness;
- execution flow.


### Completing

Outstanding work reaches a terminal state.

Knowledge is consolidated.


### Knowledge Preservation

Knowledge, evidence and traceability are finalised for long-term reuse.


### Archived

The SEU becomes read-only.

Runtime execution ceases.

Knowledge remains accessible.

### 3. Subsystem Events

The SEU shall publish domain events.

Examples include:

- SEUCommissioned
- DeliverableReady
- WorkItemStarted
- WorkItemCompleted
- DependencySatisfied
- DependencyBlocked
- ObligationRaised
- ObligationResolved
- KnowledgeAccepted
- KnowledgeArchived
- SEUArchived

### States and transitions — reached via Chapter 8 (SEU Commissioning), which has no entity of its own

Chapter 8 (SEU Commissioning) — the chapter this pass was actually asked to cover — names no entity of its own (confirmed: Events and Lifecycles.md always said "No explicit entity lifecycle section defined in this chapter" for it, and its own §18 events are process milestones published directly from code, not backed by any `transition_definitions` row). It **drives** this chapter's own real, governed SEU lifecycle instead — the table below is Chapter 2's, reached through Chapter 8's commissioning workflow.

**Versioning is No on every row, deliberately, confirmed with the owner (2026-09-11)**: `seus.lifecycle_state` is a runtime EXECUTION lifecycle — a single instance moving through states — not the definition/authoring lifecycle (Draft → Validated → Published → Active, a reusable versioned catalog entry) this document's Revision-vs-Version distinction is about. Chapter 8 (SEU Commissioning) itself is confirmed the same way — not a versioning-relevant chapter at all.

The chapter's own §6 narrative lifecycle (Requested → Engineering Behavior Composition → Commissioned → Executing → Monitoring → Completing → Knowledge Preservation → Archived, above) does not match what's actually built — Chapter 2 §19.5 already covers that divergence in full and isn't re-derived here. The table below is the real, live `transition_definitions WHERE entity_type='SEU'` graph, which itself is **two chains**, not one:

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | Commissioning gate — may this actor commission at all | (gate only) | Yes | No | *(no state change from this row)* | None (see note) | seu_commission
2. | Infrastructure provisioning begins | Configure | Yes | No | Configured | SEUConfigured | none declared (ungoverned for MVP)
3. | Configuration complete | Commission | Yes | No | Commissioned | SEUCommissioned | none declared
4. | Create Engineering Assets complete | Activate | Yes | No | Activated | SEUActivated | none declared
5. | Ready for Execution | Operationalise | Yes | No | Operational | SEUOperational | none declared

Row 1 (`Pending → Commissioned`, verb `commission`) is `validateRequestHandler`'s own Authority/Policy gate (`core/commissioning.ts`'s original, pre-CR-092 row) — real and evaluated on every commission, but no event is ever published off *this row's own outcome*: a pass only lets Validate Request proceed; the actual advance to `Commissioned` status happens later, via row 3. `event_type` is deliberately left null here — nothing would ever read it.

Rows 2–5 are `finalizeCommissioning`'s own `PRE_ASSETS_STEPS` cascade plus its final hop — real, and now reading `event_type` from this table (migration 189) instead of an ad hoc `` `SEU${toState}` `` string built at call time, mirroring every other entity's own fix. Ungoverned for MVP (no Authority Rule/Policy declared on these rows in the seed data) but still routed through `transitionEngine` so the mechanism is real, not bypassed.

**A second, deliberately dormant chain exists in the same table**, added by CR-092 Part 4 as vocabulary only — *"this has to be just a change to the transition definition for now... No code wiring yet"* — and re-deferred by Part 9: `Pending → Validated → Composed → RuntimeAllocated → KnowledgeInitialised → ParticipantsRecruited → Commissioned`. No code anywhere calls `transitionEngine.evaluate` for any of these hops today; `event_type`/`version_event` both stay null on all six, not a gap this pass closes — wiring them up (or retiring the dormant chain, or the original `Pending→Commissioned`/`Configured→Activated` alternate rows also sitting unused in the same table) is a future CR's own decision, per Part 4's own explicit deferral.

`Operational → Suspended`, `Operational → Retired`, `Suspended → Retired`, `Suspended → Operational`, and `Retired → Archived` are real rows in the vocabulary too, but Chapter 37 (SEU Lifecycle Management) territory — entirely unbuilt, no code calls any of them either. Not part of this pass.

### Implementation

No. | Implementation details
--|-----
1. | Implemented (`validateRequestHandler`, `domain/engine/validateRequest.ts`) — gate only, as described above.
2.-5. | Implemented (`finalizeCommissioning`, `core/commissioning.ts`). **Gap found and fixed**: `event_type` was NULL for all four despite the code already publishing the exactly-right event name — it derived the string directly from `toState` instead of reading it from the resolved Transition Definition. Migration 189 populates the columns; the cascade and its final hop now read `step.eventType`/`finalStep.eventType` (with the same string kept as a fallback) instead. Also fixed the identical latent `entityId`-not-passed-to-`evaluate` gap on both call sites.
Dormant chain | Deliberately untouched, per CR-092 Part 4/9's own explicit deferral — not this pass's job to wire up.
Suspend/Retire/Archive | Deliberately untouched — Chapter 37 territory, unbuilt.

---

## Chapter 3 – Engineering Behavior Model (EBM)

*EBM is not a lifecycle entity. The entity it represents is the SEU.* **Superseded 2026-09-07, CR-092 Part 9 — this is no longer accurate.** A real, governed `entity_type='EBM'` lifecycle now exists in `transition_definitions` (`Composed → Validated → Active`, plus `Composed → Retired`), with its own `transitionEbm` function (`core/commissioning.ts`) and independently human-triggered Validate/Activate actions — not folded into the SEU's own transitions. Left here rather than silently deleted, per this document's own convention of recording corrections in place; the annotation was true when written and the code has since moved past it.

### 3. Subsystem Events

The platform shall publish at least the following domain events:

- EBMCreated
- EBMValidated
- EBMVersioned
- EBMActivated
- EBMRetired
- BehaviourConflictDetected
- BehaviourConflictResolved

### States and transitions — reached via Chapter 8 (SEU Commissioning)

**Versioning is No on both real rows, deliberately, confirmed with the owner (2026-09-11) and already on record from CR-092 Part 9 itself** — owner: *"did i not say version is not part of validation"*. `EBMVersioned` (above) is its own separate, not-yet-built concern (re-composition producing a new `ebms` row for the same SEU — "this pass never produces a second EBM version for the same SEU," CR-092 Part 9's own words) — never Validate's or Activate's.

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | EBM composed by `ebmComposer.ts`, off `CommissionValidated` | New | No | No | Composed | EBMCreated | none declared (system-composed, not human-authored)
2. | A human validates a Composed EBM | Validate | Yes | No | Validated | EBMValidated | none declared (manual/ungoverned by design)
3. | A human activates a Validated EBM | Activate | Yes | No | Active | EBMActivated | none declared
4. | Validate finds a dead reference (Pack/Ontology retired since composition) | (system, on Validate attempt) | Yes | No | Retired | EBMRetired | *(no verb — see Implementation)*

Row 1 is `ebmsDB.create`'s own creation, mirroring Objective's/Pack's "New = pure Revision" shape — no `transition_definitions` row applies to creation itself.

### Implementation

No. | Implementation details
--|-----
1. | Implemented (`ebmComposer.ts`, an event-bus consumer off `CommissionValidated`, not human-authored).
2.-3. | Implemented (`transitionEbm`, `core/commissioning.ts`). **Gap found and fixed**: `event_type` was NULL for both despite a working hardcoded ternary (`targetState === "Validated" ? "EBMValidated" : ...`) already in code. Migration 189 populates the columns; `transitionEbm` now reads `gate.eventType` instead, the ternary removed — mirrors every other entity's own fix. Also fixed the identical latent `entityId`-not-passed-to-`evaluate` gap.
4. | Implemented (`transitionEbm`'s own `checkEbmLiveness` branch), but this row has no verb at all (checked directly) and is never reached via `transitionEngine.evaluate` for this specific hop — `EBMRetired` is published as a direct, hardcoded literal from that branch, a genuine system-triggered side effect of attempting *Validate*, not its own gated transition. `event_type` deliberately stays null — nothing would ever read it.

---

## Chapter 4 – Composition Engine

### 1. Entity Overview
- **Chapter:** [Chapter 4.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 4.md)

### 2. Lifecycle States & Transitions

Every composition shall progress through the following stages.

```
Collect Inputs

↓

Resolve Dependencies

↓

Validate Packs

↓

Compose Behaviour

↓

Detect Conflicts

↓

Resolve Conflicts

↓

Validate Model

↓

Version Model

↓

Activate Model
```

Failure at any stage shall terminate the composition process.

### 3. Subsystem Events

The Composition Engine shall publish domain events including:

- CompositionStarted
- DependencyResolved
- DependencyFailed
- PackValidated
- BehaviourComposed
- ConflictDetected
- ConflictResolved
- CompositionValidated
- EBMCreated
- EBMActivated
- CompositionFailed

---

## ✅ Chapter 5 – Pack Model
 

 Current lifecycle: **Draft → Validated → Published → Active → Retired → Archived**, plus a **Validated → Draft (Reject)** 
  

### States and transitions

Corrected against Book 3 (Refined) Part 1, Chapter 5 §11/§15/§19.3/§19.13 — the previous version of this table had wrong badges on rows 4/6, a missing Retired→Archived row, and rows 9-10 carrying leftover Objective content (an "Achieved" state Pack does not have). Chapter 5's own six-state lifecycle (§11) is: Draft → Validated → Published → Active → Retired → Archived, plus Validated → Draft (Reject).

No Queue to Validate / submit step for Pack (owner: "There is no Queue to Validate in pack. I do not think it is necessary because the transition buttons are sufficient to pass it further in the lifecycle") — considered, and deliberately not built, unlike Objective's Proposed→Active. `VersionCreated` therefore has no separate row here: Draft→Validated (row 3 below) is both the first governed hop AND the point a Draft stops being freely editable (Edit is Draft-only), so `VersionValidated` alone covers it.

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge  
--|-----|-----|-----|-----|-----|----|----- 
1. | When a new pack is created | New/Copy | No | No | Draft | PackRegistered | pack_define (not yet enforced — see Implementation) 
2. | Editing a draft pack | Edit | No | No | Draft | None | pack_define
3. | Validate a pack | Validate | Yes | VersionValidated | Validated | PackValidated | pack_validate  
4. | Reject a pack | Reject | Yes | No | Draft | PackRejected | pack_reject 
5. | Publish a pack | Publish | Yes | VersionPublished | Published | PackPublished | pack_publish  
6. | Activate a pack | Activate | Yes | VersionActivated | Active | PackActivated | pack_activate  
7. | Retire a pack | Retire | Yes | VersionDeprecated | Retired | PackRetired | pack_retire 
8. | Archive a pack | Archive | Yes | VersionArchived | Archived | PackArchived (code-level; not listed in §15 — likely a spec omission, not a code bug) | pack_archive

§15 also names **PackDependencyResolved** / **PackDependencyFailed** — real chapter events, but not tied to any single lifecycle-state hop (they fire from Composition Engine dependency resolution, cross-cutting, not a Pack transition) and not represented as rows here for that reason. Per §19.9, dependency resolution itself is not built, so neither event is ever published today.

### Implementation

No. | Implementation details   
--|-----
1. | Creation (`createPackDraft`) is not badge-gated today. Per §19.13 this is a platform-wide gap (the `define` birth-transition isn't wired for ANY entity yet), not Pack-specific — same as Objective's own `createObjective`.
2. | `sdkAuthoring.ts`'s `canEdit = canDefine && isDraft` gates the only real write path, Draft-status Packs only.
3. | Implemented. `transitionPack` now passes `entityId` to `transitionEngine.evaluate` (was missing — a latent bug, harmless today with no Pack transition declaring a `submit_verb`, but would have silently blocked one if it ever did).
4. | Implemented (`transitionPack`, reading `event_type` off the resolved Transition Definition — replaces the old hardcoded `EVENT_BY_TARGET_STATE` map). Badge corrected from the table's previous (wrong) `pack_validate` to the real `pack_reject` (§19.13).
5. | Implemented. Badge corrected from the table's previous (wrong) `pack_validate` to the real `pack_publish` (§19.13).
6. | Implemented.
7. | Implemented.
8. | Implemented (`Retired → Archived`, badge `pack_archive`) but had no row in this table before this correction.
  
   
---

## ✅ Chapter 6 – Template Model

### 1. Entity Overview
- **Chapter:** [Chapter 6.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 6.md)

### 2. Lifecycle States & Transitions

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

Chapter 6 §15's own seven-state lifecycle is: Draft → Validated → Published → Active → Deprecated → Retired → Archived — no Reject/submit step (Ch.6 §20.2, mirroring Pack's own "no Queue to Validate" decision, not Objective's Proposed→Active submit). Already built in full, CR-024/025/026 (Ch.6 §20.2/§20.3/§20.4/§20.10) — this table corrects/completes it against Version Feature Plan.md's own discipline (transition_definitions.event_type/version_event as data, migration 185).

### States and transitions

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | When a new Template is created | New | No | No | Draft | TemplateCreated | template_define (not yet enforced — see Implementation)
2. | Editing a Draft Template | Edit | No | No | Draft | None | template_define
3. | Validate a Template | Validate | Yes | VersionValidated | Validated | TemplateValidated | template_validate
4. | Publish a Template | Publish | Yes | VersionPublished | Published | TemplatePublished | template_publish
5. | Activate a Template | Activate | Yes | VersionActivated | Active | TemplateActivated | template_activate
6. | Deprecate a Template | Deprecate | Yes | VersionDeprecated | Deprecated | TemplateDeprecated | template_deprecate
7. | Retire a Template | Retire | Yes | VersionSuperseded | Retired | TemplateRetired | template_retire
8. | Archive a Template | Archive | Yes | VersionArchived | Archived | TemplateArchived | template_archive
9. | Reactivate a terminal Template (Deprecated/Retired/Archived → Active) | Activate | Yes | — (see note) | Active | TemplateActivated (published by the new Version's own row-5 hop, not by this row) | template_activate

**Fixed (owner: "templates.status defaults to 'Active' - this should be draft; similar to pack").** Row 1's "Lifecycle State" used to be **Active**, not Draft — a real, surprising asymmetry against both Pack and Objective, found while building the DRIVEN tests below: `templates.status` defaulted to `'Active'` (`packs.status` defaults to `'Draft'`), and `publishTemplate` (row 1's function) relied on that default, creating an already-Active row directly with a single `TemplateCreated` event and no real Validate/Publish/Activate hops underneath it. Rebuilt to mirror Pack exactly (migration 186, `core/templates.ts`): `publishTemplate` now creates a real Draft (`templatesDB.createDraft`), fires `TemplateCreated`, then walks it through rows 3-5 for real via `advanceTemplateOneStep` — a single call now fires all four events (`TemplateCreated`, `TemplateValidated`, `TemplatePublished`, `TemplateActivated`) in order, under a real actor. The column's own DEFAULT is 'Draft' now too (defense-in-depth, matching Pack), though nothing relies on it — both real INSERT paths (`createDraft`, and `upsert`'s own now-explicit `'Active'`, used only by raw DB-layer test fixtures that want an immediately-usable row with no lifecycle walk) specify status explicitly. **Profile had the identical gap** (`profiles.status` also defaulted to `'Active'`, `publishProfile` relied on it the same way) — fixed the same way in the same pass, `core/profiles.ts`'s `publishProfile` now walking through `advanceProfileOneStep`, since both nouns share one authoring pipeline (Ch.6 §20.1).

Row 9 is three real `transition_definitions` rows (`Deprecated→Active`, `Retired→Active`, `Archived→Active`, all verb `activate`), collapsed to one table row because they behave identically: `transitionTemplate` never calls `updateStatus` for any of them — it branches to `reactivateAsNewVersion`, which creates a brand-new Draft at the next available patch version and walks it through rows 3-5 for real, then deprecates whatever was previously Active. These three rows exist purely as the authority gate for that branch; none of them carries an `event_type`/`version_event`, and none ever could (nothing is ever published "as" a Deprecated→Active transition — the new Version's own Validated/Published/Active events cover it).

Template's real state names diverge from Chapter 41 §15's generic seven-stage vocabulary at exactly one position: Chapter 41 says `...Active → Deprecated → Superseded → Archived`; Template's own chapter (§15) says `...Active → Deprecated → Retired → Archived`. Per this document's own governing rule, the entity's own state NAME wins (the lifecycle state stays "Retired", never renamed to "Superseded") — but row 7's **Version event** is still drawn from Chapter 41's fixed seven-name vocabulary, and by direct positional correspondence (both chains are seven stages, in the same order, diverging only in this one label) that position's event is `VersionSuperseded`, not a fabricated eighth name. This is the first entity built so far with both a real Deprecated and a real Retired state as two distinct hops — recorded as a judgment call (migration 185's own header carries the same note), not a precedent copied from Objective or Pack.

### Implementation

No. | Implementation details
--|-----
1. | `publishTemplate` is not badge-gated today (it takes an `actorRole`/`actorId` for its own internal governed hops, but nothing gates the call itself) — the same platform-wide "`define` birth-transition isn't wired for ANY entity yet" gap as Pack/Objective (Ch.5 §19.13). The separate interactive-authoring creation path (`createAuthoringDraft`, `POST /aisworg/seu/sdk/:slug`) IS gated by `requireDefineBadge()`, but — per Ch.6 §20.10 and row 1's own note above — does not publish `TemplateCreated` (the same asymmetry Pack's `createAuthoringDraft` vs `createPackDraft` already has). **Fixed alongside this table's own correction**: `publishTemplate` now creates a real Draft and walks it to Active via real governed transitions (see row 1's note above), rather than relying on `templates.status`'s default to skip straight to Active.
2. | `sdkAuthoring.ts`'s `canEdit = canDefine && isDraft` gates the only real write path, Draft-status Templates only.
3. | Implemented (`transitionTemplate`). **Gap found and fixed**: `transitionEngine.evaluate` was being called without `entityId` — the same latent bug this document's own Pack Implementation row 3 already flagged and fixed for Pack; harmless today (no Template row declares `submit_verb`) but would have silently blocked a future one. Fixed alongside this table's own correction.
4. | **Gap found and fixed** — `transition_definitions.event_type`/`.version_event` were NULL for every Template row (checked directly against the live DB before this pass); `transitionTemplate` was still publishing via a hardcoded `EVENT_BY_TARGET_STATE` map (CR-025) instead of reading `event_type` off the resolved Transition Definition. Migration 185 populates the columns (matching this table); `core/templates.ts` now reads `gate.eventType` instead, the map removed — mirrors Pack's own migration-184 fix exactly.
5. | Implemented.
6. | Implemented.
7. | Implemented.
8. | Implemented.
9. | Implemented (CR-024/026's `reactivateAsNewVersion`). Gate-only, as described above — never itself the origin of a published event.

### 3. Subsystem Events

The Template subsystem shall publish:

- TemplateCreated
- TemplateValidated
- TemplatePublished
- TemplateActivated
- TemplateDeprecated
- TemplateRetired
- TemplateArchived *(built, CR-025 — §16's own text omits this one; Ch.6 §20.10 treats that as the same oversight Pack's chapter doesn't repeat, not a deliberate difference)*

---

## ✅ Chapter 7 – Profile Model

### 1. Entity Overview
- **Chapter:** [Chapter 7.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 7.md)

### 2. Lifecycle States & Transitions

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

Chapter 7 §14's own seven-state lifecycle is byte-for-byte identical to Template's (Ch.6 §15): Draft → Validated → Published → Active → Deprecated → Retired → Archived — no Reject/submit step, same as Pack/Template (§19.1). Already built in full, same day as Template's own build (§19.1/§19.2/§19.3/§19.9) — this table corrects/completes it against Version Feature Plan.md's own discipline (transition_definitions.event_type/version_event as data, migration 187), mirroring Chapter 6's identical pass exactly.

### States and transitions

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | When a new Profile is created | New | No | No | Draft | ProfileCreated | profile_define (not yet enforced — see Implementation)
2. | Editing a Draft Profile | Edit | No | No | Draft | None | profile_define
3. | Validate a Profile | Validate | Yes | VersionValidated | Validated | ProfileValidated | profile_validate
4. | Publish a Profile | Publish | Yes | VersionPublished | Published | ProfilePublished | profile_publish
5. | Activate a Profile | Activate | Yes | VersionActivated | Active | ProfileActivated | profile_activate
6. | Deprecate a Profile | Deprecate | Yes | VersionDeprecated | Deprecated | ProfileDeprecated | profile_deprecate
7. | Retire a Profile | Retire | Yes | VersionSuperseded | Retired | ProfileRetired | profile_retire
8. | Archive a Profile | Archive | Yes | VersionArchived | Archived | ProfileArchived | profile_archive
9. | Reactivate a terminal Profile (Deprecated/Retired/Archived → Active) | Activate | Yes | — (see note) | Active | ProfileActivated (published by the new Version's own row-5 hop, not by this row) | profile_activate

This table, and everything in it, is a structural mirror of Chapter 6's Template table — same nine rows, same reasoning throughout, not re-derived from scratch:
- Row 1's function (`publishProfile`) had the identical "creates an already-Active row directly, relying on `profiles.status`'s own default" gap Template's `publishTemplate` had, found and fixed in the same pass (owner: "templates.status defaults to 'Active' - this should be draft; similar to pack... So worth checking what happens to a profile as well"). `publishProfile` now creates a real Draft (`profilesDB.createDraft`), fires `ProfileCreated`, then walks it through rows 3-5 via `advanceProfileOneStep` (migration 186's column-default half, applied to both `templates.status` and `profiles.status` in one migration).
- Row 9 is the same three real `transition_definitions` rows (`Deprecated→Active`, `Retired→Active`, `Archived→Active`, verb `activate`) collapsed to one, for the identical reason: `transitionProfile` branches to `reactivateAsNewVersion` for all three, which walks a brand-new Draft through rows 3-5 for real rather than ever calling `updateStatus` on them — none of the three carries an `event_type`/`version_event`.
- Row 7's **Version event** is `VersionSuperseded`, the same judgment call as Template's identical row (migration 185's header), for the identical reason: Profile's own state name is "Retired" where Chapter 41 §15's generic vocabulary says "Superseded" at that position, but the two seven-stage chains line up 1:1 otherwise.

### Implementation

No. | Implementation details
--|-----
1. | `publishProfile` is not badge-gated today — same platform-wide gap as Pack/Template/Objective (Ch.5 §19.13). The separate interactive-authoring creation path (`createAuthoringDraft`) IS gated by `requireDefineBadge()`, but does not publish `ProfileCreated` (same asymmetry as Template's `createAuthoringDraft` vs `publishTemplate`). **Fixed alongside this table's own correction**: `publishProfile` now creates a real Draft and walks it to Active via real governed transitions, rather than relying on `profiles.status`'s default.
2. | `sdkAuthoring.ts`'s `canEdit = canDefine && isDraft` gates the only real write path, Draft-status Profiles only.
3. | Implemented (`transitionProfile`). **Gap found and fixed**: `transitionEngine.evaluate` was being called without `entityId` — the same latent bug Pack's and Template's own Implementation row 3 already flagged and fixed; harmless today (no Profile row declares `submit_verb`) but would have silently blocked a future one.
4. | **Gap found and fixed** — `transition_definitions.event_type`/`.version_event` were NULL for every Profile row (checked directly against the live DB), despite Ch.7 §19.9 already having built a hardcoded `EVENT_BY_TARGET_STATE` map. Migration 187 populates the columns (matching this table); `core/profiles.ts` now reads `gate.eventType` instead, the map removed — mirrors Template's own migration-185 fix exactly.
5. | Implemented.
6. | Implemented.
7. | Implemented.
8. | Implemented.
9. | Implemented (§19.1/§19.2's `reactivateAsNewVersion`). Gate-only, as described above — never itself the origin of a published event.

### 3. Subsystem Events

The Profile subsystem shall publish:

- ProfileCreated
- ProfileValidated
- ProfilePublished
- ProfileActivated
- ProfileDeprecated
- ProfileRetired
- ProfileArchived *(built, §19.9 — §15's own text omits this one; treated as the same oversight Pack/Template's chapters have, not a deliberate difference)*

---

## Chapter 8 – SEU Commissioning

### 1. Entity Overview
- **Chapter:** [Chapter 8.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/01_Part 1/Chapter 8.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter — confirmed (Version Feature Plan.md pass, 2026-09-11).* Chapter 8 is a **workflow**, not an entity: it orchestrates other entities' own lifecycles rather than defining one of its own. The two real, governed entities it drives — **SEU** (Chapter 2) and **EBM** (Chapter 3) — have their own States and transitions tables in this document, under their own chapters; not repeated here. Both are confirmed **not versioning-relevant** (Versioning: No on every row) — SEU's `lifecycle_state` is a runtime execution lifecycle, not the definition/authoring one this document's Revision-vs-Version distinction covers, and EBM's Validate/Activate hops are explicitly not version-significant either (CR-092 Part 9).

### 3. Subsystem Events

The platform shall publish events including:

- CommissionRequested
- CommissionValidated
- CompositionStarted
- CompositionCompleted
- RuntimeAllocated
- KnowledgeInitialised
- ParticipantsRecruited
- SEUActivated
- CommissionCompleted
- CommissionFailed

Per Chapter 8 §22.14's own code-verified audit (2026-09-07): 6 of these 10 are real (`CommissionRequested`, `CommissionValidated`, `CompositionStarted`, `CompositionCompleted`, `SEUActivated`, `CommissionFailed`) — all published directly from code (`commissionSeu`/`ebmComposer.ts`/`finalizeCommissioning`/`transitionEbm`), never via `transition_definitions.event_type`, since none of them is backed by a governed transition of Chapter 8's own (it has none). `RuntimeAllocated`/`KnowledgeInitialised`/`ParticipantsRecruited` remain unbuilt (Runtime Allocation and Participant Recruitment are both still open, §22.9/§22.11); `CommissionCompleted` has no distinct event either — not to be confused with `CompositionCompleted`, a different, earlier-firing event this chapter also names.

---

## Chapter 9 – Dependency Engine

### 1. Entity Overview
- **Chapter:** [Chapter 9.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 9.md)

### 2. Lifecycle States & Transitions

Each dependency shall exist in one of the following states.

- Unknown
- Pending
- Satisfied
- Blocked
- Invalid
- Waived

State transitions shall remain fully traceable.

### 3. Subsystem Events

The Dependency Engine shall publish:

- DependencyCreated
- DependencySatisfied
- DependencyBlocked
- DependencyWaived
- DeliverableReady
- DeliverableBlocked
- ConstraintDetected
- ConstraintResolved
- CircularDependencyDetected

---

## ✅ Chapter 10 – Capability Model

### 1. Entity Overview
- **Chapter:** [Chapter 10.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 10.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter. Capability is implemented as a pack. Pack events are sufficient. The documented events are conceptual.*

### 3. Subsystem Events

The Capability subsystem shall publish:

- CapabilityRegistered
- CapabilityUpdated
- CapabilityDeprecated
- CapabilityRequested
- CapabilityFulfilled
- CapabilityUnavailable
- CapabilityReleased

---

## ✅ Chapter 11 – Service

### 1. Entity Overview
- **Chapter:** [Chapter 11.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 11.md)

**Definition vs execution (Ch.11 §18.9, CR-064) — two different things share this chapter and a short name:**
1. **Service Definition** (`core/serviceDefinitions.ts`, `service_definitions` table, CR-086) — the canonical, tenant-scoped, versioned CATALOG entry a Capability Pack's `contributionServices[]` picks by code. Its own header comment says it directly: *"Ch.11 §13's own lifecycle is used verbatim."* This is the real embodiment of this chapter's governed lifecycle in the current build, and the subject of the table below. `entity_type = 'Service'` in `transition_definitions` is THIS entity.
2. **The `services` table** — a Pack-materialized, per-Capability EXECUTION row (content-diff versioned, CR-064: `version` bumps on real change, deactivate-old + insert-new-row). It has no governed lifecycle at all — no `transition_definitions` rows, no transition function, every live row permanently `status='Active'` — and CR-064 confirmed this is deliberate, the same "definition vs execution" split CR-063 drew for Obligation's own events: real definition-side versioning was built; the chapter's own state-machine/event-emission machinery was explicitly left for later, execution-side work.

The Version Feature Plan's own mechanism (`transition_definitions.event_type`/`.version_event`) only applies to real governed transitions — i.e., only to Service Definition. The `services` table's own separate versioning mechanism needs no such wiring (it was never built on `transition_definitions` in the first place) and is out of scope here, same as before CR-064.

### 2. Lifecycle States & Transitions

Every Service Definition shall progress through the following lifecycle (Ch.11 §13, used verbatim, strictly linear — no reactivation/back-edges, unlike Pack/Template/Profile's own terminal-state reactivation).

```
Defined

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

One state shorter than Pack/Template/Profile's own seven-state chain — there is no "Validated" state at all. Per this document's own governing rule, a Chapter 41 generic stage with no corresponding real state on this entity simply does not apply — the same reasoning Objective's own missing Validated state already established (§1 above), not a new judgment call.

### States and transitions

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | When a new Service Definition is created | New | No | No | Defined | None | service_define (not yet enforced — see Implementation)
2. | Editing a Defined Service Definition | Edit | No | No | Defined | None | service_define
3. | Publish a Service Definition | Publish | Yes | VersionPublished | Published | ServiceDefinitionPublished | service_publish
4. | Activate a Service Definition | Activate | Yes | VersionActivated | Active | ServiceDefinitionActivated | service_activate
5. | Deprecate a Service Definition | Deprecate | Yes | VersionDeprecated | Deprecated | ServiceDefinitionDeprecated | service_deprecate
6. | Retire a Service Definition | Retire | Yes | VersionSuperseded | Retired | ServiceDefinitionRetired | service_retire
7. | Archive a Service Definition | Archive | Yes | VersionArchived | Archived | ServiceDefinitionArchived | service_archive

Row 1's event is genuinely **None**, not a gap being papered over: checked directly, no `"ServiceDefinitionCreated"`/`"ServiceDefined"` event-type string exists anywhere in the codebase. Unlike Pack/Template/Profile, Service Definition has no separate "proper publish" CLI entry point that mints a row and fires a creation event (no `publishServiceDefinition`-style function exists) — only the interactive-authoring `createDraft`, which is a pure Revision here, the same shape Objective's own row 1 already established (no CR ever asked for a creation event on this entity).

Row 3's **Version event** is `VersionPublished`, not `VersionValidated` — the same reasoning Pack's Draft→Validated already established (Ch.5's own table): `Defined → Published` is both the first governed hop AND the point a Defined row stops being freely editable (`updateDraftContent`'s own `WHERE status = 'Defined'` guard), so one Version event covers the whole moment; it's just named after the literal target state here since there's no intermediate "Validated" stop to name it after instead.

Row 6's **Version event** is `VersionSuperseded` — the same judgment call as Template's/Profile's identical `Deprecated→Retired` hop (migration 185's own header): Chapter 41 §15's generic vocabulary says "Superseded" at this position, Service Definition's own chapter (like Template's/Profile's) says "Retired." The entity's own state name wins; the Version event still comes from Chapter 41's fixed list, by position.

### Implementation

No. | Implementation details
--|-----
1. | `createDraft` is not badge-gated at the DB-layer function itself — same platform-wide gap as Pack/Template/Profile/Objective (Ch.5 §19.13). The interactive-authoring creation path is gated by `requireDefineBadge()` at the web layer. No creation event exists (see row 1's own note above) — confirmed, not a gap this pass closes (no CR asked for one).
2. | `updateDraftContent`'s own `WHERE status = 'Defined'` guards the only real write path.
3. | Implemented (`transitionServiceDefinition`). **Gap found and fixed**: `transitionEngine.evaluate` was being called without `entityId` — the same latent bug Pack's/Template's/Profile's own Implementation row 3 already flagged and fixed; harmless today (no Service Definition row declares `submit_verb`) but would have silently blocked a future one.
4. | **Gap found and fixed** — `transition_definitions.event_type`/`.version_event` were NULL for every Service Definition row (checked directly against the live DB) despite a hardcoded `EVENT_BY_TARGET_STATE` map already existing in code. Migration 188 populates the columns (matching this table); `core/serviceDefinitions.ts` now reads `gate.eventType` instead, the map removed — mirrors Template's/Profile's own migration-185/187 fix exactly.
5. | Implemented.
6. | Implemented.
7. | Implemented. Ch.11's own lifecycle is strictly linear (§13's diagram has no back-edges) — unlike Pack/Template/Profile, reaching Active again from a terminal state as a new Version is deliberately not built for Service Definition (`core/serviceDefinitions.ts`'s own header comment says so directly).

**Regression found and fixed in the same pass, unrelated to the above**: `service_definitions.inputs`/`.outputs` were changed to `TEXT[] NOT NULL` (migration 159, a referential-multi-select of `deliverable-name` Ontology codes, mirroring `consumers` against `capability-name`) — but `ServiceDefinitionRow`/`ServiceDefinitionSeedInput`, `serviceDefinitionsDB.ts`'s `createDraft`/`updateDraftContent`, and `sdkAuthoring.ts`'s own form parsing (`toServiceDefinitionSeedInput`) were never updated to match. Concretely: any caller omitting `inputs`/`outputs` hit a `NOT NULL` violation (a literal `null` sent into a `NOT NULL` array column), and a real multi-select form submission could never be captured at all (parsed only as `typeof content.inputs === "string"`, always `undefined` for a real array post) — the two fields could never actually be saved through the authoring UI. Fixed: types corrected to `string[]`, `createDraft`/`updateDraftContent` default to `[]`, `toServiceDefinitionSeedInput` parses a real array, and `validateServiceDefinitionSeed` gained the matching `deliverable-name` Ontology check `consumers` already had (the missing other half of migration 159).

### 3. Subsystem Events

The Service subsystem shall publish (§14, unchanged from the chapter's own text):

- ServiceDefined — governed-lifecycle, Service Definition's own; no code fires this today (see row 1's own note above)
- ServicePublished — governed-lifecycle; built as `ServiceDefinitionPublished` (row 3)
- ServiceActivated — governed-lifecycle; built as `ServiceDefinitionActivated` (row 4)
- ServiceRequested — **execution-side**, out of scope (Capability Fulfilment/Dispatch, Ch.12/33) — unbuilt, not part of this pass, same as CR-063's identical split left Obligation's own execution events for later
- ServiceDelivered — **execution-side**, out of scope, same as above
- ServiceLevelMet — **execution-side**, Engineering Telemetry territory (Ch.35) — unbuilt, out of scope
- ServiceLevelBreached — **execution-side**, same as above
- ServiceDeprecated — governed-lifecycle; built as `ServiceDefinitionDeprecated` (row 5)
- ServiceRetired — governed-lifecycle; built as `ServiceDefinitionRetired` (row 6)
- *(§14's own text omits an Archived event; built anyway as `ServiceDefinitionArchived`, row 7 — the same oversight-not-deliberate-omission treatment given to Pack/Template/Profile's identical gap)*

---

## Chapter 12 – Capability Fulfilment

### 1. Entity Overview
- **Chapter:** [Chapter 12.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 12.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The subsystem shall publish:

- CapabilityRequested
- CapabilityFulfilmentStarted
- CapabilityFulfilled
- CapabilityUnavailable
- ParticipantAssigned
- ParticipantReleased
- ParticipantReassigned
- CapabilityContinuityMaintained
- CapabilityFulfilmentFailed

---

## Chapter 13 – Participant Model

### 1. Entity Overview
- **Chapter:** [Chapter 13.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 13.md)

### 2. Lifecycle States & Transitions

Every Participant shall transition through the following lifecycle.

```
Created

↓

Available

↓

Assigned

↓

Executing

↓

Idle

↓

Released

↓

Archived
```

Participants may transition repeatedly between **Assigned**, **Executing** and **Idle**.

### 3. Subsystem Events

The platform shall publish events including:

- ParticipantCreated
- ParticipantAssigned
- ParticipantReleased
- ParticipantActivated
- ParticipantIdle
- ParticipantReplaced
- ParticipantArchived
- ParticipantUnavailable

---

## Chapter 14 – Engineering Collaboration Model

### 1. Entity Overview
- **Chapter:** [Chapter 14.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 14.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

Notify changes in engineering state.

---

## Chapter 15 – Deliverable Model

### 1. Entity Overview
- **Chapter:** [Chapter 15.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 15.md)

### 2. Lifecycle States & Transitions

Every Deliverable shall transition through a defined lifecycle.

A default lifecycle is:

```
Defined

↓

Planned

↓

In Progress

↓

Under Review

↓

Approved

↓

Baselined

↓

Superseded

↓

Archived
```

The Engineering Behavior Model may define additional lifecycle states.

### 3. Subsystem Events

The Deliverable subsystem shall publish:

- DeliverableCreated
- DeliverableUpdated
- DeliverableStateChanged
- DeliverableApproved
- DeliverableBaselined
- DeliverableSuperseded
- DeliverableArchived

---

## Chapter 16 – Knowledge Model

### 1. Entity Overview
- **Chapter:** [Chapter 16.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 16.md)

### 2. Lifecycle States & Transitions

Knowledge shall transition through the following lifecycle.

```
Observed

↓

Proposed

↓

Validated

↓

Accepted

↓

Published

↓

Deprecated

↓

Archived
```

Only Published Knowledge may be reused across SEUs by default. Published state governs whether a Knowledge Item is validated enough to reuse at all; Acquisition Scope (§12) governs how far, once Published, it is entitled to propagate.

### 3. Subsystem Events

The Knowledge subsystem shall publish:

- KnowledgeObserved
- KnowledgeProposed
- KnowledgeValidated
- KnowledgeAccepted
- KnowledgePublished
- KnowledgeUpdated
- KnowledgeScopePromoted
- KnowledgeDeprecated
- KnowledgeArchived

---

## Chapter 17 – Evidence Model

### 1. Entity Overview
- **Chapter:** [Chapter 17.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 17.md)

### 2. Lifecycle States & Transitions

Evidence shall progress through the following lifecycle.

```
Collected

↓

Validated

↓

Accepted

↓

Referenced

↓

Archived
```

Rejected evidence shall remain preserved for audit purposes.

### 3. Subsystem Events

The Evidence subsystem shall publish:

- EvidenceCollected
- EvidenceValidated
- EvidenceAccepted
- EvidenceRejected
- EvidenceReferenced
- EvidenceArchived

---

## ✅ Chapter 18 – Ontology Model

### 1. Entity Overview
- **Chapter:** [Chapter 18.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 18.md)
- **Description:** The Ontology Model defines the shared semantic vocabulary used by a Software Engineering Unit (SEU). The governed entity is the **Concept** (`ontology_concepts`) — one row per Version, `entity_type = 'Ontology'` in `transition_definitions`.

The chapter's own §18 "Implementation Specifics" audit (added 2026-08-25, before this pass) found no version field, no history, and `is_active` only hiding a concept going forward — the largest of its own named gaps (§18.7). This table reflects the real build closing it (migrations 190/191/193, same day as this table).

### 2. Lifecycle States & Transitions

Unlike every other entity covered so far, a Concept has **no Draft/Defined prefix at all** — it goes live the moment it's added (no review workflow exists anywhere in this chapter's own build, §18.8), so **Active is the initial state**, not a birth transition (this codebase's own "creation authority is not a transition" discipline — the same reasoning Objective's row 1 already established, just without even a Proposed-equivalent holding state here).

```
Active

↓

Deprecated

↓

Retired

↓

Archived
```

No skip-ahead edges (no direct Active→Retired) — the same discipline Pack/Template/Profile/Service Definition already hold themselves to. Reactivation is not a separate edge either: for this entity, "reactivating" a Deprecated/Retired/Archived concept is just publishing a new Version (row 2), which lands Active and supersedes whatever else is currently Active for that code — Template's own "reactivation is versioning, not a bare state flip" precedent, generalised.

### States and transitions

No. | Description | Action | Transition Defined | Versioning | Lifecycle State | Event | Badge
--|-----|-----|-----|-----|-----|----|-----
1. | Add a brand-new code (first Version) | New | No | No | Active | ConceptCreated | ontology_define
2. | Publish a new Version of an already-existing code (label/description edit) | Edit | No | No | Active | ConceptUpdated | ontology_define
3. | Edit administrative metadata (text_type / ui_grouping) in place | Edit metadata | No | No | Active (unchanged) | ConceptUpdated | ontology_define
4. | Compose a concept from an existing one (Specialization/Override, CR-095/CR-096) | Compose | No | No | Active | OntologyComposed | ontology_define
5. | Deprecate a concept | Deprecate | Yes | VersionDeprecated | Deprecated | ConceptDeprecated | ontology_deprecate
6. | Retire a concept | Retire | Yes | VersionSuperseded | Retired | OntologyConceptRetired | ontology_retire
7. | Archive a concept | Archive | Yes | VersionArchived | Archived | OntologyConceptArchived | ontology_archive
8. | Reject a proposed (Pack-contributed) concept | Reject | *not yet built — CR-097* | No | *n/a — no concept created* | SemanticConflictDetected | *not yet built — CR-097*
9. | Accept a proposed concept, the very first time | Accept | *not yet built — CR-097* | *open, CR-097* | Active | OntologyValidated | *not yet built — CR-097*
10. | Accept a proposed concept, after a prior rejection | Accept | *not yet built — CR-097* | *open, CR-097* | Active | SemanticConflictResolved | *not yet built — CR-097*

Rows 1–4 are genuinely ungoverned — no `transition_definitions` row exists for any of them (confirmed directly, not assumed: `ontology-event-lifecycle-table.test.ts`'s own DEFINITION test queries every `entity_type = 'Ontology'` row and asserts there are exactly 3, rows 5-7) — yet all four still publish a real event, gated only by the `ontology_define` authoring badge. This is a genuine deviation from every other entity's own "New"/"Edit" rows (Objective/Pack/Template/Profile/Service Definition), which are pure Revisions with **no event at all** — a deliberate choice here, made specifically to close Ch.18 §14's own "zero of 7 events exist anywhere" gap (§18.9) even for the entity's non-governed actions, not an oversight or an inconsistency to fix later.

Row 4's Event column names only `OntologyComposed`, the composition-specific signal — the SAME action also fires row 1's or row 2's own `ConceptCreated`/`ConceptUpdated` from the underlying version-write it performs (`composeConcept` calls the identical `createConceptVersion` path `addConcept` does) — two real, distinct events from one action, not a typo.

Rows 5-7's **Badge** column names the canonical `noun_verb` badge (`transitionEngine`'s own derivation); each also accepts `ontology_define` as an `alternateBadges` fallback (`transitionConcept`, `core/ontology.ts`) so every existing `ontology_define`/root holder keeps full access without a separate badge grant — not a second, independent authority tier, a deliberate one-way compatibility bridge.

Rows 8-10 are CR-097's own scope (not built, explicitly deferred — "we will pick this later"): a review queue for `OntologyComposed` proposals originating from something other than a tenant's own direct Compose action (Pack-contributed codes today, `core/sdkAuthoring.ts`'s `emitOntologyComposedIfUnregistered`). Versioning/Transition Defined are marked *open* rather than guessed — CR-097 itself flags whether Accept should be a real governed `transition_definitions` hop (there's no `ontology_concepts` row to gate a transition on before Accept actually creates one) as an unresolved open question.

### Implementation

No. | Implementation details
--|-----
1. | Implemented (`core/ontology.ts`'s `addConcept` → `createConceptVersion`). Publishes `ConceptCreated` when no prior Version exists for the (concept_type, code, tenant_id) triple.
2. | Implemented, same function — `createConceptVersion` detects an existing Version, bumps the patch (`1.0.0` → `1.0.1`), publishes `ConceptUpdated` on the new row, and auto-fires `ConceptDeprecated` on the row it supersedes (a real, distinct event on the OLD row's own id — not itself a separately-authorised governed transition, a mechanical side effect of the new Version reaching Active, the same "reactivation/supersession is a side effect, not its own badge check" shape Template's own `reactivateAsNewVersion` already established).
3. | Implemented (`updateConceptMeta`). Deliberately bypasses versioning entirely — text_type/ui_grouping are administrative/display metadata, not the semantic content Ch.18 §12 versions; a raw in-place `UPDATE`, no new row, no status change, no `transitionEngine` gate. Owner: "Edit should emit ConceptUpdated. No versioning required" — confirms this was the right shape, just missing the event, fixed same-day.
4. | Implemented (`composeConcept`), Specialization + Override only (Merge/Union/Intersection/Supplement don't have clear meaning over a 2-field label/description entity with a single composition source in the common case — user-confirmed scope cut). Reuses `domain/engine/compositionEngine.ts`, the same module Pack authoring's own Compose action calls.
5. | Implemented (`deprecateConcept` → `transitionConcept`).
6. | Implemented (`retireConcept` → `transitionConcept`). A convenience one-click "Retire" button (Ontology Metadata page, `quickRetireConcept`) walks Active→Deprecated→Retired in one call for a UI that wants the old flat is_active boolean's one-click feel — both real hops still run independently, each with its own badge check and its own published event; not a third, separate transition.
7. | Implemented (`archiveConcept` → `transitionConcept`).
8. | Not implemented. `SemanticConflictDetected` has zero publishers anywhere in the codebase today. CR-097.
9. | Not implemented. `OntologyValidated` has zero publishers anywhere in the codebase today. CR-097.
10. | Not implemented. `SemanticConflictResolved` has zero publishers anywhere in the codebase today. CR-097.

**A separate, already-built consumer of the SAME `OntologyComposed` event name**: `core/sdkAuthoring.ts`'s `emitOntologyComposedIfUnregistered` publishes `OntologyComposed` (`originatingObjectType: "Pack"`) when a Pack's own contribution references a code with no matching concept — corrected same-day from the wrong `ConceptCreated` name (owner: "It emits ConceptCreated when a new code is entered. The event has to be OntologyComposed"). This is the exact proposal CR-097's own review queue (rows 8-10) is designed to consume; today it just publishes into the void, same as rows 8-10's own three events.

### 3. Subsystem Events

The Ontology subsystem shall publish (§14, all 7 now accounted for — 4 real, 3 deferred to CR-097):

- **ConceptCreated** — real, row 1 (and row 4's own underlying write).
- **ConceptUpdated** — real, rows 2-3 (and row 4's own underlying write, when composing a new Version of an existing code).
- **ConceptDeprecated** — real, row 5 (and row 2's own auto-supersession side effect).
- **OntologyComposed** — real, row 4 (`composeConcept`) and separately `emitOntologyComposedIfUnregistered` (Pack proposals, unconsumed — CR-097).
- **OntologyValidated** — not built. CR-097, row 9.
- **SemanticConflictDetected** — not built. CR-097, row 8.
- **SemanticConflictResolved** — not built. CR-097, row 10.

---

## Chapter 19 – Decision Model

### 1. Entity Overview
- **Chapter:** [Chapter 19.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 19.md)

### 2. Lifecycle States & Transitions

Every Decision shall transition through the following lifecycle.

```
Identified

↓

Analysed

↓

Proposed

↓

Reviewed

↓

Approved

↓

Applied

↓

Superseded

↓

Archived
```

Only Approved Decisions may influence Deliverable state transitions unless explicitly authorised by governance.

### 3. Subsystem Events

The Decision subsystem shall publish:

- DecisionIdentified
- DecisionAnalysed
- DecisionProposed
- DecisionReviewed
- DecisionApproved
- DecisionApplied
- DecisionSuperseded
- DecisionArchived

---

## Chapter 20 – Traceability Model

### 1. Entity Overview
- **Chapter:** [Chapter 20.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 20.md)

### 2. Lifecycle States & Transitions

Relationships shall transition through:

```
Created

↓

Validated

↓

Active

↓

Superseded

↓

Archived
```

Relationship history shall remain permanently available.

### 3. Subsystem Events

The Traceability subsystem shall publish:

- RelationshipCreated
- RelationshipValidated
- RelationshipUpdated
- RelationshipSuperseded
- RelationshipArchived
- TraceabilityQueryExecuted

---

## Chapter 21 – Governance Model

### 1. Entity Overview
- **Chapter:** [Chapter 21.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 21.md)

### 2. Lifecycle States & Transitions

Governance rules progress through:

```
Defined

↓

Composed

↓

Active

↓

Applied

↓

Superseded

↓

Archived
```

Historical governance rules shall remain reproducible.

### 3. Subsystem Events

The Governance subsystem shall publish:

- GovernanceEvaluated
- GovernanceApproved
- GovernanceRejected
- GovernanceEscalated
- GovernanceWaived
- GovernanceRuleApplied

---

## Chapter 22 – Authority Model

### 1. Entity Overview
- **Chapter:** [Chapter 22.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 22.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Authority subsystem shall publish:

- AuthorityRequested
- AuthorityGranted
- AuthorityDenied
- AuthorityDelegated
- AuthorityEscalated
- AuthorityExpired
- AuthorityRevoked

---

## Chapter 23 – Obligation Model

### 1. Entity Overview
- **Chapter:** [Chapter 23.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 23.md)

### 2. Lifecycle States & Transitions

Every Obligation shall transition through the following lifecycle.

```
Identified

↓

Analysed

↓

Assigned

↓

In Progress

↓

Resolved

↓

Verified

↓

Closed

↓

Archived
```

Closure shall require verification.

### 3. Subsystem Events

The Obligation subsystem shall publish:

- ObligationCreated
- ObligationAssigned
- ObligationUpdated
- ObligationResolved
- ObligationVerified
- ObligationClosed
- ObligationEscalated
- ObligationReopened

---

## Chapter 24 – Policy Model

### 1. Entity Overview
- **Chapter:** [Chapter 24.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 24.md)

### 2. Lifecycle States & Transitions

Policies shall progress through the following lifecycle.

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

Historical Policies shall remain available for engineering reconstruction.

### 3. Subsystem Events

The Policy subsystem shall publish:

- PolicyCreated
- PolicyValidated
- PolicyPublished
- PolicyApplied
- PolicyViolated
- PolicyExceptionRequested
- PolicyExceptionApproved
- PolicyRetired

---

## Chapter 25 – Review Model

### 1. Entity Overview
- **Chapter:** [Chapter 25.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 25.md)

### 2. Lifecycle States & Transitions

Every Review shall transition through the following lifecycle.

```
Planned

↓

Prepared

↓

In Progress

↓

Completed

↓

Accepted

↓

Archived
```

Historical Reviews shall remain permanently available.

### 3. Subsystem Events

The Review subsystem shall publish:

- ReviewPlanned
- ReviewStarted
- ReviewCompleted
- ReviewPassed
- ReviewFailed
- ReviewDeferred
- FindingCreated
- FindingResolved

---

## Chapter 26 – Quality Gate Model

### 1. Entity Overview
- **Chapter:** [Chapter 26.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 26.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Quality Gate subsystem shall publish:

- QualityGateEvaluated
- QualityGatePassed
- QualityGateBlocked
- QualityGateWaived
- QualityGateDeferred
- QualityGateConfigurationChanged

---

## Chapter 27 – Compliance Model

### 1. Entity Overview
- **Chapter:** [Chapter 27.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/04_Part 4/Chapter 27.md)

### 2. Lifecycle States & Transitions

Compliance requirements shall progress through:

```
Defined

↓

Composed

↓

Evaluated

↓

Satisfied

↓

Superseded

↓

Archived
```

Historical compliance evaluations shall remain reproducible.

### 3. Subsystem Events

The Compliance subsystem shall publish:

- ComplianceEvaluated
- ComplianceSatisfied
- ComplianceViolationDetected
- ComplianceWaiverGranted
- ComplianceStatusChanged
- ComplianceReportGenerated

---

## Chapter 28 – Runtime Kernel

### 1. Entity Overview
- **Chapter:** [Chapter 28.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 28.md)

### 2. Lifecycle States & Transitions

The Runtime Kernel shall support the following lifecycle.

```
Initialised

↓

Available

↓

Hosting SEUs

↓

Maintenance

↓

Shutdown

↓

Archived
```

Individual SEUs possess independent lifecycles.

### 3. Subsystem Events

The Runtime Kernel shall publish:

- KernelStarted
- KernelAvailable
- RuntimeServiceStarted
- RuntimeServiceStopped
- RuntimeFailureDetected
- RuntimeRecovered
- SEUHosted
- SEUReleased

---

## Chapter 29 – State Management Model

### 1. Entity Overview
- **Chapter:** [Chapter 29.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 29.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The State Management subsystem shall publish:

- StateTransitionRequested
- StateTransitionValidated
- StateTransitionCommitted
- StateTransitionRejected
- StateRecovered
- StateConflictDetected
- StateConflictResolved

---

## Chapter 30 – Event Model

### 1. Entity Overview
- **Chapter:** [Chapter 30.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 30.md)

### 2. Lifecycle States & Transitions

Events progress through the following lifecycle.

```
Generated

↓

Published

↓

Consumed

↓

Archived
```

Once Published, an Event shall not be modified.

Consumption by one subscriber shall not affect other subscribers.

### 3. Subsystem Events

[Sudha: The previous ADR ("Transition Definitions") changes how I think about the Runtime Kernel.

Originally, I thought the Runtime Kernel looked like this:

```
State Management
↓

Event Bus
↓

Execution Planning
```

I now think that's backwards.

The platform is fundamentally **event-driven**.

State changes produce events.

Events cause evaluations.

Evaluations produce new state transitions.

That means **Events** are not a messaging mechanism.

They are the **heartbeat of the SEU**.

This is exactly how modern operating systems work.

This is exactly how modern distributed systems work.

And I think it is exactly how an AI Software Engineering Unit should work.

---------------

While writing this chapter, I realised we've uncovered another architectural distinction that I think should become an ADR.

Throughout the previous chapters we've used the words **Events**, **Requests**, **Commands** and **Transitions** almost interchangeably. They are not the same thing.

I think the Runtime Kernel should distinguish them very clearly:

|Concept|Meaning|
|---|---|
|**Command**|A request to perform an engineering action.|
|**Transition Definition**|The declarative contract describing how a state transition may occur.|
|**State Transition**|The successful change of an engineering object's authoritative state.|
|**Event**|The immutable fact that the transition has occurred.|

That creates a clean runtime flow:

```
Command

↓

Transition Definition Evaluation

↓

Governance Evaluation

↓

State Transition

↓

Event Publication

↓

Subscribers React
```

Notice something subtle but important:

Participants should issue **Commands**, not Events.

The Runtime Kernel evaluates those Commands against the relevant Transition Definition and Governance Model. Only after the state transition commits does the Runtime Kernel publish an Event.

This separation prevents Participants from fabricating engineering history. They can request work, but only the Runtime Kernel can declare that something **actually happened**.

I think this distinction is one of the strongest implementation principles we've developed. It aligns naturally with CQRS and event-driven architectures while remaining technology-neutral. More importantly, it reinforces the idea that **engineering truth belongs to the Runtime Kernel**, not to individual Participants. I strongly recommend capturing this as an ADR because it will shape almost every runtime service that follows.
]

---

## Chapter 31 – Execution Engine

### 1. Entity Overview
- **Chapter:** [Chapter 31.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 31.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Execution Engine shall publish:

- ExecutionEvaluationStarted
- ExecutionEvaluationCompleted
- CommandGenerated
- CapabilityRequested
- ExecutionDeferred
- ExecutionBlocked

---

## Chapter 32 – Work Item Model

### 1. Entity Overview
- **Chapter:** [Chapter 32.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 32.md)

### 2. Lifecycle States & Transitions

Every Work Item shall progress through the following lifecycle.

```
Generated

↓

Assigned

↓

Executing

↓

Completed

↓

Disposed
```

Cancelled Work Items transition directly to **Disposed**.

Disposed Work Items remain available for traceability but are no longer active.

### 3. Subsystem Events

The Work Item subsystem shall publish:

- WorkItemGenerated
- WorkItemAssigned
- WorkItemStarted
- WorkItemCompleted
- WorkItemCancelled
- WorkItemDisposed

---

## Chapter 33 – Dispatch Engine

### 1. Entity Overview
- **Chapter:** [Chapter 33.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 33.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Dispatch subsystem shall publish:

- WorkItemDispatched
- DispatchDeferred
- DispatchRejected
- ParticipantSelected
- ParticipantUnavailable
- RedispatchRequested
- RedispatchCompleted

---

## Chapter 34 – Attention Management Model

### 1. Entity Overview
- **Chapter:** [Chapter 34.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 34.md)

### 2. Lifecycle States & Transitions

Attention Items shall progress through the following lifecycle.

```
Created

↓

Delivered

↓

Acknowledged

↓

In Progress

↓

Resolved

↓

Closed
```

Historical Attention Items remain available for audit purposes.

### 3. Subsystem Events

The Attention subsystem shall publish:

- AttentionCreated
- AttentionDelivered
- AttentionAcknowledged
- AttentionEscalated
- AttentionResolved
- AttentionClosed

---

## Chapter 35 – Engineering Telemetry Model

### 1. Entity Overview
- **Chapter:** [Chapter 35.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 35.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Telemetry subsystem shall publish:

- MetricCalculated
- HealthAssessmentUpdated
- BottleneckDetected
- TrendIdentified
- ThresholdExceeded
- SustainedPatternDetected
- TelemetrySnapshotGenerated

---

## Chapter 36 – External Interaction Model

### 1. Entity Overview
- **Chapter:** [Chapter 36.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 36.md)

### 2. Lifecycle States & Transitions

Every External Interaction shall progress through the following lifecycle.

```
Created

↓

Validated

↓

Dispatched

↓

Acknowledged

↓

Completed

↓

Archived
```

Failed interactions may be retried according to implementation policies.

### 3. Subsystem Events

The External Interaction subsystem shall publish:

- InteractionCreated
- InteractionValidated
- InteractionDispatched
- InteractionSucceeded
- InteractionFailed
- InteractionRetried
- InteractionCompleted

---

## Chapter 37 – SEU Lifecycle Management

### 1. Entity Overview
- **Chapter:** [Chapter 37.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/05_Part 5/Chapter 37.md)

### 2. Lifecycle States & Transitions

[Sudha: 
I think we've reached the final chapter of the Runtime Kernel.

Originally we had "Runtime Administration."

I think that's too operational.

What we're really defining is:

> **How does an SEU itself live?**

Not the software platform.

Not the infrastructure.

The **SEU**.

Every SEU is:

- commissioned,
- activated,
- evolves,
- paused,
- resumed,
- upgraded,
- retired.

That's a lifecycle.

And the Runtime Kernel is responsible for managing it.

This chapter completes the Runtime Kernel.

----------------

think this chapter completes the Runtime Kernel.

Stepping back, the Runtime Kernel now has a coherent set of responsibilities:

|Runtime Service|Responsibility|
|---|---|
|**State Management**|Owns authoritative engineering state.|
|**Event Model**|Publishes engineering facts.|
|**Execution Engine**|Decides what engineering action should occur next.|
|**Work Item Generator**|Produces participant-specific execution instructions.|
|**Dispatch Engine**|Assigns work to suitable Participants.|
|**Attention Management**|Determines where human or AI attention is required.|
|**Engineering Telemetry**|Measures engineering health and flow.|
|**External Interaction Model**|Manages all interactions beyond the Runtime Kernel boundary.|
|**SEU Lifecycle Management**|Manages the operational existence of Software Engineering Units.|

This is no longer recognisable as a project management system or an ALM platform. It is much closer to an **operating system for software engineering**.

]

### 3. Subsystem Events

The Lifecycle Management subsystem shall publish:

- SEUConfigured
- SEUActivated
- SEUSuspended
- SEUResumed
- SEUUpgraded
- SEURetired
- SEUArchived

---

## Chapter 38 – Pack SDK Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 38.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 38.md)

### 2. Lifecycle States & Transitions

Every Pack shall progress through the following lifecycle.

```
Defined

↓

Validated

↓

Published

↓

Activated

↓

Retired

↓

Archived
```

Pack history shall remain permanently available.

### 3. Subsystem Events

The Pack SDK shall publish:

- PackDefined
- PackRejected
- PackUpdated
- PackValidated
- PackActivated
- PackDeprecated
- PackRetired

<mark>Check events are asynchronous. Differentiate between revision and version.</mark>

---

## Chapter 39 – Pack SDK Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 39.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 39.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The SDK shall publish:

- PackProjectCreated
- PackValidated
- PackTested
- PackPackaged
- PackPublished
- PackPublicationRejected

---

## Chapter 40 – Security Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 40.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 40.md)

### 2. Lifecycle States & Transitions

Security credentials shall support:

```
Issued

↓

Activated

↓

Rotated

↓

Revoked

↓

Archived
```

Historical security information shall remain available for audit.

### 3. Subsystem Events

The Security subsystem shall publish:

- AuthenticationSucceeded
- AuthenticationFailed
- AuthorisationGranted
- AuthorisationDenied
- CredentialRotated
- SecurityViolationDetected
- SecurityPolicyApplied

---

## Chapter 41 – Version Management Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 41.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 41.md)

### 2. Lifecycle States & Transitions

Every Version shall progress through the following general lifecycle. However, individual engineering artefacts can have their own definition of lifecycle. 

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Superseded

↓

Archived
```

Historical Versions remain immutable.

### 3. Subsystem Events

The Version Management subsystem shall publish:

- VersionCreated
- VersionValidated
- VersionPublished
- VersionActivated
- VersionDeprecated
- VersionSuperseded
- VersionArchived

---

## Chapter 42 – Multi-Tenancy Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 42.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 42.md)

### 2. Lifecycle States & Transitions

Every Tenant shall progress through:

```
Provisioned

↓

Configured

↓

Operational

↓

Suspended

↓

Retired

↓

Archived
```

Tenant lifecycle is independent of individual SEUs.

### 3. Subsystem Events

The Multi-Tenancy subsystem shall publish:

- TenantProvisioned
- TenantConfigured
- TenantSuspended
- TenantReactivated
- WorkspaceCreated
- WorkspaceArchived
- TenantRetired

---

## Chapter 43 – Deployment Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 43.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 43.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Deployment subsystem shall publish:

- DeploymentStarted
- DeploymentCompleted
- DeploymentFailed
- DeploymentScaled
- DeploymentRecovered
- DeploymentRetired

---

## Chapter 44 – Reliability and Engineering Continuity Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 44.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 44.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

The Reliability subsystem shall publish:

- FailureDetected
- CheckpointCreated
- RecoveryStarted
- RecoveryCompleted
- ReplayStarted
- ReplayCompleted
- ConsistencyValidated
- EngineeringExecutionResumed

---

## Chapter 45 – Reference Architecture

### 1. Entity Overview
- **Chapter:** [Chapter 45.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 45.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

*No explicit subsystem events section defined in this chapter.*

---

## Chapter 46 – Platform Evolution Strategy

### 1. Entity Overview
- **Chapter:** [Chapter 46.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/06_Part 6/Chapter 46.md)

### 2. Lifecycle States & Transitions

*No explicit entity lifecycle section defined in this chapter.*

### 3. Subsystem Events

*No explicit subsystem events section defined in this chapter.*

---

## Chapter 47 – Checklist Model

### 1. Entity Overview
- **Chapter:** [Chapter 47 copy.md](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/07_Part 7/Chapter 47 copy.md)

### 2. Lifecycle States & Transitions

A Checklist shall possess no independent lifecycle or version. It is declarative content carried inside its originating Pack's contributions and inherits the Pack's lifecycle and version in full.

This is a deliberately lighter position than Quality Gate and Review Gate (Chapter 26), which carry their own `version` and an `is_active` flag rather than the full Draft→...→Archived lifecycle used elsewhere in this book. Those two entities need independent identity because other records reference them directly by id across Pack versions — a Quality Gate Waiver references a specific Quality Gate; a Review references a specific Review Gate; a Transition Definition's required Quality Gate list references specific gate identities.

**Corrected (CR-060, 2026-08-23): a Checklist DOES have real external referents now** — Review Gate's and Quality Gate's own `checklistIds` (§14), from any Pack, hold a stable reference to a specific Checklist by its real id. What stays true from the original reasoning is narrower than first drafted: nothing outside its own Pack ever holds a reference to a specific *version* of a Checklist, because a Checklist has no version to reference — its `id` is what's real and stable (owner: "It stays... Someone wants to update the checklist with a new item, they can without a version change"), and that same id simply keeps meaning the same Checklist, current content included, across every republish of its originating Pack. A real table exists for exactly this reason (owner: "Checklist can be in a table to get a fk. the chapter does not impose the implementation details") — §16's own "no registry/versioning service" conclusion below is about lifecycle machinery, not about whether a persisted row exists.

Historical Checklist content therefore remains reproducible exactly as far as historical Pack versions remain reproducible (Chapter 5 §14) — no separate reconstruction mechanism is required.

### 3. Subsystem Events

A Checklist has no independent lifecycle (§16), so it publishes no creation, validation, publication, deprecation or retirement events of its own — those are published by the Pack subsystem (Chapter 5 §16) when the originating Pack transitions.

Checklist execution is a runtime activity and publishes:

- ChecklistExecutionStarted
- ChecklistItemEvaluated
- ChecklistExecutionCompleted

---
