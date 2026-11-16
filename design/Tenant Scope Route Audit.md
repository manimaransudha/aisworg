# Tenant Scope Route Audit

Scope: every router under `src/routes` (web, API, public, auth, demo). Rule applied: every `:id` and every entity id in a body or query is tenant-scoped first, by `router.param`, `forField`, or an equal guard. Method: route inventory extracted from all route files, then each id traced into its handler and core function. Files without path params (`auth.ts`, `web/demo.ts`, dashboard, dataMigrations, docs, devActAs, participantRegistry, knowledge, ontology) have no id to scope.

Status: all gaps found by the audit are fixed or accepted. `tsc --noEmit` passes. No test has been run.

## 1. Guards in place

All guards live in `src/middleware/seuTenantScope.ts` and are built on `requireTenantScope`. Root always passes.

| Router or route | Id | Guard |
|---|---|---|
| web/seus.ts, compliance.ts, reviews.ts, workQueue.ts | `:id` (SEU) | `seuTenantScope` |
| api/seus.ts | `:id` (SEU) | `seuTenantScopeApi` |
| web/objectives.ts | `:id` (Objective), body and query parent ids | `forParam`, `forField` on `sponsoring_authority.tenant` |
| web/attention.ts | `:id` (Attention Item) | `checkTenant` |
| web/sdkAuthoring.ts `/sdk/:slug/:draftId*` | draft row, 7 kinds | `requireDraftTenantScope` inline on all 6 routes |
| web/templateRegistry, profileRegistry, deliverableDefinitionRegistry, policyDefinitionRegistry, serviceDefinitionRegistry, capabilityDefinitionRegistry, packs | `:id` (Definition or Pack) | `definitionTenantScope`: Platform tenant or viewer tenant |
| web/identity.ts | `:id` (user) | `userTenantScope` |
| web/seus.ts | `:obligationId` | `obligationTenantScope` |
| web/seus.ts | `:deliverableId` | `deliverableTenantScope` |
| web/seus.ts, workQueue.ts, public.ts (quickview), demo.ts | `:workItemId` | `workItemTenantScope` |
| web/seus.ts | `:evidenceId`, `:knowledgeItemId`, `:decisionId`, `:attentionItemId`, `:participantId` | `checkTenant` on the entity adapter |
| web/reviews.ts | `:reviewId`, `:findingId` | `checkTenant` |
| POST `/seus` | body `objectiveId` | `commissionObjectiveScope` (viewer tenant) |
| POST `/seus` | body `templateProfile` (profile id) | `commissionProfileScope` (Platform tenant or viewer tenant) |
| GET `/seus/new` | query `objectiveId` | `commissionObjectiveQueryScope` |
| POST `/seus/:id/evidence`, `/seus/:id/evidence/:evidenceId/link`, Demo evidence create | body `deliverableId` | `evidenceDeliverableScope`. The Deliverable may belong to any SEU of the tenant (Evidence is reusable across SEUs, Ch.17). |
| POST `/seus/:id/evidence`, Demo evidence create | body `predecessorEvidenceId` | `evidencePredecessorScope` |

## 2. Fixed in code beyond id guards

| Route | Change |
|---|---|
| The six registry `/…/:id/copy` routes | The draft is written in the copier's own tenant (`copyMaster.tenant_id`), and the next version is read in that tenant. The source must be in the Platform tenant or the viewer's tenant. |
| GET `/events` | Root sees every tenant. Others see events recorded under their tenant and events of an SEU of their tenant (`eventsDB.findPage` takes `tenantId`). |
| GET `/version-events` | Root keeps the `?tenantId` filter. Others are forced to their own tenant. |
| POST `/seus/:id/capabilities/:capabilityId/participant/:participantId/replace` | `replaceParticipant` takes `seuId` and `capabilityId`. The Participant must belong to the SEU of the URL and its active Fulfilment must belong to the Capability of the URL. Tests in `tests/participant-lifecycle.test.ts` pass both. |

