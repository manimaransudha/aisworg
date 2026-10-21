# CR-127 — State literal comparisons removed from code

**Raised:** 2026-10-19 · **Origin:** `design/Code Repetition Survey.md` finding 5. Code compares lifecycle state and status fields against string literals such as `"Active"` and `"Draft"`. The project rule is that no constant lives in code outside `src/dblayer/constants.ts` and that everything else is Ontology driven.

**Status:** 🟡 Raised — design in progress. This CR stays open until the classification below is agreed and built.

## Fix the following

| # | Item |
|---|---|
| 1 | Each state literal assignments under `src/` is classified as Constant, Ontology. |
| 2 | A Constant assignments imports its value from `src/dblayer/constants.ts`. |
| 3 | An Ontology comparison reads its value or outcome from the Ontology or from `transition_definitions`. A change to that value is a data change. |


## Classes

| Class | Meaning | Candidates |
|---|---|---|
| Constant | The state is structural to the code. The constants have to be defined in constants.ts and imported. |
| Ontology | The behaviour follows from a state machine or a concept set that is already data. | Single-entity states such as Dispatched, Released, Fulfilled, Pending and Defined. Compliance result values. |
| Leave | Seed and test values. | rejected, dead, consumed. |

## Inventory

A grep of `src/` on 2026-10-19 for literal assignments is surveyed. The Class column is empty until the classes above are agreed.

