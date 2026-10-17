# Template Review (seed/data/*.template.json)

Checked against the 93 capabilities, 93 services and `deliverable-name` Ontology.

## 1. Reference integrity (all pass)
| Check | Result |
|---|---|
| Deliverable codes in catalogue exist as `deliverable-name` | Pass (11 templates) |
| `mandatoryPackCodes` exist as packs | Pass |
| Edge `toCode`/`fromCode` are in the template's catalogue | Pass |
| Edge `fromCapabilityCode` exists in the 93 | Pass |
| Producing capability's service lists the `toCode` in `outputs` | Pass |
| `exposedParameters` service codes exist | Pass |

## 2. Defects
None remaining. The earlier finding that only 18 of 93 capabilities were used is withdrawn: capability coverage by templates is not a requirement.

## 3. Edge/service input mismatches (resolved)
All 9 real templates now agree with the services. Service inputs added (with producer `consumers` kept in step):
| Capability | Input added |
|---|---|
| software-construction | architecture-decision-record, data-pipeline-specification, model-evaluation-report |
| software-design | architecture-decision-record |
| requirements-analysis | domain-model |
| governing-engineering-decisions | security-assessment-report |
| engineering-data-pipelines | source-code |
| software-validation | data-quality-report, hardware-compatibility-report |
| adapting-business-needs | incident-report-post-mortem |

Template edges repointed where a capability cannot take its own output: ai-platform (model-card, model-evaluation-report), embedded-software (firmware-build, hardware-compatibility-report), mobile-application (app-store-submission-package, incident-report-post-mortem).
Remaining mismatches are in the test fixtures only (cr104-demo-minimal, web-application), left as is.

## 4. Templates missing (typical engineering work uncovered)
| Proposed template | Capabilities it would use |
|---|---|
| devops-platform / infrastructure | infrastructure-engineering, build-and-continuous-integration, continuous-delivery-pipeline-engineering, observability-engineering, reliability-and-resilience-engineering, incident-response-management |
| maintenance-and-sustainment | software-maintenance-and-refactoring, technical-debt-and-dependency-management, defect-management, change-management |
| secure-and-compliant-system | secure-engineering, privacy-and-licence-compliance, non-functional-requirements-engineering, engineering-risk-management |
| safety-critical-system | safety-critical-systems-engineering, hardware-software-codesign |
| game-development | game-and-interactive-media-engineering, prototyping-and-experimentation, performance-and-reliability-testing |
| mlops / AI assurance (extend ai-platform) | mlops-and-ai-assurance |
| prototype-and-spike | prototyping-and-experimentation, user-experience-engineering, product-value-management |
| test-engineering-engagement | test-strategy-and-design, test-automation-engineering, performance-and-reliability-testing |
| continuous-assurance (evidence-stream) | the 22 continuous/predictive/autonomous capabilities, none used today |

Existing templates also need the new capabilities added (planning, test strategy, CI, security, observability).

### 4.1 Status
Nine templates were created in seed/data, each with a Profile (`<template>-development.profile.json`), and registered in `STANDARD_TEMPLATE_FILES` in `seedSdlcStandardTemplates.ts`: devops-platform, maintenance-and-sustainment, secure-and-compliant-system, safety-critical-system, game-development, mlops-ai-assurance, prototype-and-spike, test-engineering-engagement, continuous-assurance. The mlops template is separate from ai-platform.
Validation: every deliverable, producing capability, pack code and edge was checked against the services and Ontology. Each edge's source deliverables are inputs of the producing service and are produced earlier in the same template.
Not verified: the seed has not been run. Mandatory packs `compliance-iso-27001`, `ai-model-engineering` and `data-pipeline-engineering` must have a Template pack-selection slot for their category, or the seed throws.

## 5. Remaining gaps
None. 38 of the 93 capabilities are in no template. A capability does not need a template, so this is not a gap, and no template relationships were added for them.
