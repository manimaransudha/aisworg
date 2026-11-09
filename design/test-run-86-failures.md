# Test run with 86 failures: causes

| Group | Tests | Cause | Status |
|---|---|---|---|
| Ontology "no such concept ... for that tenant" | ontology-event-lifecycle-table (6), web-sdk-authoring (7) | `addConcept`, `composeConcept` and `emitConceptCreated` wrote to the real Platform tenant (root default). The test then approved and read under `PLATFORM_TENANT_ID` (test-platform). | Fixed: `targetTenantId`/`tenantId: PLATFORM_TENANT_ID` passed. Not run. |
| Ontology via web route | web-ontology (9) | The root session posts `/sdk/ontology/add` with no tenant, so the row lands in the real Platform tenant. The test reads and approves under test-platform. The route has no tenant field. | Open: needs a decision. |
| SEU in Babylon (empty-pool tenant) cannot see the test-platform Template and Profile | compliance-model (4), review-model (4), participant-lifecycle (2), cr108 (2), capability-requested-fulfilment, cr109, command-pipeline (6, presumably), tenant-contract | `getEmptyPoolTenantId()` is Babylon. `ensureWebAppTemplateFixture()` publishes the Template and Profile in test-platform. Babylon sees only Platform plus Babylon, so no Packs compose and the Deliverable is missing. | Open: the fixture needs a tenant parameter. |
| web-flow picker | web-flow.e2e (13) | Presumably the same visibility cause (Athens/Babylon user against test-platform Template/Profile). Not traced. | Open |
| "Platform" read as test-platform | identity-core (2), registry-views-tenant (4), capability-/policy-definition-validation (3), pack-sdk (1), sdk-authoring (5) | `PLATFORM_TENANT_ID` is test-platform. These tests assert on the real Platform (`is_system`, "Platform row visible to a tenant"). | Open: rewrite to name the real Platform tenant. |
| policy-validate-schema | dependency-graph-relationship-kind (5) | Not traced. | Open |
| Others | cr104-mandatory, cr107 (2), cr108, engine-branches, objective-lifecycle, service-dependency, composition-engine, commission-profile-choice, participant-adapters, web-simple-pages (404 act-as) | Not traced. | Open |
