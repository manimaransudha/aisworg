# Capability and Service Definition Coverage Review

Scope: `capabilityDefinitions.json` (63 entries) and `serviceDefinitions.json` (63 entries, 1:1 by `capability_code`). Question: do they cover the full gamut of software engineering work?

## 1. Distribution by category

| Category | Count |
|---|---|
| Governance | 10 |
| Requirements Engineering | 9 |
| Architecture | 7 |
| Development | 7 |
| Learning and Improvement | 7 |
| Knowledge | 6 |
| Operations | 4 |
| Deployment | 4 |
| Testing | 4 |
| Security | 3 |
| Documentation | 2 |

Observation: the set is organised around the lifecycle (requirements → architecture → construction → validation → release → operation) plus governance, knowledge and learning. Many entries are "continuous", "predictive" or "autonomous" variants of a base capability rather than distinct competencies.

## 2. Gaps in competency coverage

| # | Area | Observation | Nearest existing entry |
|---|---|---|---|
| 1 | Project and delivery management | No planning, estimation, scheduling, resourcing, backlog or sprint management, or progress tracking. | none (`business-analysis-approach` covers BA planning only) |
| 2 | Risk management | Only predictive risk assessment exists. No risk identification, mitigation planning or tracking. | `predictive-engineering-risk-assessment` |
| 3 | Quality planning / test strategy | Testing is one verification capability. No test strategy, test design, test data or environment management, test automation, performance, load or accessibility testing. | `software-validation` |
| 4 | Version control and branching | No source control, branching, merge or code-review-workflow capability. `engineering-work-review` is generic. | `engineering-work-review` |
| 5 | Build and CI/CD | No build automation, continuous integration, pipeline engineering or artefact management. `software-release` covers release only. | `software-release` |
| 6 | Infrastructure and platform | No infrastructure-as-code, environment provisioning, cloud or container platform engineering, capacity planning. | `engineering-configuration` |
| 7 | Observability and reliability | Monitoring appears only as an input. No SRE, SLO management, incident response, on-call or disaster recovery capability. | `operating-production-systems` |
| 8 | Maintenance and evolution | No refactoring, technical-debt management, bug-fix maintenance, dependency or upgrade management, or end-of-life handling. | `corrective-actions`, `legacy-modernisation` |
| 9 | Security engineering | Three entries, all assessment or protection. No threat modelling, secure design, secure coding, penetration testing, secrets or identity management. | `protect-organisational-assets` |
| 10 | Privacy, compliance and licensing | Compliance is only continuous verification. No privacy engineering, regulatory mapping, open-source licence or SBOM management. | `continuous-compliance-verification` |
| 11 | Non-functional engineering | No performance, scalability, availability or usability/UX engineering, accessibility, internationalisation. | none |
| 12 | Data engineering and database | Pipelines exist. No database design, data modelling, migration, data governance or master data. | `engineering-data-pipelines` |
| 13 | Interface and API engineering | Only `integrating-constructed-components`. No API design, contract management or versioning. | `integrating-constructed-components` |
| 14 | Product and value | No product strategy, roadmap, business-case or benefits realisation, analytics-driven feedback. | `solution-options` |
| 15 | Support and customer feedback | No user support, service desk or feedback intake. | none |
| 16 | Team and people | No onboarding, skills management, collaboration, team formation or engineering culture. | none (`continuous-organisational-learning` is organisational) |
| 17 | Cost and FinOps | No effort, cost or cloud-spend management. | none |
| 18 | Specialised engineering domains | Only embedded firmware and ML model training. No mobile, web front end, game, real-time, safety-critical or hardware/software co-design. | `engineering-embedded-firmware`, `training-and-evaluating-models` |
| 19 | AI-assisted engineering | Models are trained, but no prompt, agent or AI-output governance, evaluation of AI-generated code or MLOps (deployment, monitoring, drift). | `training-and-evaluating-models` |
| 20 | Prototyping and experimentation | No spike, proof-of-concept, A/B or feature-flag experimentation. | none |

## 3. Structural observations on capabilities