| File | Line | Assignment | Literal | Class |
|---|---|---|---|---|
| src/middleware/safeBack.ts | 3 | `fallback = "/aisworg"` | /aisworg | Leave |
| src/middleware/requireBadge.ts | 6 | `NONE = "None"` | None | Leave |
| src/middleware/requireBadge.ts | 23 | `message : "Session expired — please log in again."` | Session expired — please log in again. | Leave |
| src/middleware/auth.ts | 19 | `DEMO_PARTICIPANT_DISPLAY_NAME = "Demo User"` | Demo User | Leave |
| src/middleware/auth.ts | 33 | `type : "Human"` | Human | Leave |
| src/middleware/auth.ts | 54 | `type : "Human"` | Human | Leave |
| src/dblayer/seed/demo/demoPurge.ts | 35 | `t.table_type = "BASE TABLE"` | BASE TABLE | Leave |
| src/dblayer/seed/demo/demoPurge.ts | 36 | `c.table_schema = "public"` | public | Leave |
| src/dblayer/seed/demo/demoPurge.ts | 55 | `con.contype = "f"` | f | Leave |
| src/dblayer/seed/demo/demoPurge.ts | 55 | `n.nspname = "public"` | public | Leave |
| src/dblayer/seed/demo/demoPurge.ts | 150 | `authorised_badges = "[]"` | [] | Leave |
| src/dblayer/seed/demo/demoBadges.ts | 9 | `DEMO_PARTICIPANT_DISPLAY_NAME = "Demo User"` | Demo User | Leave |
| src/dblayer/seed/demo/demoBadges.ts | 28 | `type : "Human"` | Human | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 79 | `requiredBadge : "pack_define"` | pack_define | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 89 | `kind : "Pack"` | Pack | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 95 | `status = "Draft"` | Draft | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 104 | `kind : "Pack"` | Pack | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 120 | `requiredBadge : "template_define"` | template_define | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 131 | `kind : "Template"` | Template | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 135 | `status = "Draft"` | Draft | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 137 | `kind : "Template"` | Template | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 170 | `status : "Proposed"` | Proposed | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 179 | `targetState : "Active"` | Active | Leave |
| src/dblayer/seed/demo/demoSeed.ts | 227 | `requiredBadge : "pack_define"` | pack_define | |
| src/dblayer/seed/seedCapabilityDefinitions.ts | 88 | `targetState : "Published"` | Published | |
| src/dblayer/seed/seedCapabilityDefinitions.ts | 91 | `targetState : "Active"` | Active | |
| src/dblayer/seed/seedCapabilityPatternPacks.ts | 196 | `status : "fulfilled"` | fulfilled | |
| src/dblayer/seed/seedCapabilityPatternPacks.ts | 198 | `status : "rejected"` | rejected | |
| src/dblayer/seed/seedServiceDefinitions.ts | 50 | `field : "inputs"` | inputs | |
| src/dblayer/seed/seedServiceDefinitions.ts | 50 | `field : "outputs"` | outputs | |
| src/dblayer/seed/seedServiceDefinitions.ts | 94 | `targetState : "Published"` | Published | |
| src/dblayer/seed/seedServiceDefinitions.ts | 97 | `targetState : "Active"` | Active | |
| src/dblayer/seed/seedParticipantsMaster.ts | 74 | `DEFAULT_PARTICIPANT_ROLE = "participant"` | participant | |
| src/dblayer/policiesDB.ts | 37 | `type : "always_true"` | always_true | |
| src/dblayer/eventsDB.ts | 6 | `sequence : "sequence"` | sequence | |
| src/dblayer/eventsDB.ts | 8 | `entityType : "originating_object_type"` | originating_object_type | |
| src/dblayer/eventsDB.ts | 9 | `seuId : "seu_id"` | seu_id | |
| src/dblayer/eventsDB.ts | 10 | `actor : "actor_id"` | actor_id | |
| src/dblayer/eventsDB.ts | 11 | `occurredAt : "occurred_at"` | occurred_at | |
| src/dblayer/eventsDB.ts | 90 | `onConflict : "ON CONFLICT (event_type, version) DO UPDATE SET is_active = EXCLUDED.is_active, description = EXCLUDED.description, category = EXCLUDED.category, author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge"` | ON CONFLICT (event_type, version) DO UPDATE SET is_active = EXCLUDED.is_active, description = EXCLUDED.description, category = EXCLUDED.category, author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge | |
| src/dblayer/eventsDB.ts | 105 | `onConflict : "ON CONFLICT (event_type, handler_name) DO UPDATE SET author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge"` | ON CONFLICT (event_type, handler_name) DO UPDATE SET author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge | |
| src/dblayer/userDB.ts | 45 | `actorBadge : "root"` | root | |
| src/dblayer/qualityGatesDB.ts | 30 | `type : "no_unresolved_obligations"` | no_unresolved_obligations | |
| src/dblayer/seusDB.ts | 126 | `select : "s.*, o.statement AS objective_statement"` | s.*, o.statement AS objective_statement | |
| src/dblayer/seusDB.ts | 127 | `from : "seus s JOIN objectives o ON o.id = s.objective_id"` | seus s JOIN objectives o ON o.id = s.objective_id | |
| src/dblayer/seusDB.ts | 129 | `objective : "o.statement"` | o.statement | |
| src/dblayer/seusDB.ts | 129 | `created : "s.created_at"` | s.created_at | |
| src/dblayer/seusDB.ts | 130 | `baseWhere : "$1::uuid IS NULL OR EXISTS (SELECT 1 FROM participants p JOIN participants_master pm ON pm.id = p.participant_id WHERE p.seu_id = s.id AND pm.user_id = $1)"` | $1::uuid IS NULL OR EXISTS (SELECT 1 FROM participants p JOIN participants_master pm ON pm.id = p.participant_id WHERE p.seu_id = s.id AND pm.user_id = $1) | |
| src/dblayer/versionEventsDB.ts | 6 | `occurredAt : "occurred_at"` | occurred_at | |
| src/dblayer/versionEventsDB.ts | 7 | `entityType : "entity_type"` | entity_type | |
| src/dblayer/versionEventsDB.ts | 8 | `versionEvent : "version_event"` | version_event | |
| src/utils/listQuery.ts | 46 | `reqQuery.sort : ""` |  | |
| src/utils/db.ts | 87 | `this.name = "DatabaseConnectionError"` | DatabaseConnectionError | |
| src/dev/actAs.ts | 94 | `type : "Human"` | Human | |
| src/domain/identity/badgeBootstrap.ts | 39 | `type : "Human"` | Human | |
| src/domain/identity/badgeBootstrap.ts | 51 | `badge : "root"` | root | |
| src/domain/auth/emailService.ts | 30 | `subject = "Reset your CapWise password"` | Reset your CapWise password | |
| src/domain/auth/emailService.ts | 58 | `subject = "Set your CapWise password"` | Set your CapWise password | |
| src/domain/sdk/authoringScope.ts | 1 | `AUTHORING_SCOPE_PACK_CODE = "sdk-authoring-scope"` | sdk-authoring-scope | |
| src/domain/sdk/schemaCompiler.ts | 67 | `matchValue : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 67 | `source : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 71 | `date : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 74 | `WidgetKind = "text"` | text | |
| src/domain/sdk/schemaCompiler.ts | 76 | `name : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 76 | `label : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 76 | `help : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 76 | `group : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 76 | `showWhen : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 76 | `showWhenValues : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 77 | `pattern : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 77 | `minLength : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 77 | `defaultValue : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 78 | `enumValues : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 79 | `referentialSource : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 79 | `drivenMode : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 79 | `driverField : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 79 | `driverSuffix : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 83 | `rawType : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 90 | `key : "metadata"` | metadata | |
| src/domain/sdk/schemaCompiler.ts | 90 | `label : "Identity & Metadata"` | Identity & Metadata | |
| src/domain/sdk/schemaCompiler.ts | 116 | `matchValue : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 151 | `prop.type = "string"` | string | |
| src/domain/sdk/schemaCompiler.ts | 190 | `type : "string"` | string | |
| src/domain/sdk/schemaCompiler.ts | 240 | `prop.type = "array"` | array | |
| src/domain/sdk/schemaCompiler.ts | 241 | `type : "object"` | object | |
| src/domain/sdk/schemaCompiler.ts | 260 | `prop.type = "object"` | object | |
| src/domain/sdk/schemaCompiler.ts | 287 | `w.kind = "list"` | list | |
| src/domain/sdk/schemaCompiler.ts | 303 | `w.kind = "object"` | object | |
| src/domain/sdk/schemaCompiler.ts | 316 | `w.kind = "generated"` | generated | |
| src/domain/sdk/schemaCompiler.ts | 321 | `w.kind = "json"` | json | |
| src/domain/sdk/schemaCompiler.ts | 332 | `w.kind = "referential-by-scope"` | referential-by-scope | |
| src/domain/sdk/schemaCompiler.ts | 335 | `w.drivenMode = "by-value"` | by-value | |
| src/domain/sdk/schemaCompiler.ts | 342 | `w.kind = "referential-dynamic"` | referential-dynamic | |
| src/domain/sdk/schemaCompiler.ts | 350 | `w.kind = "referential"` | referential | |
| src/domain/sdk/schemaCompiler.ts | 356 | `w.drivenMode = "by-suffix"` | by-suffix | |
| src/domain/sdk/schemaCompiler.ts | 365 | `w.kind = "referential-multi"` | referential-multi | |
| src/domain/sdk/schemaCompiler.ts | 391 | `w.kind = "version"` | version | |
| src/domain/sdk/schemaCompiler.ts | 397 | `w.kind = "select"` | select | |
| src/domain/sdk/schemaCompiler.ts | 404 | `w.kind = "boolean"` | boolean | |
| src/domain/sdk/schemaCompiler.ts | 405 | `w.defaultValue = "true"` | true | |
| src/domain/sdk/schemaCompiler.ts | 406 | `w.defaultValue = "false"` | false | |
| src/domain/sdk/schemaCompiler.ts | 432 | `type : "object"` | object | |
| src/domain/sdk/schemaCompiler.ts | 478 | `raw.drivenMode : ""` |  | |
| src/domain/sdk/schemaCompiler.ts | 563 | `kind : "removed"` | removed | |
| src/domain/sdk/schemaCompiler.ts | 568 | `kind : "added"` | added | |
| src/domain/sdk/schemaCompiler.ts | 574 | `kind : "type-changed"` | type-changed | |
| src/domain/sdk/schemaCompiler.ts | 579 | `kind : "newly-required"` | newly-required | |
| src/domain/sdk/schemaCompiler.ts | 581 | `kind : "now-optional"` | now-optional | |
| src/domain/sdk/schemaCompiler.ts | 584 | `kind : "enum-changed"` | enum-changed | |
| src/domain/sdk/schemaCompiler.ts | 587 | `kind : "pattern-changed"` | pattern-changed | |
| src/domain/sdk/schemaCompiler.ts | 590 | `kind : "default-changed"` | default-changed | |
| src/domain/engine/redispatch.ts | 61 | `category : "Operational"` | Operational | |
| src/domain/engine/redispatch.ts | 69 | `category : "Action Required"` | Action Required | |
| src/domain/engine/redispatch.ts | 70 | `priority : "High"` | High | |
| src/domain/engine/redispatch.ts | 85 | `reason : "redispatch_exhausted"` | redispatch_exhausted | |
| src/domain/engine/redispatch.ts | 93 | `category : "Escalation"` | Escalation | |
| src/domain/engine/redispatch.ts | 94 | `priority : "Medium"` | Medium | |
| src/domain/engine/transitionEngine.ts | 17 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/domain/engine/transitionEngine.ts | 18 | `reason : "authority_denied"` | authority_denied | |
| src/domain/engine/transitionEngine.ts | 19 | `reason : "policy_blocked"` | policy_blocked | |
| src/domain/engine/transitionEngine.ts | 20 | `reason : "not_submitted"` | not_submitted | |
| src/domain/engine/transitionEngine.ts | 21 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/transitionEngine.ts | 54 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/domain/engine/transitionEngine.ts | 55 | `reason : "authority_denied"` | authority_denied | |
| src/domain/engine/transitionEngine.ts | 56 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/transitionEngine.ts | 57 | `reason : "not_submitted"` | not_submitted | |
| src/domain/engine/transitionEngine.ts | 58 | `reason : "policy_blocked"` | policy_blocked | |
| src/domain/engine/transitionEngine.ts | 84 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/transitionEngine.ts | 94 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/domain/engine/transitionEngine.ts | 102 | `reason : "authority_denied"` | authority_denied | |
| src/domain/engine/transitionEngine.ts | 118 | `reason : "not_submitted"` | not_submitted | |
| src/domain/engine/transitionEngine.ts | 152 | `reason : "policy_blocked"` | policy_blocked | |
| src/domain/engine/transitionEngine.ts | 183 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/materialiseDependencyGraph.ts | 5 | `GATED_TO_STATE = "In Progress"` | In Progress | |
| src/domain/engine/materialiseDependencyGraph.ts | 6 | `DEFAULT_DELIVERABLE_REQUIRED_STATE = "Approved"` | Approved | |
| src/domain/engine/materialiseDependencyGraph.ts | 32 | `fromEntityType : "Deliverable"` | Deliverable | |
| src/domain/engine/materialiseDependencyGraph.ts | 35 | `toEntityType : "Deliverable"` | Deliverable | |
| src/domain/engine/eventBus.ts | 71 | `status : "pending"` | pending | |
| src/domain/engine/badgeAuthorityEngine.ts | 4 | `ROOT_BADGE_CODE = "root"` | root | |
| src/domain/engine/badgeAuthorityEngine.ts | 41 | `via : "root"` | root | |
| src/domain/engine/badgeAuthorityEngine.ts | 44 | `via : "badge"` | badge | |
| src/domain/engine/badgeAuthorityEngine.ts | 47 | `via : "badge"` | badge | |
| src/domain/engine/badgeAuthorityEngine.ts | 48 | `reason : "missing_badge"` | missing_badge | |
| src/domain/engine/compositionEngine.ts | 88 | `pathPrefix = ""` |  | |
| src/domain/engine/ebmActivated.ts | 23 | `stage : "finalize_commissioning"` | finalize_commissioning | |
| src/domain/engine/metricRegistryEngine.ts | 159 | `outcome : "Computed"` | Computed | |
| src/domain/engine/metricRegistryEngine.ts | 160 | `outcome : "NotFound"` | NotFound | |
| src/domain/engine/metricRegistryEngine.ts | 161 | `outcome : "UnrecognisedMethod"` | UnrecognisedMethod | |
| src/domain/engine/metricRegistryEngine.ts | 166 | `outcome : "NotFound"` | NotFound | |
| src/domain/engine/metricRegistryEngine.ts | 170 | `outcome : "UnrecognisedMethod"` | UnrecognisedMethod | |
| src/domain/engine/metricRegistryEngine.ts | 187 | `outcome : "Computed"` | Computed | |
| src/domain/engine/dispatchEngine.ts | 32 | `category : "Operational"` | Operational | |
| src/domain/engine/dispatchEngine.ts | 40 | `category : "Action Required"` | Action Required | |
| src/domain/engine/dispatchEngine.ts | 41 | `priority : "High"` | High | |
| src/domain/engine/dispatchEngine.ts | 100 | `reason : "no_available_participant"` | no_available_participant | |
| src/domain/engine/policyEngine.ts | 10 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 11 | `outcome : "Passed"` | Passed | |
| src/domain/engine/policyEngine.ts | 12 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/policyEngine.ts | 25 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 27 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 29 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 31 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 36 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 44 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/policyEngine.ts | 76 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/policyEngine.ts | 90 | `outcome : "Passed"` | Passed | |
| src/domain/engine/profileCompositionUnravel.ts | 48 | `profileField : "primaryProgrammingLanguage"` | primaryProgrammingLanguage | |
| src/domain/engine/profileCompositionUnravel.ts | 48 | `dimension : "Technology"` | Technology | |
| src/domain/engine/profileCompositionUnravel.ts | 49 | `profileField : "domain"` | domain | |
| src/domain/engine/profileCompositionUnravel.ts | 49 | `dimension : "Domain"` | Domain | |
| src/domain/engine/profileCompositionUnravel.ts | 171 | `propertyName : "deliverableCatalogue"` | deliverableCatalogue | |
| src/domain/engine/profileCompositionUnravel.ts | 176 | `propertyName : "dependencyGraph"` | dependencyGraph | |
| src/domain/engine/executionEngine.ts | 29 | `reason : "dependency_not_satisfied"` | dependency_not_satisfied | |
| src/domain/engine/executionEngine.ts | 31 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/executionEngine.ts | 33 | `reason : "empty_centre"` | empty_centre | |
| src/domain/engine/executionEngine.ts | 34 | `reason : "already_in_flight"` | already_in_flight | |
| src/domain/engine/executionEngine.ts | 67 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 69 | `reason : "dependency_not_satisfied"` | dependency_not_satisfied | |
| src/domain/engine/executionEngine.ts | 75 | `reason : "seu_blocked"` | seu_blocked | |
| src/domain/engine/executionEngine.ts | 81 | `reason : "obligation_blocked"` | obligation_blocked | |
| src/domain/engine/executionEngine.ts | 87 | `reason : "decision_blocked"` | decision_blocked | |
| src/domain/engine/executionEngine.ts | 95 | `reason : "already_in_flight"` | already_in_flight | |
| src/domain/engine/executionEngine.ts | 100 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/domain/engine/executionEngine.ts | 107 | `reason : "authority_denied"` | authority_denied | |
| src/domain/engine/executionEngine.ts | 114 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 126 | `category : "Action Required"` | Action Required | |
| src/domain/engine/executionEngine.ts | 129 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 133 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/domain/engine/executionEngine.ts | 142 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 153 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 156 | `reason : "policy_blocked"` | policy_blocked | |
| src/domain/engine/executionEngine.ts | 162 | `reason : "not_submitted"` | not_submitted | |
| src/domain/engine/executionEngine.ts | 169 | `reason : "empty_centre"` | empty_centre | |
| src/domain/engine/executionEngine.ts | 169 | `detail : "cannot approve a Deliverable with no attached reference — nothing has been produced to approve"` | cannot approve a Deliverable with no attached reference — nothing has been produced to approve | |
| src/domain/engine/executionEngine.ts | 194 | `entity_type : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 230 | `reason : "already_in_flight"` | already_in_flight | |
| src/domain/engine/executionEngine.ts | 249 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 269 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/executionEngine.ts | 288 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/compositionCompleted.ts | 36 | `stage : "compose_ebm"` | compose_ebm | |
| src/domain/engine/compositionCompleted.ts | 106 | `stage : "compose_ebm"` | compose_ebm | |
| src/domain/engine/validateRequest.ts | 28 | `stage : "validate_request"` | validate_request | |
| src/domain/engine/validateRequest.ts | 57 | `entityType : "SEU"` | SEU | |
| src/domain/engine/validateRequest.ts | 58 | `fromState : "Pending"` | Pending | |
| src/domain/engine/validateRequest.ts | 59 | `toState : "Commissioned"` | Commissioned | |
| src/domain/engine/validateRequest.ts | 64 | `item : "Authority (badge seu_commission)"` | Authority (badge seu_commission) | |
| src/domain/engine/validateRequest.ts | 64 | `status : "live"` | live | |
| src/domain/engine/validateRequest.ts | 66 | `item : "Authority (badge seu_commission)"` | Authority (badge seu_commission) | |
| src/domain/engine/validateRequest.ts | 67 | `status : "dead"` | dead | |
| src/domain/engine/validateRequest.ts | 81 | `stage : "validate_request"` | validate_request | |
| src/domain/engine/validateRequest.ts | 100 | `stage : "validate_request"` | validate_request | |
| src/domain/engine/validateRequest.ts | 100 | `reason : "stale_reference"` | stale_reference | |
| src/domain/engine/qualityGateEngine.ts | 26 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/qualityGateEngine.ts | 27 | `outcome : "Passed"` | Passed | |
| src/domain/engine/qualityGateEngine.ts | 28 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/qualityGateEngine.ts | 29 | `outcome : "Waived"` | Waived | |
| src/domain/engine/qualityGateEngine.ts | 33 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/qualityGateEngine.ts | 34 | `outcome : "Waived"` | Waived | |
| src/domain/engine/qualityGateEngine.ts | 64 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/qualityGateEngine.ts | 72 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/qualityGateEngine.ts | 78 | `outcome : "Passed"` | Passed | |
| src/domain/engine/qualityGateEngine.ts | 85 | `outcome : "NotApplicable"` | NotApplicable | |
| src/domain/engine/qualityGateEngine.ts | 91 | `outcome : "Passed"` | Passed | |
| src/domain/engine/qualityGateEngine.ts | 173 | `outcome : "Passed"` | Passed | |
| src/domain/engine/qualityGateEngine.ts | 184 | `outcome : "Passed"` | Passed | |
| src/domain/engine/qualityGateEngine.ts | 193 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/qualityGateEngine.ts | 204 | `outcome : "Blocked"` | Blocked | |
| src/domain/engine/qualityGateEngine.ts | 213 | `outcome : "Waived"` | Waived | |
| src/domain/engine/qualityGateEngine.ts | 224 | `outcome : "Waived"` | Waived | |
| src/domain/engine/dispatchStrategies.ts | 114 | `strategy : "capability-match"` | capability-match | |
| src/domain/engine/supersessionEngine.ts | 3 | `reason : "superseding_target_required"` | superseding_target_required | |
| src/domain/engine/supersessionEngine.ts | 4 | `reason : "superseding_target_not_found"` | superseding_target_not_found | |
| src/domain/engine/supersessionEngine.ts | 5 | `reason : "comment_required"` | comment_required | |
| src/domain/engine/supersessionEngine.ts | 17 | `reason : "superseding_target_required"` | superseding_target_required | |
| src/domain/engine/supersessionEngine.ts | 21 | `reason : "superseding_target_not_found"` | superseding_target_not_found | |
| src/domain/engine/supersessionEngine.ts | 25 | `reason : "comment_required"` | comment_required | |
| src/domain/engine/supersessionEngine.ts | 25 | `detail : "Supersede requires a comment explaining the supersession."` | Supersede requires a comment explaining the supersession. | |
| src/domain/engine/conceptCreated.ts | 28 | `status : "Draft"` | Draft | |
| src/domain/engine/deliverableKickoff.ts | 117 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/deliverableKickoff.ts | 179 | `entityType : "Deliverable"` | Deliverable | |
| src/domain/engine/deliverableKickoff.ts | 210 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/domain/engine/deliverableKickoff.ts | 212 | `category : "Operational"` | Operational | |
| src/domain/engine/deliverableKickoff.ts | 223 | `category : "Action Required"` | Action Required | |
| src/domain/engine/deliverableKickoff.ts | 224 | `priority : "High"` | High | |
| src/domain/engine/deliverableKickoff.ts | 227 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/web/auth.ts | 25 | `standardHeaders : "draft-8"` | draft-8 | |
| src/routes/web/auth.ts | 42 | `title : "Sign in to SEU Studio"` | Sign in to SEU Studio | |
| src/routes/web/auth.ts | 71 | `failureRedirect : "/aisworg/login"` | /aisworg/login | |
| src/routes/web/auth.ts | 92 | `title : "Account Disabled"` | Account Disabled | |
| src/routes/web/auth.ts | 104 | `title : "Set Your Password"` | Set Your Password | |
| src/routes/web/auth.ts | 119 | `title : "Set Your Password"` | Set Your Password | |
| src/routes/web/auth.ts | 126 | `title : "Set Your Password"` | Set Your Password | |
| src/routes/web/auth.ts | 146 | `title : "Forgot Password"` | Forgot Password | |
| src/routes/web/auth.ts | 154 | `GENERIC = "If that email is registered, a reset link has been sent."` | If that email is registered, a reset link has been sent. | |
| src/routes/web/auth.ts | 181 | `title : "Reset Your Password"` | Reset Your Password | |
| src/routes/web/auth.ts | 195 | `title : "Reset Your Password"` | Reset Your Password | |
| src/routes/web/auth.ts | 201 | `title : "Reset Your Password"` | Reset Your Password | |
| src/routes/web/auth.ts | 221 | `title : "User Management"` | User Management | |
| src/routes/web/auth.ts | 222 | `activePage : "user-management"` | user-management | |
| src/routes/web/auth.ts | 224 | `listBasePath : "/aisworg/auth/users"` | /aisworg/auth/users | |
| src/routes/web/auth.ts | 249 | `type : "Platform"` | Platform | |
| src/routes/seu/core/sdkAuthoring.ts | 100 | `e.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 101 | `e.serviceDefinitionId : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 104 | `sl.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 151 | `content.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 162 | `v.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 163 | `v.label : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 164 | `v.target_level : "minimum"` | minimum | |
| src/routes/seu/core/sdkAuthoring.ts | 166 | `v.units : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 177 | `content.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 178 | `content.name : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 179 | `content.capabilityCode : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 196 | `row.name : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 206 | `v.title : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 207 | `v.category : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 208 | `v.description : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 209 | `v.collectionMethod : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 218 | `v.category : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 219 | `v.title : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 220 | `v.description : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 221 | `v.origin : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 222 | `v.priority : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 223 | `v.severity : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 224 | `v.completionCriteria : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 236 | `v.exceptionStatement : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 237 | `v.duration : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 238 | `v.exceptionScope : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 241 | `v.reviewRequirements : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 252 | `type : "always_true"` | always_true | |
| src/routes/seu/core/sdkAuthoring.ts | 263 | `v.operator : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 264 | `v.value : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 275 | `v.statement : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 276 | `v.severity : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 287 | `content.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 288 | `content.name : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 290 | `content.category : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 312 | `v.name : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 320 | `content.code : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 321 | `content.defaultLabel : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 323 | `content.category : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 460 | `current = "Draft"` | Draft | |
| src/routes/seu/core/sdkAuthoring.ts | 495 | `endpoint : "publish"` | publish | |
| src/routes/seu/core/sdkAuthoring.ts | 495 | `endpoint : "transition"` | transition | |
| src/routes/seu/core/sdkAuthoring.ts | 662 | `priorContent.description : ""` |  | |
| src/routes/seu/core/sdkAuthoring.ts | 739 | `badge : "pack_define"` | pack_define | |
| src/routes/seu/core/sdkAuthoring.ts | 741 | `badge : "pack_define"` | pack_define | |
| src/routes/seu/core/sdkAuthoring.ts | 763 | `badge : "template_define"` | template_define | |
| src/routes/seu/core/sdkAuthoring.ts | 804 | `badge : "profile_define"` | profile_define | |
| src/routes/seu/core/sdkAuthoring.ts | 909 | `badge : "policy_define"` | policy_define | |
| src/routes/seu/core/sdkAuthoring.ts | 983 | `badge : "pack_define"` | pack_define | |
| src/routes/seu/core/sdkAuthoring.ts | 985 | `badge : "pack_define"` | pack_define | |
| src/routes/seu/core/sdkAuthoring.ts | 999 | `badge : "template_define"` | template_define | |
| src/routes/seu/core/sdkAuthoring.ts | 1026 | `badge : "profile_define"` | profile_define | |
| src/routes/seu/core/sdkAuthoring.ts | 1073 | `badge : "policy_define"` | policy_define | |
| src/routes/seu/core/sdkAuthoring.ts | 1320 | `kind : "Pack"` | Pack | |
| src/routes/seu/core/profiles.ts | 173 | `field : "targetCloudProvider"` | targetCloudProvider | |
| src/routes/seu/core/profiles.ts | 173 | `parameterCode : "target-cloud-provider"` | target-cloud-provider | |
| src/routes/seu/core/profiles.ts | 174 | `field : "primaryProgrammingLanguage"` | primaryProgrammingLanguage | |
| src/routes/seu/core/profiles.ts | 174 | `parameterCode : "primary-programming-language"` | primary-programming-language | |
| src/routes/seu/core/profiles.ts | 175 | `field : "sourceControlProvider"` | sourceControlProvider | |
| src/routes/seu/core/profiles.ts | 175 | `parameterCode : "source-control-provider"` | source-control-provider | |
| src/routes/seu/core/profiles.ts | 176 | `field : "deploymentStrategy"` | deploymentStrategy | |
| src/routes/seu/core/profiles.ts | 176 | `parameterCode : "deployment-strategy"` | deployment-strategy | |
| src/routes/seu/core/profiles.ts | 177 | `field : "aiProviderPreference"` | aiProviderPreference | |
| src/routes/seu/core/profiles.ts | 177 | `parameterCode : "ai-provider-preference"` | ai-provider-preference | |
| src/routes/seu/core/profiles.ts | 178 | `field : "defaultRepositoryStructure"` | defaultRepositoryStructure | |
| src/routes/seu/core/profiles.ts | 178 | `parameterCode : "default-repository-structure"` | default-repository-structure | |
| src/routes/seu/core/profiles.ts | 179 | `field : "documentationLevel"` | documentationLevel | |
| src/routes/seu/core/profiles.ts | 179 | `parameterCode : "documentation-level"` | documentation-level | |
| src/routes/seu/core/profiles.ts | 180 | `field : "developmentMethodology"` | developmentMethodology | |
| src/routes/seu/core/profiles.ts | 180 | `parameterCode : "development-methodology"` | development-methodology | |
| src/routes/seu/core/profiles.ts | 181 | `field : "domain"` | domain | |
| src/routes/seu/core/profiles.ts | 181 | `parameterCode : "domain"` | domain | |
| src/routes/seu/core/profiles.ts | 188 | `field : "technologyPackCodes"` | technologyPackCodes | |
| src/routes/seu/core/profiles.ts | 188 | `packCategory : "Technology"` | Technology | |
| src/routes/seu/core/profiles.ts | 189 | `field : "domainPackCodes"` | domainPackCodes | |
| src/routes/seu/core/profiles.ts | 189 | `packCategory : "Domain"` | Domain | |
| src/routes/seu/core/profiles.ts | 190 | `field : "compliancePackCodes"` | compliancePackCodes | |
| src/routes/seu/core/profiles.ts | 190 | `packCategory : "Compliance"` | Compliance | |
| src/routes/seu/core/profiles.ts | 191 | `field : "integrationPackCodes"` | integrationPackCodes | |
| src/routes/seu/core/profiles.ts | 191 | `packCategory : "Integration"` | Integration | |
| src/routes/seu/core/profiles.ts | 192 | `field : "engineeringPackCodes"` | engineeringPackCodes | |
| src/routes/seu/core/profiles.ts | 192 | `packCategory : "Engineering"` | Engineering | |
| src/routes/seu/core/profiles.ts | 193 | `field : "organisationPackCodes"` | organisationPackCodes | |
| src/routes/seu/core/profiles.ts | 193 | `packCategory : "Organisation"` | Organisation | |
| src/routes/seu/core/profiles.ts | 353 | `requiredBadge : "profile_define"` | profile_define | |
| src/routes/seu/core/profiles.ts | 403 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/profiles.ts | 406 | `entityType : "Profile"` | Profile | |
| src/routes/seu/core/profiles.ts | 408 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/profiles.ts | 409 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/profiles.ts | 410 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 446 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 486 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 487 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 488 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 488 | `detail : "no authority badge resolved for this Profile reactivation"` | no authority badge resolved for this Profile reactivation | |
| src/routes/seu/core/profiles.ts | 490 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 504 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 507 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/profiles.ts | 518 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/profiles.ts | 590 | `Draft : "Validated"` | Validated | |
| src/routes/seu/core/profiles.ts | 591 | `Validated : "Published"` | Published | |
| src/routes/seu/core/profiles.ts | 592 | `Published : "Active"` | Active | |
| src/routes/seu/core/profiles.ts | 593 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/profiles.ts | 594 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/profiles.ts | 595 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/profiles.ts | 600 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/core/profiles.ts | 604 | `targetState : "Active"` | Active | |
| src/routes/seu/core/profiles.ts | 607 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/workItemHeartbeat.ts | 35 | `category : "Escalation"` | Escalation | |
| src/routes/seu/core/workItemHeartbeat.ts | 36 | `priority : "High"` | High | |
| src/routes/seu/core/workItemHeartbeat.ts | 39 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/evidence.ts | 87 | `versionEvent : "VersionSuperseded"` | VersionSuperseded | |
| src/routes/seu/core/evidence.ts | 118 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/evidence.ts | 123 | `reason : "invalid"` | invalid | |
| src/routes/seu/core/evidence.ts | 128 | `reason : "invalid"` | invalid | |
| src/routes/seu/core/evidence.ts | 163 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/evidence.ts | 196 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/evidence.ts | 197 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/evidence.ts | 202 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/evidence.ts | 211 | `entityType : "Evidence"` | Evidence | |
| src/routes/seu/core/identity.ts | 119 | `detail : "user not found"` | user not found | |
| src/routes/seu/core/identity.ts | 129 | `detail : "user not found"` | user not found | |
| src/routes/seu/core/identity.ts | 140 | `type : "Human"` | Human | |
| src/routes/seu/core/identity.ts | 166 | `detail : "user not found"` | user not found | |
| src/routes/seu/core/identity.ts | 178 | `type : "Human"` | Human | |
| src/routes/seu/core/identity.ts | 195 | `reason : "validation_failed"` | validation_failed | |
| src/routes/seu/core/identity.ts | 199 | `reason : "validation_failed"` | validation_failed | |
| src/routes/seu/core/identity.ts | 253 | `detail : "user not found"` | user not found | |
| src/routes/seu/core/identity.ts | 254 | `detail : "that user is not in your tenant"` | that user is not in your tenant | |
| src/routes/seu/core/workItems.ts | 13 | `outcome : "done"` | done | |
| src/routes/seu/core/workItems.ts | 23 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/workItems.ts | 25 | `reason : "not_outstanding"` | not_outstanding | |
| src/routes/seu/core/workItems.ts | 29 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/workItems.ts | 31 | `reason : "unsupported_entity_type"` | unsupported_entity_type | |
| src/routes/seu/core/workItems.ts | 59 | `category : "Exception"` | Exception | |
| src/routes/seu/core/workItems.ts | 60 | `priority : "High"` | High | |
| src/routes/seu/core/workItems.ts | 63 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/workItems.ts | 74 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/workItems.ts | 111 | `outcome : "done"` | done | |
| src/routes/seu/core/workItems.ts | 111 | `status : "Disposed"` | Disposed | |
| src/routes/seu/core/packs.ts | 53 | `governedTransition : "Deliverable\|Approved\|Baselined"` | Deliverable|Approved|Baselined | |
| src/routes/seu/core/packs.ts | 59 | `governedTransition : "Deliverable\|Approved\|Baselined"` | Deliverable|Approved|Baselined | |
| src/routes/seu/core/packs.ts | 64 | `statement : ""` |  | |
| src/routes/seu/core/packs.ts | 64 | `severity : "Medium"` | Medium | |
| src/routes/seu/core/packs.ts | 65 | `title : ""` |  | |
| src/routes/seu/core/packs.ts | 65 | `category : ""` |  | |
| src/routes/seu/core/packs.ts | 65 | `description : ""` |  | |
| src/routes/seu/core/packs.ts | 65 | `collectionMethod : ""` |  | |
| src/routes/seu/core/packs.ts | 469 | `targetState : "Active"` | Active | |
| src/routes/seu/core/packs.ts | 474 | `targetState : "Retired"` | Retired | |
| src/routes/seu/core/packs.ts | 483 | `Draft : "Validated"` | Validated | |
| src/routes/seu/core/packs.ts | 484 | `Validated : "Published"` | Published | |
| src/routes/seu/core/packs.ts | 485 | `Published : "Active"` | Active | |
| src/routes/seu/core/packs.ts | 494 | `targetState : "Active"` | Active | |
| src/routes/seu/core/packs.ts | 498 | `targetState : "Retired"` | Retired | |
| src/routes/seu/core/packs.ts | 510 | `requiredBadge : "pack_define"` | pack_define | |
| src/routes/seu/core/packs.ts | 607 | `type : "always_true"` | always_true | |
| src/routes/seu/core/packs.ts | 688 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/packs.ts | 689 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/packs.ts | 691 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/packs.ts | 703 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/packs.ts | 707 | `entityType : "Pack"` | Pack | |
| src/routes/seu/core/packs.ts | 716 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/packs.ts | 717 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/packs.ts | 718 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/packs.ts | 719 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/packs.ts | 720 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/packs.ts | 727 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/packs.ts | 727 | `detail : "Rejecting requires feedback — provide a comment explaining what needs to change."` | Rejecting requires feedback — provide a comment explaining what needs to change. | |
| src/routes/seu/core/packs.ts | 732 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/packs.ts | 732 | `detail : "Provide new feedback — this matches the most recent comment already on record."` | Provide new feedback — this matches the most recent comment already on record. | |
| src/routes/seu/core/knowledge.ts | 98 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/knowledge.ts | 99 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/knowledge.ts | 104 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/knowledge.ts | 109 | `entityType : "Knowledge"` | Knowledge | |
| src/routes/seu/core/knowledge.ts | 139 | `SEU : "Low"` | Low | |
| src/routes/seu/core/knowledge.ts | 139 | `Capability : "Medium"` | Medium | |
| src/routes/seu/core/knowledge.ts | 139 | `Enterprise : "High"` | High | |
| src/routes/seu/core/knowledge.ts | 139 | `Platform : "High"` | High | |
| src/routes/seu/core/knowledge.ts | 143 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/knowledge.ts | 144 | `reason : "not_published"` | not_published | |
| src/routes/seu/core/knowledge.ts | 145 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/knowledge.ts | 150 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/knowledge.ts | 153 | `reason : "not_published"` | not_published | |
| src/routes/seu/core/knowledge.ts | 158 | `entityType : "KnowledgeScope"` | KnowledgeScope | |
| src/routes/seu/core/knowledge.ts | 168 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/knowledge.ts | 170 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/knowledge.ts | 171 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/knowledge.ts | 172 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/knowledge.ts | 173 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/knowledge.ts | 193 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/knowledge.ts | 195 | `category : "Organisational Learning"` | Organisational Learning | |
| src/routes/seu/core/knowledge.ts | 199 | `origin : "Telemetry and Knowledge Model"` | Telemetry and Knowledge Model | |
| src/routes/seu/core/knowledge.ts | 200 | `originatingEntityType : "Knowledge"` | Knowledge | |
| src/routes/seu/core/deliverableDefinitions.ts | 63 | `Validated : "DeliverableDefinitionValidated"` | DeliverableDefinitionValidated | |
| src/routes/seu/core/deliverableDefinitions.ts | 64 | `Published : "DeliverableDefinitionPublished"` | DeliverableDefinitionPublished | |
| src/routes/seu/core/deliverableDefinitions.ts | 65 | `Active : "DeliverableDefinitionActivated"` | DeliverableDefinitionActivated | |
| src/routes/seu/core/deliverableDefinitions.ts | 66 | `Deprecated : "DeliverableDefinitionDeprecated"` | DeliverableDefinitionDeprecated | |
| src/routes/seu/core/deliverableDefinitions.ts | 67 | `Retired : "DeliverableDefinitionRetired"` | DeliverableDefinitionRetired | |
| src/routes/seu/core/deliverableDefinitions.ts | 68 | `Archived : "DeliverableDefinitionArchived"` | DeliverableDefinitionArchived | |
| src/routes/seu/core/deliverableDefinitions.ts | 82 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/deliverableDefinitions.ts | 84 | `entityType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/deliverableDefinitions.ts | 86 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/deliverableDefinitions.ts | 87 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/deliverableDefinitions.ts | 88 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 92 | `reason : "not_authorised"` | not_authorised | |
| src/routes/seu/core/deliverableDefinitions.ts | 130 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 131 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 132 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 132 | `detail : "no authority badge resolved for this Deliverable Definition reactivation"` | no authority badge resolved for this Deliverable Definition reactivation | |
| src/routes/seu/core/deliverableDefinitions.ts | 134 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 146 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/deliverableDefinitions.ts | 157 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/deliverableDefinitions.ts | 164 | `Draft : "Validated"` | Validated | |
| src/routes/seu/core/deliverableDefinitions.ts | 165 | `Validated : "Published"` | Published | |
| src/routes/seu/core/deliverableDefinitions.ts | 166 | `Published : "Active"` | Active | |
| src/routes/seu/core/deliverableDefinitions.ts | 167 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/deliverableDefinitions.ts | 168 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/deliverableDefinitions.ts | 169 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/deliverableDefinitions.ts | 174 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/core/deliverableDefinitions.ts | 178 | `targetState : "Active"` | Active | |
| src/routes/seu/core/deliverableDefinitions.ts | 181 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/participants.ts | 24 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/participants.ts | 30 | `entityType : "Participant"` | Participant | |
| src/routes/seu/core/participants.ts | 39 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/participants.ts | 40 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/participants.ts | 41 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/participants.ts | 42 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/participants.ts | 43 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/participants.ts | 69 | `reason : "no_active_fulfilment"` | no_active_fulfilment | |
| src/routes/seu/core/participants.ts | 81 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/participants.ts | 85 | `reason : "no_active_fulfilment"` | no_active_fulfilment | |
| src/routes/seu/core/participants.ts | 88 | `targetState : "Released"` | Released | |
| src/routes/seu/core/participants.ts | 91 | `targetState : "Archived"` | Archived | |
| src/routes/seu/core/ontology.ts | 24 | `Deliverable : "deliverable-name"` | deliverable-name | |
| src/routes/seu/core/ontology.ts | 25 | `Evidence : "category:evidence"` | category:evidence | |
| src/routes/seu/core/ontology.ts | 26 | `Decision : "category:decision"` | category:decision | |
| src/routes/seu/core/ontology.ts | 27 | `Knowledge : "category:knowledge"` | category:knowledge | |
| src/routes/seu/core/ontology.ts | 28 | `Obligation : "category:obligation"` | category:obligation | |
| src/routes/seu/core/ontology.ts | 29 | `EventType : "category:event-types"` | category:event-types | |
| src/routes/seu/core/ontology.ts | 30 | `QualityGate : "category:evidence"` | category:evidence | |
| src/routes/seu/core/ontology.ts | 325 | `status : "Draft"` | Draft | |
| src/routes/seu/core/ontology.ts | 392 | `reason : "superseded by new version"` | superseded by new version | |
| src/routes/seu/core/ontology.ts | 427 | `entityType : "Ontology"` | Ontology | |
| src/routes/seu/core/ontology.ts | 546 | `actorBadge : "root"` | root | |
| src/routes/seu/core/ontology.ts | 559 | `reason : "no other Version of this code remains Active"` | no other Version of this code remains Active | |
| src/routes/seu/core/ontology.ts | 587 | `compositionStrategy : "override"` | override | |
| src/routes/seu/core/ontology.ts | 604 | `compositionStrategy : "specialization"` | specialization | |
| src/routes/seu/core/attentionItems.ts | 94 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/attentionItems.ts | 95 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/attentionItems.ts | 100 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/attentionItems.ts | 105 | `entityType : "AttentionItem"` | AttentionItem | |
| src/routes/seu/core/dataMigrations.ts | 23 | `code : "transition-definitions"` | transition-definitions | |
| src/routes/seu/core/dataMigrations.ts | 23 | `label : "Transition definitions + authority vocabulary"` | Transition definitions + authority vocabulary | |
| src/routes/seu/core/dataMigrations.ts | 24 | `code : "event-subscriptions"` | event-subscriptions | |
| src/routes/seu/core/dataMigrations.ts | 24 | `label : "Event registry + subscriptions"` | Event registry + subscriptions | |
| src/routes/seu/core/dataMigrations.ts | 25 | `code : "schema-definitions"` | schema-definitions | |
| src/routes/seu/core/dataMigrations.ts | 25 | `label : "Schema definitions"` | Schema definitions | |
| src/routes/seu/core/dataMigrations.ts | 26 | `code : "capability-definitions"` | capability-definitions | |
| src/routes/seu/core/dataMigrations.ts | 26 | `label : "Capability definitions"` | Capability definitions | |
| src/routes/seu/core/dataMigrations.ts | 27 | `code : "service-definitions"` | service-definitions | |
| src/routes/seu/core/dataMigrations.ts | 27 | `label : "Service definitions"` | Service definitions | |
| src/routes/seu/core/dataMigrations.ts | 28 | `code : "route-authority"` | route-authority | |
| src/routes/seu/core/dataMigrations.ts | 28 | `label : "Route authority"` | Route authority | |
| src/routes/seu/core/dataMigrations.ts | 29 | `code : "ontology-concepts"` | ontology-concepts | |
| src/routes/seu/core/dataMigrations.ts | 29 | `label : "Ontology concepts (baseline)"` | Ontology concepts (baseline) | |
| src/routes/seu/core/dataMigrations.ts | 35 | `authorBadge : "root"` | root | |
| src/routes/seu/core/capabilityRetrySweep.ts | 44 | `category : "Escalation"` | Escalation | |
| src/routes/seu/core/capabilityRetrySweep.ts | 45 | `priority : "Medium"` | Medium | |
| src/routes/seu/core/capabilityRetrySweep.ts | 48 | `relatedObjectType : "SEU"` | SEU | |
| src/routes/seu/core/capabilities.ts | 89 | `entityType : "Capability"` | Capability | |
| src/routes/seu/core/capabilities.ts | 91 | `newState : "Fulfilled"` | Fulfilled | |
| src/routes/seu/core/capabilities.ts | 200 | `targetState : "Released"` | Released | |
| src/routes/seu/core/capabilities.ts | 203 | `targetState : "Archived"` | Archived | |
| src/routes/seu/core/objectives.ts | 112 | `ONE_SHOT_CONTAINER_STATEMENT = "Uncategorised — directly-commissioned SEUs"` | Uncategorised — directly-commissioned SEUs | |
| src/routes/seu/core/objectives.ts | 120 | `tier : "Strategic"` | Strategic | |
| src/routes/seu/core/objectives.ts | 121 | `status : "Active"` | Active | |
| src/routes/seu/core/objectives.ts | 412 | `entityType : "Objective"` | Objective | |
| src/routes/seu/core/objectives.ts | 538 | `targetState : "Retired"` | Retired | |
| src/routes/seu/core/objectives.ts | 540 | `detail = "detail"` | detail | |
| src/routes/seu/core/objectives.ts | 554 | `targetState : "Retired"` | Retired | |
| src/routes/seu/core/objectives.ts | 663 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/objectives.ts | 664 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/objectives.ts | 666 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/objectives.ts | 668 | `reason : "superseding_target_wrong_tenant"` | superseding_target_wrong_tenant | |
| src/routes/seu/core/objectives.ts | 672 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/objectives.ts | 676 | `entityType : "Objective"` | Objective | |
| src/routes/seu/core/objectives.ts | 684 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/objectives.ts | 685 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/objectives.ts | 686 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/objectives.ts | 687 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/objectives.ts | 688 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/objectives.ts | 695 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/objectives.ts | 695 | `detail : "Rejecting requires feedback — provide a comment explaining what needs to change."` | Rejecting requires feedback — provide a comment explaining what needs to change. | |
| src/routes/seu/core/objectives.ts | 700 | `reason : "comment_required"` | comment_required | |
| src/routes/seu/core/objectives.ts | 700 | `detail : "Provide new feedback — this matches the most recent comment already on record."` | Provide new feedback — this matches the most recent comment already on record. | |
| src/routes/seu/core/objectives.ts | 719 | `reason : "superseding_target_wrong_tenant"` | superseding_target_wrong_tenant | |
| src/routes/seu/core/objectives.ts | 719 | `detail : "the superseding Objective belongs to a different tenant"` | the superseding Objective belongs to a different tenant | |
| src/routes/seu/core/dashboard.ts | 23 | `name : "User Experience Layer"` | User Experience Layer | |
| src/routes/seu/core/dashboard.ts | 24 | `name : "Admin UI"` | Admin UI | |
| src/routes/seu/core/dashboard.ts | 24 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 24 | `href : "/aisworg/seu"` | /aisworg/seu | |
| src/routes/seu/core/dashboard.ts | 27 | `name : "SEU Runtime Layer"` | SEU Runtime Layer | |
| src/routes/seu/core/dashboard.ts | 29 | `name : "SEU Runtime"` | SEU Runtime | |
| src/routes/seu/core/dashboard.ts | 29 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 29 | `href : "/aisworg/seu/seus"` | /aisworg/seu/seus | |
| src/routes/seu/core/dashboard.ts | 30 | `name : "Capability Runtime"` | Capability Runtime | |
| src/routes/seu/core/dashboard.ts | 30 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 30 | `href : "/aisworg/seu/seus"` | /aisworg/seu/seus | |
| src/routes/seu/core/dashboard.ts | 31 | `name : "Governance Runtime"` | Governance Runtime | |
| src/routes/seu/core/dashboard.ts | 31 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 32 | `name : "Work Item Runtime"` | Work Item Runtime | |
| src/routes/seu/core/dashboard.ts | 32 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 33 | `name : "Knowledge Runtime"` | Knowledge Runtime | |
| src/routes/seu/core/dashboard.ts | 33 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 33 | `href : "/aisworg/seu/knowledge/capital"` | /aisworg/seu/knowledge/capital | |
| src/routes/seu/core/dashboard.ts | 34 | `name : "Workflow Runtime"` | Workflow Runtime | |
| src/routes/seu/core/dashboard.ts | 34 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 35 | `name : "Traceability Runtime"` | Traceability Runtime | |
| src/routes/seu/core/dashboard.ts | 35 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 39 | `name : "Extension Framework"` | Extension Framework | |
| src/routes/seu/core/dashboard.ts | 41 | `name : "Pack Manager"` | Pack Manager | |
| src/routes/seu/core/dashboard.ts | 41 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 41 | `href : "/aisworg/seu/packs"` | /aisworg/seu/packs | |
| src/routes/seu/core/dashboard.ts | 42 | `name : "Extension Registry"` | Extension Registry | |
| src/routes/seu/core/dashboard.ts | 42 | `status : "deferred"` | deferred | |
| src/routes/seu/core/dashboard.ts | 43 | `name : "Dependency Manager"` | Dependency Manager | |
| src/routes/seu/core/dashboard.ts | 43 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 44 | `name : "Lifecycle Manager"` | Lifecycle Manager | |
| src/routes/seu/core/dashboard.ts | 44 | `status : "deferred"` | deferred | |
| src/routes/seu/core/dashboard.ts | 48 | `name : "Runtime Kernel"` | Runtime Kernel | |
| src/routes/seu/core/dashboard.ts | 50 | `name : "Event Bus"` | Event Bus | |
| src/routes/seu/core/dashboard.ts | 50 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 51 | `name : "Observability"` | Observability | |
| src/routes/seu/core/dashboard.ts | 51 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 51 | `href : "/aisworg/seu/telemetry"` | /aisworg/seu/telemetry | |
| src/routes/seu/core/dashboard.ts | 52 | `name : "Scheduling"` | Scheduling | |
| src/routes/seu/core/dashboard.ts | 52 | `status : "deferred"` | deferred | |
| src/routes/seu/core/dashboard.ts | 53 | `name : "Identity"` | Identity | |
| src/routes/seu/core/dashboard.ts | 53 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 54 | `name : "Security"` | Security | |
| src/routes/seu/core/dashboard.ts | 54 | `status : "partial"` | partial | |
| src/routes/seu/core/dashboard.ts | 55 | `name : "Storage"` | Storage | |
| src/routes/seu/core/dashboard.ts | 55 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 56 | `name : "Configuration"` | Configuration | |
| src/routes/seu/core/dashboard.ts | 56 | `status : "live"` | live | |
| src/routes/seu/core/dashboard.ts | 57 | `name : "Messaging"` | Messaging | |
| src/routes/seu/core/dashboard.ts | 57 | `status : "deferred"` | deferred | |
| src/routes/seu/core/templates.ts | 96 | `name : "applicabilityEnvironments"` | applicabilityEnvironments | |
| src/routes/seu/core/templates.ts | 96 | `label : "Applicable Environments"` | Applicable Environments | |
| src/routes/seu/core/templates.ts | 117 | `sourceType : "dependency"` | dependency | |
| src/routes/seu/core/templates.ts | 120 | `parameterName : "requiredState"` | requiredState | |
| src/routes/seu/core/templates.ts | 121 | `parameterLabel : "Required State"` | Required State | |
| src/routes/seu/core/templates.ts | 132 | `sourceType : "service"` | service | |
| src/routes/seu/core/templates.ts | 145 | `sourceType : "policy"` | policy | |
| src/routes/seu/core/templates.ts | 145 | `parameterName : "constraintType"` | constraintType | |
| src/routes/seu/core/templates.ts | 145 | `parameterLabel : "Constraint Type"` | Constraint Type | |
| src/routes/seu/core/templates.ts | 147 | `sourceType : "policy"` | policy | |
| src/routes/seu/core/templates.ts | 151 | `row.name : "Deliverable"` | Deliverable | |
| src/routes/seu/core/templates.ts | 153 | `sourceType : "policy"` | policy | |
| src/routes/seu/core/templates.ts | 156 | `parameterName : "transitions"` | transitions | |
| src/routes/seu/core/templates.ts | 157 | `parameterLabel : "Transitions"` | Transitions | |
| src/routes/seu/core/templates.ts | 173 | `sourceType : "checklist"` | checklist | |
| src/routes/seu/core/templates.ts | 198 | `field : "compliancePackCodes"` | compliancePackCodes | |
| src/routes/seu/core/templates.ts | 198 | `listKind : "compliance"` | compliance | |
| src/routes/seu/core/templates.ts | 198 | `packCategory : "Compliance"` | Compliance | |
| src/routes/seu/core/templates.ts | 199 | `field : "domainPackCodes"` | domainPackCodes | |
| src/routes/seu/core/templates.ts | 199 | `listKind : "domain"` | domain | |
| src/routes/seu/core/templates.ts | 199 | `packCategory : "Domain"` | Domain | |
| src/routes/seu/core/templates.ts | 200 | `field : "engineeringPackCodes"` | engineeringPackCodes | |
| src/routes/seu/core/templates.ts | 200 | `listKind : "engineering"` | engineering | |
| src/routes/seu/core/templates.ts | 200 | `packCategory : "Engineering"` | Engineering | |
| src/routes/seu/core/templates.ts | 201 | `field : "integrationPackCodes"` | integrationPackCodes | |
| src/routes/seu/core/templates.ts | 201 | `listKind : "integration"` | integration | |
| src/routes/seu/core/templates.ts | 201 | `packCategory : "Integration"` | Integration | |
| src/routes/seu/core/templates.ts | 202 | `field : "organisationPackCodes"` | organisationPackCodes | |
| src/routes/seu/core/templates.ts | 202 | `listKind : "organisation"` | organisation | |
| src/routes/seu/core/templates.ts | 202 | `packCategory : "Organisation"` | Organisation | |
| src/routes/seu/core/templates.ts | 203 | `field : "technologyPackCodes"` | technologyPackCodes | |
| src/routes/seu/core/templates.ts | 203 | `listKind : "technology"` | technology | |
| src/routes/seu/core/templates.ts | 203 | `packCategory : "Technology"` | Technology | |
| src/routes/seu/core/templates.ts | 475 | `requiredBadge : "template_define"` | template_define | |
| src/routes/seu/core/templates.ts | 527 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/templates.ts | 529 | `entityType : "Template"` | Template | |
| src/routes/seu/core/templates.ts | 531 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/templates.ts | 532 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/templates.ts | 533 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 581 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 582 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 583 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 583 | `detail : "no authority badge resolved for this Template reactivation"` | no authority badge resolved for this Template reactivation | |
| src/routes/seu/core/templates.ts | 585 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 597 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 600 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/templates.ts | 611 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/templates.ts | 651 | `Draft : "Validated"` | Validated | |
| src/routes/seu/core/templates.ts | 652 | `Validated : "Published"` | Published | |
| src/routes/seu/core/templates.ts | 653 | `Published : "Active"` | Active | |
| src/routes/seu/core/templates.ts | 654 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/templates.ts | 655 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/templates.ts | 656 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/templates.ts | 661 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/core/templates.ts | 665 | `targetState : "Active"` | Active | |
| src/routes/seu/core/templates.ts | 668 | `targetState : "Deprecated"` | Deprecated | |
| src/routes/seu/core/templates.ts | 682 | `owningEntityType : "Template"` | Template | |
| src/routes/seu/core/commissioning.ts | 52 | `item : "Objective"` | Objective | |
| src/routes/seu/core/commissioning.ts | 69 | `status : "live"` | live | |
| src/routes/seu/core/commissioning.ts | 69 | `status : "dead"` | dead | |
| src/routes/seu/core/commissioning.ts | 69 | `detail : "has no Active version"` | has no Active version | |
| src/routes/seu/core/commissioning.ts | 77 | `status : "live"` | live | |
| src/routes/seu/core/commissioning.ts | 77 | `detail : "active capability-name concept"` | active capability-name concept | |
| src/routes/seu/core/commissioning.ts | 78 | `status : "dead"` | dead | |
| src/routes/seu/core/commissioning.ts | 78 | `detail : "not a live capability-name concept"` | not a live capability-name concept | |
| src/routes/seu/core/commissioning.ts | 86 | `status : "live"` | live | |
| src/routes/seu/core/commissioning.ts | 86 | `status : "dead"` | dead | |
| src/routes/seu/core/commissioning.ts | 86 | `detail : "has no Active version"` | has no Active version | |
| src/routes/seu/core/commissioning.ts | 122 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 123 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 123 | `reason : "at least one Template is required"` | at least one Template is required | |
| src/routes/seu/core/commissioning.ts | 124 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 124 | `reason : "at least one Profile is required"` | at least one Profile is required | |
| src/routes/seu/core/commissioning.ts | 125 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 125 | `reason : "only one Profile may be selected for commissioning"` | only one Profile may be selected for commissioning | |
| src/routes/seu/core/commissioning.ts | 130 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 136 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 142 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 148 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 152 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 156 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 162 | `stage : "validate_request"` | validate_request | |
| src/routes/seu/core/commissioning.ts | 190 | `stage : "allocate_runtime"` | allocate_runtime | |
| src/routes/seu/core/commissioning.ts | 200 | `authorityBadge : "seu_commission"` | seu_commission | |
| src/routes/seu/core/commissioning.ts | 273 | `entityType : "SEU"` | SEU | |
| src/routes/seu/core/commissioning.ts | 296 | `entityType : "SEU"` | SEU | |
| src/routes/seu/core/commissioning.ts | 296 | `fromState : "Commissioned"` | Commissioned | |
| src/routes/seu/core/commissioning.ts | 296 | `toState : "Activated"` | Activated | |
| src/routes/seu/core/commissioning.ts | 298 | `stage : "transition_Commissioned_to_Activated"` | transition_Commissioned_to_Activated | |
| src/routes/seu/core/commissioning.ts | 303 | `stage : "transition_Commissioned_to_Activated"` | transition_Commissioned_to_Activated | |
| src/routes/seu/core/commissioning.ts | 303 | `reason : "failed to persist Activated lifecycle_state"` | failed to persist Activated lifecycle_state | |
| src/routes/seu/core/commissioning.ts | 334 | `entityType : "SEU"` | SEU | |
| src/routes/seu/core/commissioning.ts | 334 | `fromState : "Activated"` | Activated | |
| src/routes/seu/core/commissioning.ts | 334 | `toState : "Operational"` | Operational | |
| src/routes/seu/core/commissioning.ts | 337 | `relatedObjectType : "SEU"` | SEU | |
| src/routes/seu/core/commissioning.ts | 338 | `fromState : "Activated"` | Activated | |
| src/routes/seu/core/commissioning.ts | 338 | `toState : "Operational"` | Operational | |
| src/routes/seu/core/commissioning.ts | 345 | `relatedObjectType : "SEU"` | SEU | |
| src/routes/seu/core/commissioning.ts | 346 | `fromState : "Activated"` | Activated | |
| src/routes/seu/core/commissioning.ts | 346 | `toState : "Operational"` | Operational | |
| src/routes/seu/core/commissioning.ts | 369 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/commissioning.ts | 371 | `reason : "ebm_retired"` | ebm_retired | |
| src/routes/seu/core/commissioning.ts | 375 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/commissioning.ts | 379 | `entityType : "EBM"` | EBM | |
| src/routes/seu/core/commissioning.ts | 387 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/commissioning.ts | 388 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/commissioning.ts | 389 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/commissioning.ts | 390 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/commissioning.ts | 391 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/commissioning.ts | 414 | `category : "EBM Retired"` | EBM Retired | |
| src/routes/seu/core/commissioning.ts | 415 | `priority : "High"` | High | |
| src/routes/seu/core/commissioning.ts | 418 | `relatedObjectType : "EBM"` | EBM | |
| src/routes/seu/core/commissioning.ts | 424 | `reason : "ebm_retired"` | ebm_retired | |
| src/routes/seu/core/commissioning.ts | 451 | `stage : "select_template"` | select_template | |
| src/routes/seu/core/commissioning.ts | 475 | `stage : "select_template"` | select_template | |
| src/routes/seu/core/commissioning.ts | 485 | `stage : "select_template"` | select_template | |
| src/routes/seu/core/commissioning.ts | 521 | `stage : "select_profile"` | select_profile | |
| src/routes/seu/core/commissioning.ts | 591 | `undefined : "Intersection: the sources are not unanimous, so nothing survived for this field."` | Intersection: the sources are not unanimous, so nothing survived for this field. | |
| src/routes/seu/core/schemaRegistry.ts | 88 | `entityType : "SchemaDefinition"` | SchemaDefinition | |
| src/routes/seu/core/schemaRegistry.ts | 123 | `authorBadge : "root"` | root | |
| src/routes/seu/core/schemaRegistry.ts | 138 | `entityType : "SchemaDefinition"` | SchemaDefinition | |
| src/routes/seu/core/schemaRegistry.ts | 138 | `fromState : "Packaged"` | Packaged | |
| src/routes/seu/core/schemaRegistry.ts | 155 | `fromState : "Packaged"` | Packaged | |
| src/routes/seu/core/schemaRegistry.ts | 159 | `fromState : "Packaged"` | Packaged | |
| src/routes/seu/core/participantHome.ts | 85 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 85 | `detail : "No Participant identity is registered for your account."` | No Participant identity is registered for your account. | |
| src/routes/seu/core/participantHome.ts | 88 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/participantHome.ts | 89 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 89 | `detail : "This Work Item is not assigned to a Participant yet."` | This Work Item is not assigned to a Participant yet. | |
| src/routes/seu/core/participantHome.ts | 93 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 93 | `detail : "This Work Item is not assigned to you."` | This Work Item is not assigned to you. | |
| src/routes/seu/core/participantHome.ts | 112 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 112 | `detail : "No participant information."` | No participant information. | |
| src/routes/seu/core/participantHome.ts | 116 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 116 | `detail : "You are not a Participant on this SEU."` | You are not a Participant on this SEU. | |
| src/routes/seu/core/participantHome.ts | 123 | `reason : "not_mine"` | not_mine | |
| src/routes/seu/core/participantHome.ts | 123 | `detail : "This Deliverable is not assigned to you."` | This Deliverable is not assigned to you. | |
| src/routes/seu/core/participantHome.ts | 130 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/participantHome.ts | 137 | `origin : "Participants"` | Participants | |
| src/routes/seu/core/participantHome.ts | 138 | `originatingEntityType : "Participant"` | Participant | |
| src/routes/seu/core/telemetry.ts | 140 | `category : "Organisational Learning"` | Organisational Learning | |
| src/routes/seu/core/telemetry.ts | 143 | `severity : "High"` | High | |
| src/routes/seu/core/telemetry.ts | 164 | `category : "Escalation"` | Escalation | |
| src/routes/seu/core/telemetry.ts | 165 | `priority : "High"` | High | |
| src/routes/seu/core/telemetry.ts | 168 | `relatedObjectType : "Obligation"` | Obligation | |
| src/routes/seu/core/telemetry.ts | 189 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/core/telemetry.ts | 198 | `origin : "Quality Gates"` | Quality Gates | |
| src/routes/seu/core/telemetry.ts | 211 | `relatedObjectType : "SEU"` | SEU | |
| src/routes/seu/core/telemetry.ts | 220 | `origin : "Policies"` | Policies | |
| src/routes/seu/core/telemetry.ts | 237 | `dedupScope : "platform"` | platform | |
| src/routes/seu/core/telemetry.ts | 238 | `relatedObjectType : "SEU"` | SEU | |
| src/routes/seu/core/telemetry.ts | 247 | `origin : "Telemetry and Knowledge Model"` | Telemetry and Knowledge Model | |
| src/routes/seu/core/obligations.ts | 67 | `originatingEntityType = "EBM"` | EBM | |
| src/routes/seu/core/obligations.ts | 157 | `originatingEntityType : "Policy"` | Policy | |
| src/routes/seu/core/obligations.ts | 166 | `category : "Action Required"` | Action Required | |
| src/routes/seu/core/obligations.ts | 201 | `type : "always_true"` | always_true | |
| src/routes/seu/core/obligations.ts | 241 | `category : "Action Required"` | Action Required | |
| src/routes/seu/core/obligations.ts | 256 | `title : "title"` | title | |
| src/routes/seu/core/obligations.ts | 257 | `description : "description"` | description | |
| src/routes/seu/core/obligations.ts | 258 | `category : "category"` | category | |
| src/routes/seu/core/obligations.ts | 259 | `severity : "severity"` | severity | |
| src/routes/seu/core/obligations.ts | 260 | `priority : "priority"` | priority | |
| src/routes/seu/core/obligations.ts | 261 | `completionCriteria : "completion_criteria"` | completion_criteria | |
| src/routes/seu/core/obligations.ts | 262 | `assignedEntityType : "assigned_entity_type"` | assigned_entity_type | |
| src/routes/seu/core/obligations.ts | 263 | `assignedEntityId : "assigned_entity_id"` | assigned_entity_id | |
| src/routes/seu/core/obligations.ts | 329 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/obligations.ts | 330 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/obligations.ts | 335 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/obligations.ts | 340 | `entityType : "Obligation"` | Obligation | |
| src/routes/seu/core/policyDefinitions.ts | 235 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/policyDefinitions.ts | 237 | `entityType : "Policy"` | Policy | |
| src/routes/seu/core/policyDefinitions.ts | 239 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/policyDefinitions.ts | 240 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/policyDefinitions.ts | 241 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/policyDefinitions.ts | 245 | `reason : "not_authorised"` | not_authorised | |
| src/routes/seu/core/policyDefinitions.ts | 268 | `Draft : "Validated"` | Validated | |
| src/routes/seu/core/policyDefinitions.ts | 269 | `Validated : "Published"` | Published | |
| src/routes/seu/core/policyDefinitions.ts | 270 | `Published : "Active"` | Active | |
| src/routes/seu/core/policyDefinitions.ts | 271 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/policyDefinitions.ts | 272 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/policyDefinitions.ts | 273 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/policyDefinitions.ts | 278 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/core/capabilityDefinitions.ts | 97 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/capabilityDefinitions.ts | 99 | `entityType : "Capability"` | Capability | |
| src/routes/seu/core/capabilityDefinitions.ts | 101 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/capabilityDefinitions.ts | 102 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/capabilityDefinitions.ts | 103 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/capabilityDefinitions.ts | 108 | `reason : "no_actor"` | no_actor | |
| src/routes/seu/core/capabilityDefinitions.ts | 108 | `detail : "no actorId supplied for this transition"` | no actorId supplied for this transition | |
| src/routes/seu/core/capabilityDefinitions.ts | 110 | `reason : "no_actor"` | no_actor | |
| src/routes/seu/core/capabilityDefinitions.ts | 133 | `Defined : "Published"` | Published | |
| src/routes/seu/core/capabilityDefinitions.ts | 134 | `Published : "Active"` | Active | |
| src/routes/seu/core/capabilityDefinitions.ts | 135 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/capabilityDefinitions.ts | 136 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/capabilityDefinitions.ts | 137 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/capabilityDefinitions.ts | 142 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/core/decisions.ts | 96 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/decisions.ts | 97 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/decisions.ts | 102 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/decisions.ts | 107 | `entityType : "Decision"` | Decision | |
| src/routes/seu/core/qualityGateWaivers.ts | 8 | `QUALITY_GATE_WAIVE_BADGE = "qualitygate_waive"` | qualitygate_waive | |
| src/routes/seu/core/qualityGateWaivers.ts | 21 | `reason : "rationale is required"` | rationale is required | |
| src/routes/seu/core/qualityGateWaivers.ts | 27 | `reason : "quality gate not found"` | quality gate not found | |
| src/routes/seu/core/externalInteractions.ts | 66 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/externalInteractions.ts | 67 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/externalInteractions.ts | 72 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/externalInteractions.ts | 78 | `entityType : "ExternalInteraction"` | ExternalInteraction | |
| src/routes/seu/core/externalInteractions.ts | 108 | `category : "Exception"` | Exception | |
| src/routes/seu/core/externalInteractions.ts | 109 | `priority : "High"` | High | |
| src/routes/seu/core/externalInteractions.ts | 112 | `relatedObjectType : "ExternalInteraction"` | ExternalInteraction | |
| src/routes/seu/core/events.ts | 7 | `sort : "sequence"` | sequence | |
| src/routes/seu/core/events.ts | 7 | `dir : "desc"` | desc | |
| src/routes/seu/core/compliance.ts | 124 | `state : "waived"` | waived | |
| src/routes/seu/core/compliance.ts | 124 | `detail : "waived for this SEU"` | waived for this SEU | |
| src/routes/seu/core/reviews.ts | 90 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/reviews.ts | 91 | `reason : "outcome_required"` | outcome_required | |
| src/routes/seu/core/reviews.ts | 92 | `reason : "outcome_immutable"` | outcome_immutable | |
| src/routes/seu/core/reviews.ts | 93 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/reviews.ts | 103 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/reviews.ts | 108 | `entityType : "Review"` | Review | |
| src/routes/seu/core/reviews.ts | 116 | `reason : "outcome_required"` | outcome_required | |
| src/routes/seu/core/reviews.ts | 116 | `detail : "completing a Review requires an outcome (Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred)"` | completing a Review requires an outcome (Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred) | |
| src/routes/seu/core/reviews.ts | 117 | `reason : "outcome_immutable"` | outcome_immutable | |
| src/routes/seu/core/findings.ts | 63 | `category : "Action Required"` | Action Required | |
| src/routes/seu/core/findings.ts | 64 | `priority : "High"` | High | |
| src/routes/seu/core/findings.ts | 83 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/findings.ts | 88 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/findings.ts | 92 | `entityType : "Finding"` | Finding | |
| src/routes/seu/core/findings.ts | 94 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/findings.ts | 95 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/findings.ts | 96 | `reason : "quality_gate_blocked"` | quality_gate_blocked | |
| src/routes/seu/core/findings.ts | 97 | `reason : "not_submitted"` | not_submitted | |
| src/routes/seu/core/findings.ts | 98 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/findings.ts | 125 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/findings.ts | 126 | `reason : "already_converted"` | already_converted | |
| src/routes/seu/core/deliverables.ts | 41 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/deliverables.ts | 54 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/serviceDefinitions.ts | 124 | `reason : "not_found"` | not_found | |
| src/routes/seu/core/serviceDefinitions.ts | 126 | `entityType : "Service"` | Service | |
| src/routes/seu/core/serviceDefinitions.ts | 128 | `reason : "authority_denied"` | authority_denied | |
| src/routes/seu/core/serviceDefinitions.ts | 129 | `reason : "no_transition_definition"` | no_transition_definition | |
| src/routes/seu/core/serviceDefinitions.ts | 130 | `reason : "policy_blocked"` | policy_blocked | |
| src/routes/seu/core/serviceDefinitions.ts | 164 | `Defined : "Published"` | Published | |
| src/routes/seu/core/serviceDefinitions.ts | 165 | `Published : "Active"` | Active | |
| src/routes/seu/core/serviceDefinitions.ts | 166 | `Active : "Deprecated"` | Deprecated | |
| src/routes/seu/core/serviceDefinitions.ts | 167 | `Deprecated : "Retired"` | Retired | |
| src/routes/seu/core/serviceDefinitions.ts | 168 | `Retired : "Archived"` | Archived | |
| src/routes/seu/core/serviceDefinitions.ts | 173 | `reason : "no_further_step"` | no_further_step | |
| src/routes/seu/web/sdkAuthoring.ts | 111 | `mode : "web"` | web | |
| src/routes/seu/web/sdkAuthoring.ts | 115 | `endpoint : "publish"` | publish | |
| src/routes/seu/web/sdkAuthoring.ts | 115 | `endpoint : "transition"` | transition | |
| src/routes/seu/web/sdkAuthoring.ts | 115 | `targetStateField : "targetState"` | targetState | |
| src/routes/seu/web/sdkAuthoring.ts | 124 | `endpoint : "publish"` | publish | |
| src/routes/seu/web/sdkAuthoring.ts | 128 | `endpoint : "transition"` | transition | |
| src/routes/seu/web/sdkAuthoring.ts | 133 | `mode : "web"` | web | |
| src/routes/seu/web/sdkAuthoring.ts | 133 | `match : "any"` | any | |
| src/routes/seu/web/sdkAuthoring.ts | 143 | `mode : "web"` | web | |
| src/routes/seu/web/sdkAuthoring.ts | 143 | `notFoundMessage : "Not found."` | Not found. | |
| src/routes/seu/web/sdkAuthoring.ts | 678 | `draft.status : "Draft"` | Draft | |
| src/routes/seu/web/sdkAuthoring.ts | 679 | `draft.status : "Draft"` | Draft | |
| src/routes/seu/web/sdkAuthoring.ts | 679 | `endpoint : "publish"` | publish | |
| src/routes/seu/web/sdkAuthoring.ts | 688 | `draft.content.purpose : ""` |  | |
| src/routes/seu/web/sdkAuthoring.ts | 950 | `endpoint : "publish"` | publish | |
| src/routes/seu/web/sdkAuthoring.ts | 967 | `endpoint : "transition"` | transition | |
| src/routes/seu/web/sdkAuthoring.ts | 967 | `targetStateField : "targetState"` | targetState | |
| src/routes/seu/web/deliverableDefinitionRegistry.ts | 26 | `req.query.status : ""` |  | |
| src/routes/seu/web/deliverableDefinitionRegistry.ts | 40 | `requiredBadge : "deliverable_define"` | deliverable_define | |
| src/routes/seu/web/deliverableDefinitionRegistry.ts | 52 | `requiredBadge : "deliverable_define"` | deliverable_define | |
| src/routes/seu/web/identity.ts | 70 | `req.query.tenant : ""` |  | |
| src/routes/seu/web/identity.ts | 99 | `req.query.tenant : ""` |  | |
| src/routes/seu/web/packs.ts | 24 | `req.query.category : ""` |  | |
| src/routes/seu/web/packs.ts | 25 | `req.query.status : ""` |  | |
| src/routes/seu/web/demo.ts | 29 | `landingPath = "/aisworg/seu/demo"` | /aisworg/seu/demo | |
| src/routes/seu/web/demo.ts | 30 | `rootPath = "/aisworg/seu/demo/root"` | /aisworg/seu/demo/root | |
| src/routes/seu/web/seus.ts | 272 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 353 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 379 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/web/seus.ts | 422 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 500 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 525 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 547 | `related_object_type : "Deliverable"` | Deliverable | |
| src/routes/seu/web/seus.ts | 555 | `status : "Candidate"` | Candidate | |
| src/routes/seu/web/seus.ts | 580 | `reason = "detail"` | detail | |
| src/routes/seu/web/seus.ts | 637 | `reason = "detail"` | detail | |
| src/routes/seu/web/devActAs.ts | 23 | `req.body.badgeType : "root"` | root | |
| src/routes/seu/web/templateRegistry.ts | 28 | `req.query.category : ""` |  | |
| src/routes/seu/web/templateRegistry.ts | 29 | `req.query.status : ""` |  | |
| src/routes/seu/web/templateRegistry.ts | 47 | `requiredBadge : "template_define"` | template_define | |
| src/routes/seu/web/templateRegistry.ts | 59 | `requiredBadge : "template_define"` | template_define | |
| src/routes/seu/web/participantRegistry.ts | 30 | `req.query.status : ""` |  | |
| src/routes/seu/web/ontology.ts | 18 | `backTo = "/aisworg/seu/sdk/ontology"` | /aisworg/seu/sdk/ontology | |
| src/routes/seu/web/ontology.ts | 51 | `toState : "Deprecated"` | Deprecated | |
| src/routes/seu/web/ontology.ts | 51 | `verb : "deprecate"` | deprecate | |
| src/routes/seu/web/ontology.ts | 52 | `toState : "Retired"` | Retired | |
| src/routes/seu/web/ontology.ts | 52 | `verb : "retire"` | retire | |
| src/routes/seu/web/ontology.ts | 53 | `toState : "Archived"` | Archived | |
| src/routes/seu/web/ontology.ts | 53 | `verb : "archive"` | archive | |
| src/routes/seu/web/tenantAdmin.ts | 16 | `usersBackTo = "/aisworg/seu/tenant-admin/users"` | /aisworg/seu/tenant-admin/users | |
| src/routes/seu/web/dataMigrations.ts | 16 | `backTo = "/aisworg/seu/data-migrations"` | /aisworg/seu/data-migrations | |
| src/routes/seu/web/profileRegistry.ts | 41 | `req.query.templateCode : ""` |  | |
| src/routes/seu/web/profileRegistry.ts | 42 | `req.query.status : ""` |  | |
| src/routes/seu/web/profileRegistry.ts | 59 | `requiredBadge : "profile_define"` | profile_define | |
| src/routes/seu/web/profileRegistry.ts | 71 | `requiredBadge : "profile_define"` | profile_define | |
| src/routes/seu/web/objectives.ts | 68 | `notFoundMessage : "Objective not found."` | Objective not found. | |
| src/routes/seu/web/objectives.ts | 75 | `_base = "/aisworg/seu/objectives"` | /aisworg/seu/objectives | |
| src/routes/seu/web/objectives.ts | 128 | `notFoundMessage : "Parent Objective not found."` | Parent Objective not found. | |
| src/routes/seu/web/objectives.ts | 131 | `notFoundMessage : "Objective to supersede not found."` | Objective to supersede not found. | |
| src/routes/seu/web/objectives.ts | 138 | `ObjectiveTier = "Strategic"` | Strategic | |
| src/routes/seu/web/objectives.ts | 167 | `prior.statement : ""` |  | |
| src/routes/seu/web/objectives.ts | 187 | `notFoundMessage : "Parent Objective not found."` | Parent Objective not found. | |
| src/routes/seu/web/objectives.ts | 190 | `notFoundMessage : "Objective to supersede not found."` | Objective to supersede not found. | |
| src/routes/seu/web/objectives.ts | 200 | `statement : ""` |  | |
| src/routes/seu/web/objectives.ts | 205 | `statement : ""` |  | |
| src/routes/seu/web/objectives.ts | 214 | `status : "Proposed"` | Proposed | |
| src/routes/seu/web/objectives.ts | 222 | `targetState : "Superseded"` | Superseded | |
| src/routes/seu/web/objectives.ts | 228 | `detail = "detail"` | detail | |
| src/routes/seu/web/objectives.ts | 315 | `statement : ""` |  | |
| src/routes/seu/web/objectives.ts | 319 | `statement : ""` |  | |
| src/routes/seu/web/objectives.ts | 394 | `detail = "detail"` | detail | |
| src/routes/seu/web/schemaRegistry.ts | 19 | `backTo = "/aisworg/seu/sdk/schema-registry"` | /aisworg/seu/sdk/schema-registry | |
| src/routes/seu/web/schemaRegistry.ts | 42 | `req.query.entityKind : ""` |  | |
| src/routes/seu/web/policyDefinitionRegistry.ts | 27 | `req.query.status : ""` |  | |
| src/routes/seu/web/policyDefinitionRegistry.ts | 40 | `requiredBadge : "policy_define"` | policy_define | |
| src/routes/seu/web/policyDefinitionRegistry.ts | 52 | `requiredBadge : "policy_define"` | policy_define | |
| src/routes/seu/web/capabilityDefinitionRegistry.ts | 26 | `req.query.status : ""` |  | |
| src/routes/seu/web/capabilityDefinitionRegistry.ts | 39 | `requiredBadge : "capability_define"` | capability_define | |
| src/routes/seu/web/capabilityDefinitionRegistry.ts | 51 | `requiredBadge : "capability_define"` | capability_define | |
| src/routes/seu/web/reviews.ts | 60 | `relatedObjectType : "Deliverable"` | Deliverable | |
| src/routes/seu/web/reviews.ts | 80 | `detail = "detail"` | detail | |
| src/routes/seu/web/reviews.ts | 104 | `severity : "Medium"` | Medium | |
| src/routes/seu/web/reviews.ts | 124 | `detail = "detail"` | detail | |
| src/routes/seu/web/attention.ts | 53 | `reason = "detail"` | detail | |
| src/routes/seu/web/serviceDefinitionRegistry.ts | 27 | `req.query.status : ""` |  | |
| src/routes/seu/web/serviceDefinitionRegistry.ts | 40 | `requiredBadge : "service_define"` | service_define | |
| src/routes/seu/web/serviceDefinitionRegistry.ts | 52 | `requiredBadge : "service_define"` | service_define | |
| src/routes/seu/web/routeAuthorityRegistry.ts | 20 | `backTo = "/aisworg/seu/route-authority"` | /aisworg/seu/route-authority | |
| src/routes/seu/api/workItems.ts | 37 | `outcome : "done"` | done | |
| src/routes/seu/api/packs.ts | 31 | `mode : "api"` | api | |
| src/routes/seu/api/packs.ts | 32 | `notFoundMessage : "Pack not found"` | Pack not found | |
| src/routes/seu/api/packs.ts | 45 | `detail : "detail"` | detail | |
| src/routes/seu/api/ontology.ts | 13 | `req.query.conceptType : ""` |  | |
| src/routes/seu/api/ontology.ts | 25 | `req.query.conceptType : ""` |  | |
| src/routes/seu/api/objectives.ts | 16 | `mode : "api"` | api | |
| src/routes/seu/api/objectives.ts | 16 | `notFoundMessage : "Objective not found"` | Objective not found | |
| src/routes/seu/api/objectives.ts | 21 | `mode : "api"` | api | |
| src/routes/seu/api/objectives.ts | 21 | `notFoundMessage : "Parent Objective not found"` | Parent Objective not found | |
| src/routes/seu/api/objectives.ts | 63 | `req.query.statement : ""` |  | |
| src/routes/seu/api/templates.ts | 12 | `req.query.capabilityCodes : ""` |  | |
| src/routes/seu/api/executionTargets.ts | 71 | `effectiveMode : "human-on-ui"` | human-on-ui | |
| src/routes/seu/api/executionTargets.ts | 73 | `effectiveMode : "human-on-ui"` | human-on-ui | |
| src/routes/seu/api/reviews.ts | 47 | `req.query.seuId : ""` |  | |
| src/routes/seu/api/reviews.ts | 90 | `severity : "Medium"` | Medium | |


