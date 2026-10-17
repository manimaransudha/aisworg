# CR-124 — Call-site audit

Every call site under `src/routes` that sends a redirect, produced by reading each match. Companion to [CR-124](CR-124-redirects-middleware-conformance.md).

Destinations are resolved from the nearest preceding definition in the file. `:x` marks a value taken from the request or a result.

## Totals

| Class | Sites |
|---|---|
| flashError | 295 |
| flashSuccess | 88 |
| redirect + manual session.flash | 24 |
| redirect, no message | 14 |
| wrote() wrapper | 10 |
| **Total** | **431** |

## Per file

| File | flashError | flashSuccess | redirect + manual flash | redirect, no message | wrote() | Total | Distinct destinations |
|---|---|---|---|---|---|---|---|
| seu/web/attention.ts | 4 | 1 | 0 | 0 | 0 | 5 | 1 |
| seu/web/capabilityDefinitionRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/compliance.ts | 4 | 1 | 0 | 0 | 0 | 5 | 1 |
| seu/web/dashboard.ts | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| seu/web/dataMigrations.ts | 3 | 1 | 0 | 0 | 0 | 4 | 1 |
| seu/web/deliverableDefinitionRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/demo.ts | 5 | 4 | 0 | 0 | 0 | 9 | 2 |
| seu/web/devActAs.ts | 2 | 2 | 0 | 0 | 0 | 4 | 1 |
| seu/web/identity.ts | 16 | 4 | 0 | 0 | 0 | 20 | 3 |
| seu/web/objectives.ts | 47 | 9 | 2 | 2 | 0 | 60 | 9 |
| seu/web/ontology.ts | 9 | 9 | 0 | 0 | 0 | 18 | 3 |
| seu/web/policyDefinitionRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/profileRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/reviews.ts | 19 | 5 | 0 | 0 | 0 | 24 | 1 |
| seu/web/routeAuthorityRegistry.ts | 10 | 3 | 0 | 0 | 0 | 13 | 3 |
| seu/web/schemaRegistry.ts | 14 | 3 | 0 | 0 | 0 | 17 | 3 |
| seu/web/sdkAuthoring.ts | 44 | 14 | 1 | 0 | 10 | 69 | 9 |
| seu/web/serviceDefinitionRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/seus.ts | 81 | 20 | 0 | 0 | 0 | 101 | 4 |
| seu/web/templateRegistry.ts | 4 | 1 | 0 | 0 | 0 | 5 | 2 |
| seu/web/tenantAdmin.ts | 4 | 1 | 1 | 0 | 0 | 6 | 2 |
| seu/web/workQueue.ts | 3 | 2 | 0 | 0 | 0 | 5 | 1 |
| web/auth.ts | 0 | 0 | 20 | 11 | 0 | 31 | 6 |
| web/public.ts | 6 | 3 | 0 | 0 | 0 | 9 | 1 |

## Every call site