| # | Observation |
|---|---|
| 1 | Mixed granularity: `software-construction` is a whole discipline, while `continuous-configuration-drift-detection` is a narrow monitor. |
| 2 | Governance has 10 entries while Documentation has 2 and Security 3. Category size reflects authoring emphasis rather than the work involved. |
| 3 | Several entries are specialisations labelled in the name (`autonomous-standard-synthesis`, `predictive-test-coverage-gap-detection`, `predictive-architectural-obsolescence-detection`, `legacy-modernisation`). The parent relation is only in the label text. |
| 4 | Entries with overlapping intent: `real-time-organisational-documentation` and `engineering-documentation`; `recovering-organisational-knowledge` and `legacy-modernisation`; `continuous-requirements-validation` and `requirements-validation`; `continuous-quality-assurance` and `software-validation`. |
| 5 | Category assignments to review: `engineering-data-pipelines`, `training-and-evaluating-models` and `engineering-embedded-firmware` are all Development; `engineering-assets-reuse` and `cross-codebase-pattern-propagation` are Development although they are knowledge-reuse concerns; `learning` and `continuous-organisational-learning` sit in Learning and Improvement while `evidence-based-organisational-reasoning` is Knowledge. |
| 6 | Naming style is inconsistent (gerund, noun phrase, imperative: `corrective-actions`, `learning`, `protect-organisational-assets`). |

## 4. Service Definition observations (inputs and outputs)

Counts: 9 services have neither inputs nor outputs; 24 have no inputs; 16 have no outputs.

| # | Observation |
|---|---|
| 1 | Services with no inputs and no outputs (9): `autonomous-capability-optimisation`, `continuous-architectural-analysis`, `continuous-compliance-verification`, `continuous-organisational-learning`, `continuous-requirements-validation`, `continuous-stakeholder-intent-reconciliation`, `continuous-vulnerability-posture-assessment`, `cross-codebase-pattern-propagation`, `predictive-incident-anticipation`. These contribute nothing traceable. |
| 2 | Services with inputs but no outputs include `continuous-configuration-drift-detection`, `continuous-domain-model-drift-detection`, `continuous-release-risk-management`, `engineering-decision-explainability`, `evidence-based-organisational-reasoning`, `predictive-architectural-obsolescence-detection`, `predictive-test-coverage-gap-detection`. Monitoring services should emit at least a finding or report. |
| 3 | Inputs never produced by any service (external or missing producer): `change-request`, `configuration-files`, `deployment-package`, `integration-specification-interface-contracts`, `monitoring-alerting-configuration`, `release-package`, `solution-architecture-document`, `test-suite`, `vision`. |
| 4 | `solution-architecture-document` is consumed by four services and produced by none. `architecture-decision-record` and `detailed-design-specification` appear to stand in for it. |
| 5 | `test-suite`, `release-package`, `deployment-package` and `integration-specification-interface-contracts` have no producer, so the build/test/release chain is broken between `software-construction` (source-code) and `software-release`. `integration-build` is produced and not consumed. |
| 6 | Outputs never consumed (31): `app-store-submission-package`, `benchmark-report`, `business-analysis-plan`, `capability-evolution-roadmap`, `confidence-assessment`, `configuration-baseline-record`, `data-pipeline-specification`, `data-quality-report`, `deployment-manifest`, `detailed-design-specification`, `firmware-build`, `hardware-compatibility-report`, `hardware-interface-specification`, `impact-analysis-report`, `integration-build`, `known-error-record`, `lessons-learned-report`, `model-card`, `model-evaluation-report`, `objective-alignment-report`, `operational-intelligence-report`, `policy-conflict-report`, `requirements-prioritisation-record`, `reuse-assessment`, `security-assessment-report`, `system-model`, `training-data-specification`, `user-technical-documentation`, `vendor-assessment`, `vendor-contract`, `vendor-performance-record`. Some are terminal deliverables; `detailed-design-specification`, `integration-build`, `deployment-manifest`, `system-model` and `requirements-prioritisation-record` should feed downstream work.
| 7 | `software-construction` does not take `detailed-design-specification` as input although `software-design` produces it. |
| 8 | `software-validation` takes `requirements-specification` but not `test-suite`; `test-suite` is only an input of `predictive-test-coverage-gap-detection`. |
| 9 | `defect-management` both consumes and produces `defect-log`; `capability-evolution` and `organisational-memory-synthesis` do the same (iterative refinement). Acceptable if intended. |
| 10 | `automatic-traceability-generation` has no inputs although `traceability-matrix` is derived from other deliverables. |

## 5. Summary

