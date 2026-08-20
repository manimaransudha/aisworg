-- Ontology (Ch.18) — "when to use this" guidance for each of the 9
-- template-categories concepts (migration 053). Owner, 2026-08-19 (CR-023):
-- "For Enterprise Web application, this will be something on the lines of
-- 'Template for creating software for a web application that has enterprise
-- wide impact; Use this when there are ......'" — the pattern followed for
-- all 9: what the Template is for, then when to choose it over the others.
-- Scoped to the Platform tenant (these are the canonical descriptions for
-- the platform's own root categories, migration 055's tenant scoping).
UPDATE ontology_concepts SET description = 'Template for building a web application with enterprise-wide impact. Use this when the application serves multiple departments or business units, needs centralised authentication and role-based access control, and must integrate with existing enterprise systems such as an ERP, CRM, or identity provider.'
 WHERE concept_type = 'template-categories' AND code = 'enterprise-web-application' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building a native or cross-platform mobile application. Use this when the primary user interface is a phone or tablet app, and the work requires offline support, push notifications, or device capabilities such as camera, location, or biometrics.'
 WHERE concept_type = 'template-categories' AND code = 'mobile-application' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building a platform whose primary deliverable is one or more APIs consumed by other systems or third parties. Use this when there is little or no end-user interface of its own, and the focus is on contract design, versioning, rate limiting, and developer-facing documentation.'
 WHERE concept_type = 'template-categories' AND code = 'api-platform' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for re-platforming or re-architecting an existing legacy system. Use this when the engagement starts from an already-operating system with existing data, users, and integrations that must be preserved or migrated, rather than building on a clean slate.'
 WHERE concept_type = 'template-categories' AND code = 'legacy-modernisation' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building a system whose primary purpose is ingesting, storing, transforming, or serving data at scale. Use this when the core deliverables are pipelines, warehouses, or data services rather than end-user-facing application features.'
 WHERE concept_type = 'template-categories' AND code = 'data-platform' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building a system centred on AI/ML model development, training, or serving. Use this when the primary engineering work involves data science pipelines, model lifecycle management, or an AI-powered capability as the core product, not an incidental add-on.'
 WHERE concept_type = 'template-categories' AND code = 'ai-platform' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building software that runs on dedicated hardware or embedded devices. Use this when the deliverable includes firmware or device-resident software with hardware constraints — memory, power, real-time behaviour — that do not apply to typical server or web software.'
 WHERE concept_type = 'template-categories' AND code = 'embedded-software' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for building a multi-tenant, subscription-delivered software product. Use this when the system must support many independent customer organisations on shared infrastructure, with tenant isolation, billing, and self-service onboarding as first-class concerns.'
 WHERE concept_type = 'template-categories' AND code = 'saas-product' AND tenant_id = '11111111-1111-1111-1111-111111111111';

UPDATE ontology_concepts SET description = 'Template for implementing and configuring a third-party commercial or open-source package — an ERP, CMS, or CRM, for example — for a specific organisation. Use this when the primary engineering work is configuration, customisation, and integration of an existing product, not building new software from scratch.'
 WHERE concept_type = 'template-categories' AND code = 'package-implementation' AND tenant_id = '11111111-1111-1111-1111-111111111111';