| File:line | Class | Route | Destination |
|---|---|---|---|
| seu/web/attention.ts:43 | flashError | POST /attention/:id/transition | `/aisworg/seu/attention` |
| seu/web/attention.ts:47 | flashError | POST /attention/:id/transition | `/aisworg/seu/attention` |
| seu/web/attention.ts:55 | flashError | POST /attention/:id/transition | `/aisworg/seu/attention` |
| seu/web/attention.ts:57 | flashSuccess | POST /attention/:id/transition | `/aisworg/seu/attention` |
| seu/web/attention.ts:60 | flashError | POST /attention/:id/transition | `/aisworg/seu/attention` |
| seu/web/capabilityDefinitionRegistry.ts:51 | flashError | POST /capability-definitions/:id/copy | `/aisworg/seu/capability-definitions` |
| seu/web/capabilityDefinitionRegistry.ts:53 | flashError | POST /capability-definitions/:id/copy | `/aisworg/seu/capability-definitions` |
| seu/web/capabilityDefinitionRegistry.ts:57 | flashError | POST /capability-definitions/:id/copy | `/aisworg/seu/capability-definitions` |
| seu/web/capabilityDefinitionRegistry.ts:58 | flashSuccess | POST /capability-definitions/:id/copy | `/aisworg/seu/sdk/capability-authoring/:x` |
| seu/web/capabilityDefinitionRegistry.ts:61 | flashError | POST /capability-definitions/:id/copy | `/aisworg/seu/capability-definitions` |
| seu/web/compliance.ts:40 | flashError | POST /seus/:id/compliance/waivers | `/aisworg/seu/seus/:x/compliance` |
| seu/web/compliance.ts:44 | flashError | POST /seus/:id/compliance/waivers | `/aisworg/seu/seus/:x/compliance` |
| seu/web/compliance.ts:46 | flashError | POST /seus/:id/compliance/waivers | `/aisworg/seu/seus/:x/compliance` |
| seu/web/compliance.ts:50 | flashSuccess | POST /seus/:id/compliance/waivers | `/aisworg/seu/seus/:x/compliance` |
| seu/web/compliance.ts:53 | flashError | POST /seus/:id/compliance/waivers | `/aisworg/seu/seus/:x/compliance` |
| seu/web/dashboard.ts:15 | redirect, no message | ? | `/aisworg` |
| seu/web/dataMigrations.ts:38 | flashError | POST /data-migrations/run | `/aisworg/seu/data-migrations` |
| seu/web/dataMigrations.ts:47 | flashError | POST /data-migrations/run | `/aisworg/seu/data-migrations` |
| seu/web/dataMigrations.ts:49 | flashSuccess | POST /data-migrations/run | `/aisworg/seu/data-migrations` |
| seu/web/dataMigrations.ts:52 | flashError | POST /data-migrations/run | `/aisworg/seu/data-migrations` |
| seu/web/deliverableDefinitionRegistry.ts:52 | flashError | POST /deliverable-definitions/:id/copy | `/aisworg/seu/deliverable-definitions` |
| seu/web/deliverableDefinitionRegistry.ts:54 | flashError | POST /deliverable-definitions/:id/copy | `/aisworg/seu/deliverable-definitions` |
| seu/web/deliverableDefinitionRegistry.ts:58 | flashError | POST /deliverable-definitions/:id/copy | `/aisworg/seu/deliverable-definitions` |
| seu/web/deliverableDefinitionRegistry.ts:59 | flashSuccess | POST /deliverable-definitions/:id/copy | `/aisworg/seu/sdk/deliverable-authoring/:x` |
| seu/web/deliverableDefinitionRegistry.ts:62 | flashError | POST /deliverable-definitions/:id/copy | `/aisworg/seu/deliverable-definitions` |
| seu/web/demo.ts:71 | flashSuccess | POST /demo/reset | `backFor(req)` |
| seu/web/demo.ts:74 | flashError | POST /demo/reset | `backFor(req)` |
| seu/web/demo.ts:81 | flashSuccess | POST /demo/scenarios/:code/run | `backFor(req)` |
| seu/web/demo.ts:81 | flashError | POST /demo/scenarios/:code/run | `backFor(req)` |
| seu/web/demo.ts:90 | flashSuccess | POST /demo/playbooks/:code/step | `backFor(req)` |
| seu/web/demo.ts:90 | flashError | POST /demo/playbooks/:code/step | `backFor(req)` |
| seu/web/demo.ts:93 | flashError | POST /demo/playbooks/:code/step | `backFor(req)` |
| seu/web/demo.ts:100 | flashSuccess | POST /demo/root/scenarios/:code/enabled | `/aisworg/seu/demo/root` |
| seu/web/demo.ts:103 | flashError | POST /demo/root/scenarios/:code/enabled | `/aisworg/seu/demo/root` |
| seu/web/devActAs.ts:26 | flashError | POST /dev/act-as | `(req.headers.referer as string) \|\| "/aisworg"` |
| seu/web/devActAs.ts:39 | flashSuccess | POST /dev/act-as | `(req.headers.referer as string) \|\| "/aisworg"` |
| seu/web/devActAs.ts:42 | flashError | POST /dev/act-as | `(req.headers.referer as string) \|\| "/aisworg"` |
| seu/web/devActAs.ts:54 | flashSuccess | POST /dev/act-as/reset | `(req.headers.referer as string) \|\| "/aisworg"` |
| seu/web/identity.ts:127 | flashError | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:130 | flashError | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:134 | flashError | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:137 | flashError | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:138 | flashSuccess | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:141 | flashError | POST /identity/tenants | `/aisworg/seu/identity/tenants` |
| seu/web/identity.ts:148 | flashError | POST /identity/users | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:151 | flashError | POST /identity/users | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:162 | flashError | POST /identity/users | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:163 | flashSuccess | POST /identity/users | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:166 | flashError | POST /identity/users | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:172 | flashError | POST /identity/users/:id/update | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:179 | flashError | POST /identity/users/:id/update | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:181 | flashError | POST /identity/users/:id/update | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:182 | flashSuccess | POST /identity/users/:id/update | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:185 | flashError | POST /identity/users/:id/update | `/aisworg/seu/identity/users` |
| seu/web/identity.ts:191 | flashError | POST /identity/badges/:id/update | `/aisworg/seu/identity/badges` |
| seu/web/identity.ts:197 | flashError | POST /identity/badges/:id/update | `/aisworg/seu/identity/badges` |
| seu/web/identity.ts:198 | flashSuccess | POST /identity/badges/:id/update | `/aisworg/seu/identity/badges` |
| seu/web/identity.ts:201 | flashError | POST /identity/badges/:id/update | `/aisworg/seu/identity/badges` |
| seu/web/objectives.ts:145 | flashError | GET /objectives/new | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:150 | flashError | GET /objectives/new | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:158 | flashError | GET /objectives/new | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:206 | flashError | POST /objectives | ``/aisworg/seu/objectives/new:x&tier=:x` : ""}${supersedesId ? `${parentId ? "&" : "?` |
| seu/web/objectives.ts:211 | flashError | POST /objectives | ``/aisworg/seu/objectives/new:x&tier=:x` : ""}${supersedesId ? `${parentId ? "&" : "?` |
| seu/web/objectives.ts:215 | flashError | POST /objectives | ``/aisworg/seu/objectives/new:x&tier=:x` : ""}${supersedesId ? `${parentId ? "&" : "?` |
| seu/web/objectives.ts:238 | flashError | POST /objectives | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:242 | flashSuccess | POST /objectives | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:245 | flashError | POST /objectives | ``/aisworg/seu/objectives/new:x&tier=:x` : ""}${supersedesId ? `${parentId ? "&" : "?` |
| seu/web/objectives.ts:253 | flashError | GET /objectives/:id | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:279 | flashError | GET /objectives/:id/edit | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:311 | flashError | POST /objectives/:id/submit | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:315 | flashSuccess | POST /objectives/:id/submit | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:318 | flashError | POST /objectives/:id/submit | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:331 | flashError | POST /objectives/:id/update | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:335 | flashError | POST /objectives/:id/update | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:338 | flashError | POST /objectives/:id/update | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:348 | flashSuccess | POST /objectives/:id/update | `/aisworg/seu/objectives` |
| seu/web/objectives.ts:351 | flashError | POST /objectives/:id/update | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:362 | flashSuccess | POST /objectives/:id/move | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:365 | flashError | POST /objectives/:id/move | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:376 | flashSuccess | POST /objectives/:id/delete | `parentId ? `/aisworg/seu/objectives/:x` : "/aisworg/seu/objectives"` |
| seu/web/objectives.ts:379 | flashError | POST /objectives/:id/delete | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:387 | flashError | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:398 | flashSuccess | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:401 | flashError | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:411 | flashError | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:424 | flashError | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:427 | flashSuccess | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:430 | flashError | POST /objectives/:id/retire | `/aisworg/seu/objectives/:x` |
| seu/web/objectives.ts:513 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:516 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:524 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:527 | redirect, no message | POST /objectives/:id/validate-commission | `/aisworg/seu/seus` |
| seu/web/objectives.ts:530 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:539 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:549 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:561 | redirect + manual session.flash | POST /objectives/:id/validate-commission | `/aisworg/seu/seus` |
| seu/web/objectives.ts:564 | flashError | POST /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:573 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:578 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:610 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:615 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:619 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:636 | redirect + manual session.flash | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:639 | flashError | POST /objectives/:id/compose-ebm | `/aisworg/seu/objectives/:x/compose-ebm` |
| seu/web/objectives.ts:647 | flashError | GET /objectives/:id/validate-commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:676 | flashError | GET /objectives/:id/compose-ebm | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:690 | redirect, no message | GET /objectives/:id/compose-ebm | `/aisworg/seu/seus/:x` |
| seu/web/objectives.ts:717 | flashError | POST /objectives/:id/commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:720 | flashError | POST /objectives/:id/commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:726 | flashError | POST /objectives/:id/commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:738 | flashError | POST /objectives/:id/commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:740 | flashSuccess | POST /objectives/:id/commission | `/aisworg/seu/seus/:x` |
| seu/web/objectives.ts:743 | flashError | POST /objectives/:id/commission | `/aisworg/seu/seus/new?objectiveId=:x` |
| seu/web/objectives.ts:752 | flashError | POST /objectives/:id/comments | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:756 | flashError | POST /objectives/:id/comments | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:757 | flashError | POST /objectives/:id/comments | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:761 | flashSuccess | POST /objectives/:id/comments | `/aisworg/seu/objectives/:x/edit` |
| seu/web/objectives.ts:764 | flashError | POST /objectives/:id/comments | `/aisworg/seu/objectives/:x/edit` |
| seu/web/ontology.ts:161 | flashSuccess | POST /sdk/ontology/add | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:163 | flashError | POST /sdk/ontology/add | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:174 | flashSuccess | POST /sdk/ontology/deprecate | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:176 | flashError | POST /sdk/ontology/deprecate | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:187 | flashSuccess | POST /sdk/ontology/retire | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:189 | flashError | POST /sdk/ontology/retire | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:200 | flashSuccess | POST /sdk/ontology/archive | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:202 | flashError | POST /sdk/ontology/archive | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:223 | flashSuccess | POST /sdk/ontology/compose | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:225 | flashError | POST /sdk/ontology/compose | `/aisworg/seu/sdk/ontology?type=:x` |
| seu/web/ontology.ts:243 | flashSuccess | POST /sdk/ontology/update-meta | `/aisworg/seu/sdk/ontology/metadata` |
| seu/web/ontology.ts:245 | flashError | POST /sdk/ontology/update-meta | `/aisworg/seu/sdk/ontology/metadata` |
| seu/web/ontology.ts:256 | flashSuccess | POST /sdk/ontology/quick-retire | `/aisworg/seu/sdk/ontology/metadata` |
| seu/web/ontology.ts:258 | flashError | POST /sdk/ontology/quick-retire | `/aisworg/seu/sdk/ontology/metadata` |
| seu/web/ontology.ts:301 | flashSuccess | POST /sdk/ontology/approvals/approve | `/aisworg/seu/sdk/ontology/approvals` |
| seu/web/ontology.ts:303 | flashError | POST /sdk/ontology/approvals/approve | `/aisworg/seu/sdk/ontology/approvals` |
| seu/web/ontology.ts:314 | flashSuccess | POST /sdk/ontology/approvals/reject | `/aisworg/seu/sdk/ontology/approvals` |
| seu/web/ontology.ts:316 | flashError | POST /sdk/ontology/approvals/reject | `/aisworg/seu/sdk/ontology/approvals` |
| seu/web/policyDefinitionRegistry.ts:52 | flashError | POST /policy-definitions/:id/copy | `/aisworg/seu/policy-definitions` |
| seu/web/policyDefinitionRegistry.ts:54 | flashError | POST /policy-definitions/:id/copy | `/aisworg/seu/policy-definitions` |
| seu/web/policyDefinitionRegistry.ts:58 | flashError | POST /policy-definitions/:id/copy | `/aisworg/seu/policy-definitions` |
| seu/web/policyDefinitionRegistry.ts:59 | flashSuccess | POST /policy-definitions/:id/copy | `/aisworg/seu/sdk/policy-authoring/:x` |
| seu/web/policyDefinitionRegistry.ts:62 | flashError | POST /policy-definitions/:id/copy | `/aisworg/seu/policy-definitions` |
| seu/web/profileRegistry.ts:71 | flashError | POST /profiles/:id/copy | `/aisworg/seu/profiles` |
| seu/web/profileRegistry.ts:73 | flashError | POST /profiles/:id/copy | `/aisworg/seu/profiles` |
| seu/web/profileRegistry.ts:77 | flashError | POST /profiles/:id/copy | `/aisworg/seu/profiles` |
| seu/web/profileRegistry.ts:78 | flashSuccess | POST /profiles/:id/copy | `/aisworg/seu/sdk/profile-authoring/:x` |
| seu/web/profileRegistry.ts:81 | flashError | POST /profiles/:id/copy | `/aisworg/seu/profiles` |
| seu/web/reviews.ts:51 | flashError | POST /seus/:id/reviews | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:55 | flashError | POST /seus/:id/reviews | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:59 | flashError | POST /seus/:id/reviews | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:62 | flashSuccess | POST /seus/:id/reviews | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:65 | flashError | POST /seus/:id/reviews | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:73 | flashError | POST /seus/:id/reviews/:reviewId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:74 | flashError | POST /seus/:id/reviews/:reviewId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:84 | flashError | POST /seus/:id/reviews/:reviewId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:87 | flashSuccess | POST /seus/:id/reviews/:reviewId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:90 | flashError | POST /seus/:id/reviews/:reviewId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:98 | flashError | POST /seus/:id/reviews/:reviewId/findings | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:101 | flashError | POST /seus/:id/reviews/:reviewId/findings | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:105 | flashError | POST /seus/:id/reviews/:reviewId/findings | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:115 | flashSuccess | POST /seus/:id/reviews/:reviewId/findings | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:118 | flashError | POST /seus/:id/reviews/:reviewId/findings | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:126 | flashError | POST /seus/:id/findings/:findingId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:127 | flashError | POST /seus/:id/findings/:findingId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:132 | flashError | POST /seus/:id/findings/:findingId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:134 | flashSuccess | POST /seus/:id/findings/:findingId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:137 | flashError | POST /seus/:id/findings/:findingId/transition | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:146 | flashError | POST /seus/:id/findings/:findingId/convert | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:150 | flashError | POST /seus/:id/findings/:findingId/convert | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:151 | flashSuccess | POST /seus/:id/findings/:findingId/convert | `/aisworg/seu/seus/:x/reviews` |
| seu/web/reviews.ts:154 | flashError | POST /seus/:id/findings/:findingId/convert | `/aisworg/seu/seus/:x/reviews` |
| seu/web/routeAuthorityRegistry.ts:80 | flashError | GET /route-authority/:id/edit | `/aisworg/seu/route-authority` |
| seu/web/routeAuthorityRegistry.ts:106 | flashError | POST /route-authority | `/aisworg/seu/route-authority/new` |
| seu/web/routeAuthorityRegistry.ts:108 | flashError | POST /route-authority | `/aisworg/seu/route-authority/new` |
| seu/web/routeAuthorityRegistry.ts:110 | flashError | POST /route-authority | `/aisworg/seu/route-authority/new` |
| seu/web/routeAuthorityRegistry.ts:112 | flashSuccess | POST /route-authority | `/aisworg/seu/route-authority` |
| seu/web/routeAuthorityRegistry.ts:115 | flashError | POST /route-authority | `/aisworg/seu/route-authority/new` |
| seu/web/routeAuthorityRegistry.ts:123 | flashError | POST /route-authority/:id/update | `/aisworg/seu/route-authority/:x/edit` |
| seu/web/routeAuthorityRegistry.ts:125 | flashError | POST /route-authority/:id/update | `/aisworg/seu/route-authority/:x/edit` |
| seu/web/routeAuthorityRegistry.ts:127 | flashSuccess | POST /route-authority/:id/update | `/aisworg/seu/route-authority` |
| seu/web/routeAuthorityRegistry.ts:130 | flashError | POST /route-authority/:id/update | `/aisworg/seu/route-authority/:x/edit` |
| seu/web/routeAuthorityRegistry.ts:137 | flashError | POST /route-authority/:id/delete | `/aisworg/seu/route-authority` |
| seu/web/routeAuthorityRegistry.ts:139 | flashSuccess | POST /route-authority/:id/delete | `/aisworg/seu/route-authority` |
| seu/web/routeAuthorityRegistry.ts:142 | flashError | POST /route-authority/:id/delete | `/aisworg/seu/route-authority` |
| seu/web/schemaRegistry.ts:67 | flashError | GET /sdk/schema-registry/:id | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:97 | flashError | POST /sdk/schema-registry | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:101 | flashError | POST /sdk/schema-registry | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:103 | flashError | POST /sdk/schema-registry | `/aisworg/seu/sdk/schema-registry/new?entityKind=:x` |
| seu/web/schemaRegistry.ts:110 | flashError | POST /sdk/schema-registry | `/aisworg/seu/sdk/schema-registry/new?entityKind=:x` |
| seu/web/schemaRegistry.ts:121 | flashError | POST /sdk/schema-registry | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:130 | flashError | POST /sdk/schema-registry/publish | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:132 | flashError | POST /sdk/schema-registry/publish | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:135 | flashError | POST /sdk/schema-registry/publish | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:136 | flashSuccess | POST /sdk/schema-registry/publish | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:139 | flashError | POST /sdk/schema-registry/publish | `/aisworg/seu/sdk/schema-registry` |
| seu/web/schemaRegistry.ts:145 | flashError | POST /sdk/schema-registry/:id/publish | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:148 | flashError | POST /sdk/schema-registry/:id/publish | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:149 | flashSuccess | POST /sdk/schema-registry/:id/publish | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:154 | flashError | POST /sdk/schema-registry/:id/reject | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:157 | flashError | POST /sdk/schema-registry/:id/reject | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/schemaRegistry.ts:158 | flashSuccess | POST /sdk/schema-registry/:id/reject | `/aisworg/seu/sdk/schema-registry/:x` |
| seu/web/sdkAuthoring.ts:97 | redirect + manual session.flash | ? | `req.headers.referer \|\| "/aisworg"` |
| seu/web/sdkAuthoring.ts:130 | flashError | ? | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:138 | flashError | ? | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:140 | flashError | ? | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:299 | flashSuccess | GET /authority/mapping | `back` |
| seu/web/sdkAuthoring.ts:299 | flashError | GET /authority/mapping | `back` |
| seu/web/sdkAuthoring.ts:319 | flashError | POST /authority/nouns/add | `/aisworg/seu/authority/nouns` |
| seu/web/sdkAuthoring.ts:320 | wrote() wrapper | POST /authority/nouns/add | `/aisworg/seu/authority/nouns` |
| seu/web/sdkAuthoring.ts:324 | wrote() wrapper | POST /authority/nouns/retire | `/aisworg/seu/authority/nouns` |
| seu/web/sdkAuthoring.ts:330 | flashError | POST /authority/verbs/add | `/aisworg/seu/authority/verbs` |
| seu/web/sdkAuthoring.ts:331 | wrote() wrapper | POST /authority/verbs/add | `/aisworg/seu/authority/verbs` |
| seu/web/sdkAuthoring.ts:335 | wrote() wrapper | POST /authority/verbs/retire | `/aisworg/seu/authority/verbs` |
| seu/web/sdkAuthoring.ts:341 | flashError | POST /authority/mapping/add | `/aisworg/seu/authority/mapping` |
| seu/web/sdkAuthoring.ts:342 | wrote() wrapper | POST /authority/mapping/add | `/aisworg/seu/authority/mapping` |
| seu/web/sdkAuthoring.ts:346 | wrote() wrapper | POST /authority/mapping/retire | `/aisworg/seu/authority/mapping` |
| seu/web/sdkAuthoring.ts:350 | wrote() wrapper | POST /authority/mapping/edit-trigger | `/aisworg/seu/authority/mapping` |
| seu/web/sdkAuthoring.ts:356 | flashError | POST /authority/transition-definitions/add | `/aisworg/seu/sdk/transition-definition-authoring` |
| seu/web/sdkAuthoring.ts:357 | wrote() wrapper | POST /authority/transition-definitions/add | `/aisworg/seu/sdk/transition-definition-authoring` |
| seu/web/sdkAuthoring.ts:361 | wrote() wrapper | POST /authority/transition-definitions/retire | `/aisworg/seu/sdk/transition-definition-authoring` |
| seu/web/sdkAuthoring.ts:395 | wrote() wrapper | POST /authority/transition-definitions/:id/update | `/aisworg/seu/authority/transition-definitions/:x` |
| seu/web/sdkAuthoring.ts:682 | flashError | POST /authority/transition-definitions/:id/update | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:785 | flashError | GET /sdk/:slug/new | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:791 | flashError | GET /sdk/:slug/new | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:797 | flashError | GET /sdk/:slug/new | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:802 | flashError | GET /sdk/:slug/new | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:850 | flashError | POST /sdk/:slug | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:853 | flashError | POST /sdk/:slug | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:857 | flashError | POST /sdk/:slug | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:869 | flashError | POST /sdk/:slug | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:870 | flashSuccess | POST /sdk/:slug | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:873 | flashError | POST /sdk/:slug | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:883 | flashError | GET /sdk/:slug/:draftId | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:901 | flashError | POST /sdk/:slug/:draftId/save | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:905 | flashError | POST /sdk/:slug/:draftId/save | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:908 | flashError | POST /sdk/:slug/:draftId/save | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:911 | flashSuccess | POST /sdk/:slug/:draftId/save | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:914 | flashError | POST /sdk/:slug/:draftId/save | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:923 | flashError | POST /sdk/:slug/:draftId/compose | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:926 | flashError | POST /sdk/:slug/:draftId/compose | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:927 | flashSuccess | POST /sdk/:slug/:draftId/compose | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:930 | flashSuccess | POST /sdk/:slug/:draftId/compose | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:933 | flashError | POST /sdk/:slug/:draftId/compose | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:943 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:950 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:952 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:953 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:956 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:957 | flashSuccess | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:959 | flashError | POST /sdk/:slug/:draftId/import | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:969 | flashError | POST /sdk/:slug/:draftId/publish | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:972 | flashError | POST /sdk/:slug/:draftId/publish | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:974 | flashSuccess | POST /sdk/:slug/:draftId/publish | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:977 | flashError | POST /sdk/:slug/:draftId/publish | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:988 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:994 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:995 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:999 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1000 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1004 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1005 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1009 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1010 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1014 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1015 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1019 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1020 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1024 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/sdkAuthoring.ts:1025 | flashSuccess | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug` |
| seu/web/sdkAuthoring.ts:1030 | flashError | POST /sdk/:slug/:draftId/transition | `/aisworg/seu/sdk/:slug/:draftId` |
| seu/web/serviceDefinitionRegistry.ts:52 | flashError | POST /service-definitions/:id/copy | `/aisworg/seu/service-definitions` |
| seu/web/serviceDefinitionRegistry.ts:54 | flashError | POST /service-definitions/:id/copy | `/aisworg/seu/service-definitions` |
| seu/web/serviceDefinitionRegistry.ts:58 | flashError | POST /service-definitions/:id/copy | `/aisworg/seu/service-definitions` |
| seu/web/serviceDefinitionRegistry.ts:59 | flashSuccess | POST /service-definitions/:id/copy | `/aisworg/seu/sdk/service-authoring/:x` |
| seu/web/serviceDefinitionRegistry.ts:62 | flashError | POST /service-definitions/:id/copy | `/aisworg/seu/service-definitions` |
| seu/web/seus.ts:60 | flashError | GET /seus/new | `/aisworg/seu/objectives` |
| seu/web/seus.ts:84 | flashError | GET /seus/:id | `/aisworg/seu/seus` |
| seu/web/seus.ts:104 | flashError | GET /seus/:id/ebm | `/aisworg/seu/seus` |
| seu/web/seus.ts:123 | flashError | POST /seus/:id/capabilities/:capabilityId/fulfil | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:127 | flashError | POST /seus/:id/capabilities/:capabilityId/fulfil | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:131 | flashError | POST /seus/:id/capabilities/:capabilityId/fulfil | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:142 | flashSuccess | POST /seus/:id/capabilities/:capabilityId/fulfil | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:145 | flashError | POST /seus/:id/capabilities/:capabilityId/fulfil | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:155 | flashError | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:161 | flashError | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:163 | flashError | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:173 | flashError | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:175 | flashSuccess | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:178 | flashError | POST /seus/:id/capabilities/:capabilityId/participant/:participantId/replace | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:189 | flashError | POST /seus/:id/capabilities/:capabilityId/release | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:192 | flashError | POST /seus/:id/capabilities/:capabilityId/release | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:201 | flashSuccess | POST /seus/:id/capabilities/:capabilityId/release | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:204 | flashError | POST /seus/:id/capabilities/:capabilityId/release | `/aisworg/seu/seus/:x?tab=capabilities` |
| seu/web/seus.ts:214 | flashError | POST /seus/:id/deliverables/:deliverableId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:217 | flashError | POST /seus/:id/deliverables/:deliverableId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:227 | flashError | POST /seus/:id/deliverables/:deliverableId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:229 | flashSuccess | POST /seus/:id/deliverables/:deliverableId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:232 | flashError | POST /seus/:id/deliverables/:deliverableId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:242 | flashError | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:248 | flashError | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:250 | flashError | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:258 | flashError | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:264 | flashSuccess | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:267 | flashError | POST /seus/:id/ebm/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:277 | flashError | POST /seus/:id/obligations/:obligationId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:281 | flashError | POST /seus/:id/obligations/:obligationId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:289 | flashError | POST /seus/:id/obligations/:obligationId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:291 | flashSuccess | POST /seus/:id/obligations/:obligationId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:294 | flashError | POST /seus/:id/obligations/:obligationId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:304 | flashError | POST /seus/:id/obligations/:obligationId/revise | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:317 | flashSuccess | POST /seus/:id/obligations/:obligationId/revise | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:320 | flashError | POST /seus/:id/obligations/:obligationId/revise | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:330 | flashError | POST /seus/:id/attention-items | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:334 | flashError | POST /seus/:id/attention-items | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:338 | flashError | POST /seus/:id/attention-items | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:351 | flashSuccess | POST /seus/:id/attention-items | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:354 | flashError | POST /seus/:id/attention-items | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:364 | flashError | POST /seus/:id/attention-items/:attentionItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:368 | flashError | POST /seus/:id/attention-items/:attentionItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:376 | flashError | POST /seus/:id/attention-items/:attentionItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:378 | flashSuccess | POST /seus/:id/attention-items/:attentionItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:381 | flashError | POST /seus/:id/attention-items/:attentionItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:391 | flashError | POST /seus/:id/evidence | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:395 | flashError | POST /seus/:id/evidence | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:399 | flashError | POST /seus/:id/evidence | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:406 | flashSuccess | POST /seus/:id/evidence | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:409 | flashError | POST /seus/:id/evidence | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:419 | flashError | POST /seus/:id/evidence/:evidenceId/validate | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:424 | flashError | POST /seus/:id/evidence/:evidenceId/validate | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:425 | flashSuccess | POST /seus/:id/evidence/:evidenceId/validate | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:428 | flashError | POST /seus/:id/evidence/:evidenceId/validate | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:438 | flashError | POST /seus/:id/evidence/:evidenceId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:441 | flashError | POST /seus/:id/evidence/:evidenceId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:450 | flashError | POST /seus/:id/evidence/:evidenceId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:452 | flashSuccess | POST /seus/:id/evidence/:evidenceId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:455 | flashError | POST /seus/:id/evidence/:evidenceId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:465 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:469 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:473 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:478 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:479 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:481 | flashSuccess | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:484 | flashError | POST /seus/:id/evidence/:evidenceId/link | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:494 | flashError | POST /seus/:id/knowledge | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:497 | flashError | POST /seus/:id/knowledge | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:509 | flashSuccess | POST /seus/:id/knowledge | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:512 | flashError | POST /seus/:id/knowledge | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:522 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:525 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:534 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:536 | flashSuccess | POST /seus/:id/knowledge/:knowledgeItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:539 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:549 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:552 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:561 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:563 | flashSuccess | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:571 | flashError | POST /seus/:id/knowledge/:knowledgeItemId/promote-scope | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:581 | flashError | POST /seus/:id/decisions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:584 | flashError | POST /seus/:id/decisions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:600 | flashSuccess | POST /seus/:id/decisions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:603 | flashError | POST /seus/:id/decisions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:613 | flashError | POST /seus/:id/decisions/:decisionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:616 | flashError | POST /seus/:id/decisions/:decisionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:625 | flashError | POST /seus/:id/decisions/:decisionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:627 | flashSuccess | POST /seus/:id/decisions/:decisionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:630 | flashError | POST /seus/:id/decisions/:decisionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:640 | flashError | POST /seus/:id/external-interactions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:644 | flashError | POST /seus/:id/external-interactions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:648 | flashError | POST /seus/:id/external-interactions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:661 | flashSuccess | POST /seus/:id/external-interactions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:664 | flashError | POST /seus/:id/external-interactions | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:674 | flashError | POST /seus/:id/external-interactions/:interactionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:677 | flashError | POST /seus/:id/external-interactions/:interactionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:686 | flashError | POST /seus/:id/external-interactions/:interactionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:688 | flashSuccess | POST /seus/:id/external-interactions/:interactionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/seus.ts:691 | flashError | POST /seus/:id/external-interactions/:interactionId/transition | `/aisworg/seu/seus/:x` |
| seu/web/templateRegistry.ts:59 | flashError | POST /templates/:id/copy | `/aisworg/seu/templates` |
| seu/web/templateRegistry.ts:61 | flashError | POST /templates/:id/copy | `/aisworg/seu/templates` |
| seu/web/templateRegistry.ts:65 | flashError | POST /templates/:id/copy | `/aisworg/seu/templates` |
| seu/web/templateRegistry.ts:66 | flashSuccess | POST /templates/:id/copy | `/aisworg/seu/sdk/template-authoring/:x` |
| seu/web/templateRegistry.ts:69 | flashError | POST /templates/:id/copy | `/aisworg/seu/templates` |
| seu/web/tenantAdmin.ts:22 | redirect + manual session.flash | GET /tenant-admin/users | `/aisworg/quickview` |
| seu/web/tenantAdmin.ts:49 | flashError | POST /tenant-admin/users/:id/badges | `safeBack(req, usersBackTo)` |
| seu/web/tenantAdmin.ts:51 | flashError | POST /tenant-admin/users/:id/badges | `safeBack(req, usersBackTo)` |
| seu/web/tenantAdmin.ts:58 | flashError | POST /tenant-admin/users/:id/badges | `safeBack(req, usersBackTo)` |
| seu/web/tenantAdmin.ts:59 | flashSuccess | POST /tenant-admin/users/:id/badges | `safeBack(req, usersBackTo)` |
| seu/web/tenantAdmin.ts:62 | flashError | POST /tenant-admin/users/:id/badges | `safeBack(req, usersBackTo)` |
| seu/web/workQueue.ts:57 | flashError | POST /seus/:id/work-items/:workItemId/complete | `/aisworg/seu/seus/:x/work-queue` |
| seu/web/workQueue.ts:66 | flashError | POST /seus/:id/work-items/:workItemId/complete | `/aisworg/seu/seus/:x/work-queue` |
| seu/web/workQueue.ts:69 | flashSuccess | POST /seus/:id/work-items/:workItemId/complete | `/aisworg/seu/seus/:x/work-queue` |
| seu/web/workQueue.ts:71 | flashSuccess | POST /seus/:id/work-items/:workItemId/complete | `/aisworg/seu/seus/:x/work-queue` |
| seu/web/workQueue.ts:74 | flashError | POST /seus/:id/work-items/:workItemId/complete | `/aisworg/seu/seus/:x/work-queue` |
| web/auth.ts:36 | redirect, no message | GET /login | `user: { platformBadges?: string[] } \| undefined) {` |
| web/auth.ts:52 | redirect, no message | POST /login | `/aisworg/auth/disabled` |
| web/auth.ts:54 | redirect + manual session.flash | POST /login | `/aisworg/login` |
| web/auth.ts:61 | redirect, no message | POST /login | `user: { platformBadges?: string[] } \| undefined) {` |
| web/auth.ts:73 | redirect, no message | GET /google/callback | `/aisworg/auth/disabled` |
| web/auth.ts:78 | redirect, no message | GET /google/callback | `user: { platformBadges?: string[] } \| undefined) {` |
| web/auth.ts:86 | redirect, no message | GET /logout | `/aisworg` |
| web/auth.ts:96 | redirect, no message | GET /verify | `/aisworg/login` |
| web/auth.ts:101 | redirect + manual session.flash | GET /verify | `/aisworg/login` |
| web/auth.ts:110 | redirect, no message | POST /verify | `/aisworg/login` |
| web/auth.ts:115 | redirect + manual session.flash | POST /verify | `/aisworg/login` |
| web/auth.ts:140 | redirect, no message | POST /verify | `user: { platformBadges?: string[] } \| undefined) {` |
| web/auth.ts:144 | redirect, no message | GET /forgot-password | `user: { platformBadges?: string[] } \| undefined) {` |
| web/auth.ts:166 | redirect + manual session.flash | POST /forgot-password | `/aisworg/auth/forgot-password` |
| web/auth.ts:171 | redirect + manual session.flash | POST /forgot-password | `/aisworg/auth/forgot-password` |
| web/auth.ts:175 | redirect + manual session.flash | POST /forgot-password | `/aisworg/auth/forgot-password` |
| web/auth.ts:181 | redirect + manual session.flash | GET /reset-password | `/aisworg/login` |
| web/auth.ts:185 | redirect + manual session.flash | GET /reset-password | `/aisworg/login` |
| web/auth.ts:192 | redirect, no message | POST /reset-password | `/aisworg/login` |
| web/auth.ts:197 | redirect + manual session.flash | POST /reset-password | `/aisworg/login` |
| web/auth.ts:217 | redirect + manual session.flash | POST /reset-password | `/aisworg/login` |
| web/auth.ts:248 | redirect + manual session.flash | POST /users/create | `/aisworg/auth/users` |
| web/auth.ts:252 | redirect + manual session.flash | POST /users/create | `/aisworg/auth/users` |
| web/auth.ts:268 | redirect + manual session.flash | POST /users/create | `/aisworg/auth/users` |
| web/auth.ts:272 | redirect + manual session.flash | POST /users/create | `/aisworg/auth/users` |
| web/auth.ts:281 | redirect + manual session.flash | POST /users/toggle | `/aisworg/auth/users` |
| web/auth.ts:286 | redirect + manual session.flash | POST /users/toggle | `/aisworg/auth/users` |
| web/auth.ts:290 | redirect + manual session.flash | POST /users/toggle | `/aisworg/auth/users` |
| web/auth.ts:300 | redirect + manual session.flash | POST /users/resend | `/aisworg/auth/users` |
| web/auth.ts:314 | redirect + manual session.flash | POST /users/resend | `/aisworg/auth/users` |
| web/auth.ts:318 | redirect + manual session.flash | POST /users/resend | `/aisworg/auth/users` |
| web/public.ts:79 | flashError | POST /quickview/work-items/:workItemId/complete | `/aisworg/quickview` |
| web/public.ts:89 | flashError | POST /quickview/work-items/:workItemId/complete | `/aisworg/quickview` |
| web/public.ts:92 | flashSuccess | POST /quickview/work-items/:workItemId/complete | `/aisworg/quickview` |
| web/public.ts:94 | flashSuccess | POST /quickview/work-items/:workItemId/complete | `/aisworg/quickview` |
| web/public.ts:97 | flashError | POST /quickview/work-items/:workItemId/complete | `/aisworg/quickview` |
| web/public.ts:105 | flashError | POST /quickview/seus/:seuId/obligations | `/aisworg/quickview` |
| web/public.ts:119 | flashError | POST /quickview/seus/:seuId/obligations | `/aisworg/quickview` |
| web/public.ts:121 | flashSuccess | POST /quickview/seus/:seuId/obligations | `/aisworg/quickview` |
| web/public.ts:124 | flashError | POST /quickview/seus/:seuId/obligations | `/aisworg/quickview` |