## 3. Indirect protection only (accepted)

| Route | Id | Protection |
|---|---|---|
| POST `/seus/:id/external-interactions/:interactionId/transition` | interactionId | Participant-in-SEU check in `evaluateGoverned`. Accepted by owner. |
| POST `/demo/participants/:participantId/seus/:seuId/{obligations,evidence,knowledge}` | seuId | `demoTenantOnly` on the viewer. The acting participant must be in the Demo tenant. Author checks need a participant row in that SEU. |
| POST `/demo/participants/:participantId/seus/:seuId/evidence/:evidenceId/transition`, `.../knowledge/:knowledgeItemId/{transition,promote-scope}` | evidenceId, knowledgeItemId | Same, plus `evaluateGoverned`. Participant rows are written only for Demo-tenant SEUs (`ensureEngagement`) or from a tenant-filtered eligible pool (`fulfilOne`). |
| POST `/quickview/seus/:seuId/obligations` | seuId | `raiseMyObligation` requires the viewer's own participant row in that SEU and an assigned Deliverable. |
| POST `/seus/:id/capabilities/:capabilityId/{fulfil,release}` | capabilityId | `loadContext(seuId, capabilityId)` binds the capability to the SEU. |

## 4. Tenant-less tables (no tenant to scope)

| Route | Table | Gate |
|---|---|---|
| `/route-authority/:id/{edit,update,delete}` | route_authority (no tenant column) | `root` badge |
| `/sdk/schema-registry/:id`, `/sdk/schema-registry/:id/transition` | schema_definitions (no tenant column) | `sdk_author` role, `root` badge on GET |
| `/authority/transition-definitions/:id{,/edit,/update}` | transition_definitions (no tenant column) | `transitiondefinition_define` badge |

## 5. Checked inside the handler or core

| Route | Check |
|---|---|
| GET registry detail pages | The view function returns null unless the viewer is root, or the row is in the Platform tenant or the viewer's tenant. |
| POST `/tenant-admin/users/:id/badges` | `setTenantUserAuthorisedBadges` rejects a user outside `actingTenantId`. |
| POST `/sdk/ontology/{deprecate,retire,quick-retire,approvals/approve,approvals/reject}` | `transitionConcept` rejects a non-root actor whose tenant differs from the body `tenantId`. |
| GET `/telemetry` (`?seuId`) | The SEU is used only when the viewer's tenant owns it. |
| GET `/sdk/:slug/new` (`parent*Id`, `fromPackId`) | The inherited content functions take `viewerTenantId`. |
| Knowledge, Decision, Review and External Interaction creation | The Deliverable must belong to the SEU. |

## 6. Transition core

`transitionEntity` does not compare the entity's tenant with the actor's tenant. Tenant scope is held by the route guards above. For entities that live inside an SEU (Obligation, Knowledge, Review, Finding, Participant, Decision, Evidence, Attention Item), `evaluateGoverned` also requires the actor to hold a participant row in the entity's SEU. Deliverable transitions run through `executionEngine` and rely on the route guard on `:deliverableId`.

## 7. API routers (`src/routes/seu/api`)

Seventeen routers hold 41 routes with an unguarded `:id` or `:capabilityId`. Every one is `notImplemented` and responds with no data. Each needs `router.param("id", …)` the day it is implemented: compliance 4, deliverables 3, evidence 2, executionTargets 1, externalInteractions 1, knowledge 4, objectives 8, obligations 1, ontology 3, packs 6, qualityGateWaivers 2, reviews 3, tenants 2, workItems 1.

## 8. Withdrawn finding

Evidence create and link do not need a same-SEU check on the Deliverable. Ch.17 makes Evidence independently reusable and across multiple engineering objects. The tenant check in section 1 applies instead.

## 9. Not ids

`:verb`, `:slug`, `:code` (demo catalogue keys), `:area` carry no entity id.