| Dimension | Verdict |
|---|---|
| Core lifecycle (requirements, architecture, construction, validation, release, operation) | Covered at one capability per stage; depth is thin, especially for testing, build/CI and operations. |
| Governance, knowledge, learning | Over-represented relative to delivery work. |
| Delivery management, risk, product, people, cost | Absent. |
| Cross-cutting engineering (security, NFRs, data, API, infrastructure, maintenance) | Partial. |
| Service chain integrity | Incomplete: 9 empty services, 9 unproduced inputs, 31 unconsumed outputs. |

Recommended next step: decide the gap areas in section 2 to add (suggest items 1 to 8 first), then repair the service chain in section 4 so every service has traceable inputs and outputs.

## 6. Remediation status

The new entries are merged into `capabilityDefinitions.json`, `serviceDefinitions.json` and `ontologyConcepts.json` in `src/dblayer/seed/data/`. The separate gap files were removed.

### 6.1 Gap areas (section 2)

| Item | Area | Status | New capability |
|---|---|---|---|
| 1 | Project and delivery management | Added | `engineering-project-planning` |
| 2 | Risk management | Added | `engineering-risk-management` |
| 3 | Quality planning and test strategy | Added | `test-strategy-and-design`, `test-automation-engineering` |
| 4 | Version control and branching | Added | `version-control-management` |
| 5 | Build and CI/CD | Added | `build-and-continuous-integration`, `continuous-delivery-pipeline-engineering` |
| 6 | Infrastructure and platform | Added | `infrastructure-engineering` |
| 7 | Observability and reliability | Added | `observability-engineering`, `incident-response-management`, `reliability-and-resilience-engineering` |
| 8 | Maintenance and evolution | Added | `software-maintenance-and-refactoring`, `technical-debt-and-dependency-management` |
| 9 | Security engineering | Added | `secure-engineering` |
| 10 | Privacy, compliance and licensing | Added | `privacy-and-licence-compliance` |
| 11 | Non-functional engineering | Added | `non-functional-requirements-engineering`, `performance-and-reliability-testing`, `user-experience-engineering` |
| 12 | Data engineering and database | Added | `data-and-database-engineering` |
| 13 | Interface and API engineering | Added | `api-and-interface-engineering` |
| 14 | Product and value | Added | `product-value-management` |
| 15 | Support and customer feedback | Added | `user-support-and-feedback-management` |
| 16 | Team and people | Added | `engineering-team-enablement` |
| 17 | Cost and FinOps | Added | `engineering-cost-management` |
| 18 | Specialised engineering domains | Added | `mobile-application-engineering`, `safety-critical-systems-engineering`, `hardware-software-codesign`, `game-and-interactive-media-engineering` |
| 19 | AI-assisted engineering | Added | `mlops-and-ai-assurance` |
| 20 | Prototyping and experimentation | Added | `prototyping-and-experimentation` |

Totals: 30 capabilities, 116 roles and 254 worktypes (only those not already in the Ontology), 30 services, 118 deliverable names. Capability categories use the existing 11 `category:capability` values.

### 6.2 Service chain (section 4)

| Check | Before | After (93 services combined) |
|---|---|---|
| Inputs never produced | 9 | 0 |
| Services with neither inputs nor outputs | 9 | 0 |
| Services without outputs | 16 | 0 |
| Services without inputs | 24 | 0 |
| Outputs never consumed | 31 | 13 |

The 13 remaining unconsumed outputs are end products consumed by people, audit or external parties: `app-store-submission-package`, `data-pipeline-specification`, `experiment-design`, `game-design-document`, `incident-communication-log`, `integration-bring-up-report`, `mobile-platform-strategy`, `onboarding-plan`, `performance-budget`, `refactoring-plan`, `structural-coverage-report`, `training-plan`, `workload-model`.

### 6.3 Changes to existing files

| File | Change |
|---|---|
| `serviceDefinitions.json` | `architecture-design` service outputs `solution-architecture-document` (section 4 item 4). |
| `serviceDefinitions.json` | `software-release` service outputs `runbook-operational-documentation`; consumers add `incident-response-management` and `user-support-and-feedback-management`. |
| `serviceDefinitions.json` | The remaining 7 services without outputs and 15 without inputs were completed, and 60 or more outputs were wired as inputs of the downstream services that need them (for example release-readiness evidence into `software-release`), with `consumers` updated to match. Earlier, the 9 services with neither inputs nor outputs now declare both (continuous and predictive services: architectural-awareness, capability-self-optimisation, continuous-learning, continuous-requirement-conformance, continuous-security-posture, fix-propagation, incident-anticipation, persistent-compliance, stakeholder-intent-reconciliation). Sixteen new deliverable names were added to `ontologyConcepts.json` for these services. |