## Actor and author badge resolution

The session user id and the author badge are resolved through shared helpers. No call site reads `req.session.user.id` directly, picks a badge by hand, or falls back to a default. A missing actor or a missing badge throws.

### Helpers

| Layer | Helper | Behaviour |
|---|---|---|
| Route | `requireActorId(req)` | Returns the session user id as a string. Throws when it is undefined or null. |
| Route | `resolveHeldBadges(req)` | Returns `{ isRoot, badgeTypes, has }` for the session actor. |
| Route | `resolveAuthorBadgeForRequest(req)` | Picks the badge from the `route_authority` row of the request. Root records `root`. Records `system` when the row lists no badge. Throws when no held badge matches. |
| Route | `resolveActorAndBadge(req)` | Returns `{ actorId, authorBadge }` from the two helpers above. |
| Core | `badgeAuthorityEngine.resolveAuthorBadge(actorId, "<noun_verb>")` | Returns `root` for a root holder and the badge itself for a holder. The platform system actor passes `deliverable_*` badges. Throws otherwise. |
| Core | `badgeAuthorityEngine.getHeldBadges(actorId)` | Returns the held set for reads that gate a view. |
| Events | `getSystemActor(seuId)` and `findPlatformSystemActorId()` | The system actor and the `system` badge for engine-published events. |

