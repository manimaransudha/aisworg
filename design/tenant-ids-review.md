# Review: where a tenant predicate is required in src/dblayer/*DB.ts

Scan of the 59 `*DB.ts` files. 20 files hold SQL that names `tenant_id`; the other 39 reach a tenant through `seu_id`, an owner id or a parent row. Method: every `async` function whose body mentions `tenant_id`, classified by how the predicate is built. A text scan, not a type check.

## Predicate shapes found

| Shape | Meaning | Becomes |
|---|---|---|
| ANY(array) | `tenant_id = ANY($n::uuid[])`; the array is built in the DB layer (ontologyDB `visibleTenantIds`) | caller passes `tenantIds: string[]` |
| platform-or-viewer pair | `tenant_id = $a OR tenant_id = $b`, with `$a` from `getPlatformTenantId()` and `$b` from the caller | caller passes `tenantIds: string[]`; the DB layer stops reading the Platform id |
| single = | `tenant_id = $n`, one tenant, the caller's | stays single for writes and own-tenant lookups; an array only where a read is meant to span tenants |
| other | tenant_id appears in an INSERT column list, SET list, RETURNING or a join | writes keep a single `tenantId` |

## Per file (function: shape)

### badgeTypesDB.ts
- create: other (write)
- rename: single = (write)
- findAllForTenant: single =

### capabilityDefinitionsDB.ts
- createDraft: other (write)
- updateDraftContent: other (write)
- findByCodeAndVersion: single =
- findActiveByCode: single =
- findActiveByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCodesVisibleTo: platform-or-viewer pair,reads Platform id
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActivePlatformOwned: single =,reads Platform id

### deliverableDefinitionsDB.ts
- createDraft: other (write)
- updateDraftContent: other (write)
- findByCodeAndVersion: single =
- findActiveByCode: single =
- findActiveByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCodesVisibleTo: platform-or-viewer pair,reads Platform id
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActivePlatformOwned: single =,reads Platform id
- findByStatus: platform-or-viewer pair,reads Platform id

### demoAreasDB.ts
- insertMany: other (write)
- findByTenant: single =
- update: single = (write)

### demoScenariosDB.ts
- upsert: other (write)
- insertMany: other (write)
- findByTenant: single =
- findByCode: single =
- setProgress: single = (write)
- insert: other (write)
- update: single = (write)
- setEnabled: single = (write)
- resetProgress: single = (write)

### demoStepsDB.ts
- upsert: other (write)
- insertMany: other (write)
- findByTenant: single =
- findByCode: single =
- setEnabled: single = (write)
- insert: other (write)
- update: single = (write)

### eventsDB.ts
- append: other (write)

### executionTargetsDB.ts
- upsert: other (write)
- deleteByTenantAndCapability: single =
- findByTenantAndCapability: single =

### objectivesDB.ts
- create: other (write)

### ontologyDB.ts
- findConcept: ANY(array)
- findActiveConcept: single =
- findLatestVersion: single =
- findConceptByCodeAndVersion: single =
- findConceptsByType: ANY(array)
- listDistinctConceptTypes: ANY(array)
- findConceptTypeUiGroupings: ANY(array)
- findAllActiveConcepts: ANY(array)
- findDistinctUiGroupings: ANY(array)
- insertConceptVersion: other (write)
- bulkInsertConceptVersions: other (write)
- upsertAlias: other (write)
- deleteAlias: single =
- findAliasesByTenant: single =
- findDraftConcepts: ANY(array)

### packsDB.ts
- listSummaryRows: platform-or-viewer pair,reads Platform id
- create: other (write)
- updateDraftContent: other (write)
- findByStatus: platform-or-viewer pair,reads Platform id
- findByCodeAndVersion: single =
- findByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCode: single =
- findActiveByCodesVisibleTo: platform-or-viewer pair,reads Platform id
- listOptionRows: platform-or-viewer pair,reads Platform id
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findAllForTenant: single =
- findActiveVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveMandatoryVisibleTo: platform-or-viewer pair,reads Platform id

### participantsMasterDB.ts
- findByTenantId: single =
- findAll: other
- findEligibleForCapability: single =

### policyDefinitionsDB.ts
- createDraft: other (write)
- updateDraftContent: other (write)
- findByCodeAndVersion: single =
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCodesVisibleTo: platform-or-viewer pair,reads Platform id
- findActivePlatformOwned: single =,reads Platform id

### profilesDB.ts
- listActiveOptionRows: platform-or-viewer pair,reads Platform id
- listSummaryRows: platform-or-viewer pair,reads Platform id
- upsert: other (write)
- createDraft: other (write)
- setDraftContent: other (write)
- updateDraftContent: other (write)
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveVisibleTo: platform-or-viewer pair,reads Platform id
- findByStatus: platform-or-viewer pair,reads Platform id
- findByCodeAndVersion: single =
- findActiveByCode: single =

### serviceDefinitionsDB.ts
- createDraft: reads Platform id (write)
- updateDraftContent: other (write)
- findByCodeAndVersion: single =
- findActiveByCode: single =
- findActiveByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCapabilityCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByCodesVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveByOutputsVisibleTo: platform-or-viewer pair,reads Platform id
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActivePlatformOwned: single =,reads Platform id

### seusDB.ts
- create: other (write)
- listWithObjectiveStatementPaginated: other

### templatesDB.ts
- listActiveOptionRows: platform-or-viewer pair,reads Platform id
- listSummaryRows: platform-or-viewer pair,reads Platform id
- upsert: other (write)
- createDraft: other (write)
- updateDraftContent: other (write)
- setDraftContent: other (write)
- findByCodeAndVersion: single =
- findActiveByCode: single =
- findActiveByCodeVisibleTo: platform-or-viewer pair,reads Platform id
- findAllVisibleTo: platform-or-viewer pair,reads Platform id
- findActiveVisibleTo: platform-or-viewer pair,reads Platform id
- findByStatus: platform-or-viewer pair,reads Platform id

### tenantContractsDB.ts
- upsert: other (write)
- findByTenantId: single =

### userDB.ts
- listPaginated: single =
- listTenantIdsWithUsers: other
- listForManagement: single =
- create: other (write)
- createLocalPending: other (write)

### versionEventsDB.ts
- insert: other (write)
- findPage: other

## Counts

- other: 41
- single =: 44
- platform-or-viewer pair (to array): 34
- ANY(array) already: 7