Producers now exist for `test-suite`, `release-package`, `deployment-package`, `configuration-files`, `monitoring-alerting-configuration`, `integration-specification-interface-contracts`, `vision`, `change-request`, `solution-architecture-document` and `runbook-operational-documentation`.

### 6.4 Open

| # | Item |
|---|---|
| 1 | `test-ontology.json` holds the capability names, service names and `test-*` fixtures moved out of `ontologyConcepts.json`. It is seeded once before the test run by `tests/globalSetup.ts` (`--test-global-setup`). The production clean-slate does not load it. |
| 2 | Overlaps and category assignments in section 3 are unchanged. |

## 7. Competency review of the capability catalogue

Test applied (Chapter 2 §4: a Capability is a reusable engineering competency, requested to achieve one or more Deliverables):

| # | Test | Fails when |
|---|---|---|
| T1 | Skill | The name or content is an artefact (a deliverable) rather than something a Participant can be skilled at. |
| T2 | Not a phase or activity | It is a step of a lifecycle, not a skill applied across many steps. |
| T3 | Evidence-stream competencies are distinct | Retained from review: a competency that takes continuous evidence (telemetry, traceability, event replay) as input and produces findings as output differs from an artefact competency in input type, output type and skill (detection, correlation, baselining). It is not folded into an artefact competency. |
| T4 | Distinct | Its roles and worktypes do not substantially repeat another capability's. |

Scope: 63 existing and 30 new capabilities (93). Review only; no seed file changed by this section.

### 7.1 Fails T1: artefact, not competency

| Capability | Problem | Proposed treatment |
|---|---|---|
| `engineering-documentation` | Documentation is a Deliverable (`user-technical-documentation`, `knowledge-base-articles`). The skill underneath is capturing and structuring knowledge. | Remove. Each competency that holds the knowledge outputs its own documentation; knowledge capture merges into 7.4 item 1. |
| `real-time-organisational-documentation` | Same as above, plus an operating mode. | Remove, as above. |
| Category `Documentation` (Chapter 2 §7 and `category:capability`) | No capability remains in it after the two removals. | Retain the Ontology value only if a capability is later assigned to it; Chapter 2 §7 lists it as illustrative. |

### 7.2 Fails T2: named as a phase, activity or goal

| Capability | Problem | Competency name proposed |
|---|---|---|
| `business-analysis-approach` ("Planning the business analysis approach") | A planning step of requirements work. | Fold into `requirements-elicitation` (roles: engagement planning). |
| `adapting-business-needs` | Names a reaction, not a skill. Its roles (`change-impact-analysis`, reconciliation, realignment) repeat `change-management` and `capability-evolution`. | Rename `strategic-alignment-management` and drop the duplicated impact-analysis role, or merge into `capability-evolution`. |
| `learning` ("Learning from operational experience") | Activity name. | `lessons-learned-management`. |
| `corrective-actions` ("Eliminating recurring operational problems") | Activity name. The skill is ITIL problem management and root-cause analysis. | `problem-management`. |
| `protect-organisational-assets` | A goal statement. | `security-operations`. |
| `understanding-business-domain` | Activity name. | `domain-analysis-and-modelling`. |
| `software-validation` | Roles include `test-design` and `test-automation`, which are now separate competencies (`test-strategy-and-design`, `test-automation-engineering`). | Narrow to verification planning, execution, defect detection and evidence. |

### 7.3 Evidence-stream competencies (retained, not folded)

Earlier drafts of this review folded 23 `continuous-*`, `predictive-*`, `autonomous-*` and `cross-*` capabilities into their artefact counterparts. That treatment is withdrawn. These capabilities differ from the artefact capabilities as follows.