### Changes

| Area | Change |
|---|---|
| `resolveAuthorBadge(authRow, held)` | Throws. The `?? "pack_define"`, `?? "general"` and first-held-badge fallbacks are removed. |
| `badgeAuthorityEngine.authorise` | The return type is a discriminated union. `matchedBadge` is required when `via` is `badge`. The fallback in `transitionEngine.ts` is removed. |
| Core authoring | Profile, Pack and Template define, Review create, Finding create and convert, Obligation create, Deliverable create, Schema Definition create, Objective propose and submit, Ontology sync and Quality Gate Waiver grant resolve the badge from the actor. |
| Core inputs | `createReview`, `createFinding` and `convertFindingToObligation` no longer accept `authorBadge`. |
| Routes | The api and web layers use `requireActorId` or `resolveActorAndBadge`. The six registry copy handlers use `held.has("<x>_define")` for `canCopy`. |
| Objectives | The tenant check in `createObjective` is removed. The `requireTenantScope.forField` middleware on the create routes enforces tenant scope. |
| Commissioning | `attemptSeuCommenceWork` resolves one `commenceBadge` and uses it for the policy call and the published event. |
| Metrics | `metricRegistryEngine.compute` publishes `MetricCalculated` as the platform system actor. |
| Demo seed | `demoSeed.ts` resolves the badge with `resolveAuthorBadge(actor.participantId, "<x>_define")`. |

### Retained

| Location | Reason |
|---|---|
| `dataMigrations.ts` | Records `root` unconditionally. |
| `demoSimulator.ts` `authorBadgeFor` and the `ontology_define` literal | Simulated actors. |
| `badgeBootstrap.ts` | Login root grant and platform badges. |
| `executionEngine.ts` and `transitionEngine.ts` `authorise` calls | Governance engines. |
| `participantHome.ts` `getHeldBadges` | Reads the held set to filter decisions. |

### Interim literals

Birth rows are not yet in `transition_definitions` (CR-128). Until then the creation badges are `review_create`, `finding_create`, `finding_convert`, `obligation_create`, `deliverable_create` and `schemadefinition_create`. No seed data grants these badges, so only root holders can create these rows until the grants exist.

### Behaviour changes

| Case | Before | After |
|---|---|---|
| Actor without the required badge | `{ ok: false }` or a redirect with a message | Throws into the catch block or the global error handler. |
| Quality Gate Waiver without `qualitygate_waive` | `{ ok: false }`, HTTP 403 | Throws, HTTP 400. |
| Commence work without `seu_<verb>` | Logged and left the SEU at Activated | Throws. The event bus catches and logs it. The SEU stays at Activated. |
| `createObjective` called directly | Tenant check in core | No tenant check. |

### Tests

| File | Change |
|---|---|
| `tests/testFixtures.ts` | `createReviewAsRoot` and `createFindingAsRoot` drop `authorBadge`. The `holdAtActivated` comment describes the throw. |
| `tests/review-model.test.ts` | `convertFindingToObligation` calls drop `authorBadge`. |
| `tests/author-badge-resolution.test.ts` | New. Covers `requireActorId`, `resolveAuthorBadge`, `badgeAuthorityEngine.resolveAuthorBadge` and the waiver throw. |

## Open points

| # | Point |
|---|---|
| 1 | Which hits are Constant, which are Ontology and which are Leave. |
| 2 | Where the Ontology source lives for each Ontology hit. |
| 3 | Fixtures and tests that compare the same literals. |