| Aspect | Artefact competency | Evidence-stream competency |
|---|---|---|
| Input | Finished artefacts (requirements specification, design, source code) | Continuous evidence: telemetry, traceability links, event replay, change streams |
| Output | A Deliverable | Findings: detection, drift, violation, forecast, alert |
| Skill | Authoring and analysis | Detection, correlation, baselining, anticipation |
| Quality measure | Completeness and correctness | Latency, coverage, false-positive rate, lead time |

Consequences:

| # | Consequence |
|---|---|
| 1 | The 1:1 between Capability Definition and Service Definition is unchanged. |
| 2 | Done: the 22 Service Definitions for these capabilities now take evidence streams (telemetry, event replay, traceability links, artefact, code, deployment, test, requirement and policy change streams, stakeholder communication, business signal, threat intelligence) plus the artefact baselines they compare against, and output findings. Existing artefact outputs that consumers still need (for example `confidence-assessment`, `risk-assessment-report`, `stakeholder-intent-baseline`) are retained. |
| 3 | Done: the Ontology gains 12 evidence-stream and 20 finding concepts as `deliverable-name` entries (`ui_grouping` "Deliverable", like all deliverable names), so the existing Service Definition schema and seed validation apply unchanged. Each finding states subject, evidence references, severity, confidence, detection time and recommended action. |
| 4 | Overlap review still applies inside the group; for example the four risk-related capabilities (`predictive-engineering-risk-assessment`, `continuous-release-risk-management`, `engineering-risk-management`, `secure-engineering`) cover different evidence and are not merged. |

### 7.4 Fails T4: overlapping capabilities (12 merges and delineations)

| # | Capabilities | Overlap | Treatment |
|---|---|---|---|
| 1 | `recovering-organisational-knowledge`, `organisational-memory-synthesis`, plus the two documentation capabilities | All capture, relate and structure organisational knowledge (shared roles `knowledge-extraction`, `knowledge-consolidation`, `knowledge-correlation`). | Merge into `organisational-knowledge-management`. `legacy-modernisation` stays separate as reverse engineering. |
| 2 | `enterprise-wide-engineering-impact-analysis`, `change-management` | Both assess change impact. | Merge into `change-management`. |
| 3 | `engineering-decision-explainability`, `governing-engineering-decisions` | Explainability is a property of governed decisions. | Merge into `governing-engineering-decisions`. |
| 4 | `engineering-data-pipelines`, `data-and-database-engineering` | Both design, build and govern data. | Merge into `data-and-database-engineering`. |
| 5 | `version-control-management`, `engineering-configuration` | Configuration management already has `version-management` and baseline roles. | Merge into `engineering-configuration`. |
| 6 | `build-and-continuous-integration`, `continuous-delivery-pipeline-engineering` | One delivery-pipeline skill (release engineering). | Merge into `build-and-delivery-pipeline-engineering`; `software-release` stays as release management. |
| 7 | `business-analysis-approach`, `requirements-elicitation` | See 7.2. | Merge. |
| 8 | `operating-production-systems`, `incident-response-management` | Both produce `incident-report-post-mortem`. | Keep both. Operating covers running the service; incident response covers detection through review. Remove the duplicated output from one. |
| 9 | `training-and-evaluating-models`, `mlops-and-ai-assurance` | Both monitor model performance. | Keep both. ML engineering builds and evaluates models; MLOps deploys, monitors and governs them. |
| 10 | `secure-engineering`, `protect-organisational-assets` | Both cover security. | Keep both. Secure engineering builds security into software; security operations protects running assets. |
| 11 | `software-validation`, `test-strategy-and-design`, `test-automation-engineering` | Role overlap on `test-design` and `test-automation`. | Keep all three, with `software-validation` narrowed (7.2). |
| 12 | `learning`, `engineering-practice-improvement`, `capability-evolution` | Lessons feed practice, practice feeds capability. | Keep all three. Remove repeated roles such as `experience-capture`. |

### 7.5 Result

| Step | Count |
|---|---|
| Current catalogue | 93 |
| Merge knowledge cluster and documentation (7.1, 7.4 item 1) | −3 |
| Other merges (7.4 items 2 to 7) | −6 |
| Resulting competency catalogue | 84 |

### 7.6 Decisions needed before any change

| # | Decision | Reason |
|---|---|---|
| 1 | Whether the removed capability codes are deleted from `capabilityDefinitions.json` and `ontologyConcepts.json` or deprecated. | Stored Templates, Packs and Profiles may reference them by code (`capability-name` concepts). |
