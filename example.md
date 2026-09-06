# Example

I want to create an ebook library management system.

One complete thread, start to finish, every artifact with concrete values, nothing left abstract: Objective → Template → Capability → Packs → Profile → Commissioning → EBM → SEU → Deliverable → Work Item → Evidence → Quality Gate → State Transition.

---

## 1. Objective

```
id: 1
statement: "Deliver an ebook library management system enabling members to browse, borrow and return digital books."
tier: Strategic
sponsoring_authority: "Library Services Director"
status: Active

id: 1.1
parent_id: 1
statement: "Create system to manage flow of books"
tier: Operational
status: Active

id: 1.2
parent_id: 1
statement: "Create system to manage library members"
tier: Operational
status: Active

id: 1.1.1
parent_id: 1.1
statement: "Create and manage a catalog of books"
tier: Engineering
status: Active

id: 1.1.2
parent_id: 1.1
statement: "Create a book checkin/checkout/waitlist"
tier: Engineering
status: Active

id: 1.1.3
parent_id: 1.1
statement: "Create mechanisms to track waitlist and notify availability"
tier: Engineering
status: Active

id: 1.2.1
parent_id: 1.2
statement: "Enroll members"
tier: Engineering
status: Active

id: 1.2.2
parent_id: 1.2
statement: "Create a module for member account and profile."
tier: Engineering
status: Active

```

---

## 2. Template


**Template A**

```
template:
  code: derived-enterprise-web-application
  name: "Derived from Enterprise Web Application"

  deliverable_catalogue:
    - Requirements Specification"
    - "Domain Model"
    - "Architecture"
    - "Detailed Design Specification"
    - "Source Code"
    - "Test Suite"
    - "Release Package"
    - "Operational Guide"

template_dependencies:
  - deliverable_type: "Requirements Specification"
    required_capability_code: 1     # Discovering business requirements
  - deliverable_type: "Requirements Specification"
    required_capability_code: 3     # Validating engineering requirements
  - deliverable_type: "Domain Model"
    required_capability_code: 2     # Understanding business domains
  - deliverable_type: "Architecture"
    required_capability_code: 5     # Designing software architecture
  - deliverable_type: "Detailed Design Specification"
    required_capability_code: 59    # Designing software components
  - deliverable_type: "Source Code"
    required_capability_code: 6     # Constructing software systems
  - deliverable_type: "Test Suite"
    required_capability_code: 8     # Verifying software quality
  - deliverable_type: "Release Package"
    required_capability_code: 12    # Managing software release
  - deliverable_type: "Operational Guide"
    required_capability_code: 13    # Operating production systems
```

**Template B**

```
template:
  id: TPL-MOBILE-APPLICATION
  name: "Mobile Application"

  deliverable_catalogue:
    - "Requirements Specification"
    - "Domain Model"
    - "Architecture"
    - "Detailed Design Specification"
    - "Source Code"
    - "Test Suite"
    - "Release Package"
    - "Operational Guide"
```

```
template_dependencies:
  - deliverable_type: "Requirements Specification"
    required_capability_code: 1
  - deliverable_type: "Requirements Specification"
    required_capability_code: 3
  - deliverable_type: "Domain Model"
    required_capability_code: 2
  - deliverable_type: "Architecture"
    required_capability_code: 5
  - deliverable_type: "Detailed Design Specification"
    required_capability_code: 59
  - deliverable_type: "Source Code"
    required_capability_code: 6
  - deliverable_type: "Test Suite"
    required_capability_code: 8
  - deliverable_type: "Release Package"
    required_capability_code: 12
  - deliverable_type: "Operational Guide"
    required_capability_code: 13
```

Both Templates reference the same capability `6` for their own "Source Code" Deliverable — that's no longer a collision, because each Template produces its own separate SEU with its own separate EBM (§7 onward). TPL-ENTERPRISE-WEB-APP's SEU composes only a Web Technology Pack for capability 6; TPL-MOBILE-APPLICATION's SEU composes only a Mobile Technology Pack for capability 6. No simultaneous composition, no specialised codes needed.

Sections 3 onward below still assume one Template, one SEU — they need updating to reflect two Templates, two commissioning requests, two SEUs, two EBMs, both tracing to the same Objective.

---

## 3. Capability

Registered once via Ontology (Ch.18), independent of any Pack (Chapter 11 §18.1). Whole identity is code + name + description, plus the Service fields that live here per the §18.1 resolution — not on a separate `services` table, not inside any Pack.

This is already one of th 60 we have defined and so not repeating here

---

## 4. Packs

No Pack establishes `capabilities.development` — that was wrong in an earlier draft of this file. Registration is an Ontology act (§3, Ch.11 §18.1), independent of any Pack. What Packs actually do is *declare fulfilment* of an already-registered code and contribute their own content against it. Any number of Packs can do this for the same code — the two below are two instances of that pattern, not a special pair; a real platform would have dozens to hundreds of these across every capability, not just `development`. Full Pack Metadata per Ch.5 §8, not a reduced stub.

```
pack:
  identifier: PACK-TECH-NODEJS
  name: "Node.js Technology Pack"
  version: 2.1.0
  description: "Node.js coding conventions, build standards and testing practices for the Development capability."
  category: technology
  owner: "Platform Engineering Guild"
  publisher: "AI Software Organisation Platform"
  dependencies: []
  installation_classification: Conditional   # required only where Profile selects Node.js
  composition_strategy: Union                # composes alongside other Packs declaring the same capability_code
  supported_platform_version: ">=3.0"
  status: Active
  capability_code: 6   # Constructing software systems
  contributions:
    standards:
      - "Node.js style guide (Airbnb base, modified)"
      - "Async/await required over raw Promise chains"
    checklists:
      - id: nodejs-pre-merge-checklist
        items:
          - "No unhandled promise rejections"
          - "No callback-style async code in new files"
    review_gates:
      - id: nodejs-standards-review
        classification: judgment
        statement: "Code follows Node.js style guide; no unhandled promise rejections; async/await used consistently."
    quality_gates:
      - id: nodejs-lint-gate
        classification: machine-verifiable
        statement: "ESLint passes with zero errors against the platform's Node.js ruleset."
    policies: [ POL-CODING-STANDARDS, POL-STATIC-ANALYSIS-REQUIRED ]
    # canonical definitions in policies.md — this Pack is their originating_pack for whichever
    # Technology Pack is active; checklists/quality_gates above are the raw content these formalise
```

```
pack:
  identifier: PACK-TECH-JAVA
  name: "Java Technology Pack"
  version: 3.0.0
  description: "Java coding conventions, build standards and testing practices for the Development capability."
  category: technology
  owner: "Platform Engineering Guild"
  publisher: "AI Software Organisation Platform"
  dependencies: []
  installation_classification: Conditional   # required only where Profile selects Java
  composition_strategy: Union
  supported_platform_version: ">=3.0"
  status: Active
  capability_code: 6   # Constructing software systems
  contributions:
    standards:
      - "Google Java Style Guide"
      - "Checked exceptions must be handled, never swallowed"
    checklists:
      - id: java-pre-merge-checklist
        items:
          - "No swallowed exceptions"
          - "Null-safety annotations present on public method signatures"
    review_gates:
      - id: java-standards-review
        classification: judgment
        statement: "Code follows Google Java Style Guide; no swallowed exceptions; null-safety annotated."
    quality_gates:
      - id: java-checkstyle-gate
        classification: machine-verifiable
        statement: "Checkstyle passes with zero violations against the platform's Java ruleset."
    policies: [ POL-CODING-STANDARDS, POL-STATIC-ANALYSIS-REQUIRED ]
    # same two canonical policies as PACK-TECH-NODEJS — whichever Technology Pack is Active
    # is that EBM's originating_pack for these, per policies.md's own note on E3/Q2
```

A third, unrelated to `development` entirely, to make the breadth point concrete — a Compliance Pack fulfilling capability #10 (Protecting organisational assets), showing the same declaration pattern applies across every capability, not just this one:

```
pack:
  identifier: PACK-COMPLIANCE-OWASP
  name: "OWASP Application Security Pack"
  version: 1.4.0
  description: "OWASP ASVS-aligned security controls and vulnerability assessment requirements."
  category: compliance
  owner: "Security Engineering"
  publisher: "AI Software Organisation Platform"
  dependencies: []
  installation_classification: Recommended
  composition_strategy: Union
  supported_platform_version: ">=3.0"
  status: Active
  capability_code: 10   # Protecting organisational assets
  contributions:
    policies: [ POL-ENCRYPTION-REQUIRED, POL-SECRETS-MANAGEMENT, POL-DEPENDENCY-VULN-THRESHOLD ]
    # canonical definitions in policies.md — POL-SECRETS-MANAGEMENT (S2) is the formalisation
    # of what this Pack originally carried as the raw string "No hardcoded secrets in source control"
    quality_gates:
      - id: owasp-dependency-scan-gate
        classification: machine-verifiable
        statement: "No dependency with a known Critical or High CVE at release time."
    review_gates:
      - id: owasp-threat-model-review
        classification: judgment
        statement: "Threat model reviewed against OWASP ASVS V1 (Architecture, Design and Threat Modeling)."
```

A fourth, carrying no `capability_code` at all — not every Pack fulfils a capability (Ch.5 §9's contribution list has entries, like Policies, with no capability-fulfilment role). One Pack, defining every governance tier as its own named content — not split across separate Packs. Profile selects this one Pack and picks a tier by name via `configuration_parameters`; the tier names are defined and owned here, nowhere else.

```
pack:
  identifier: PACK-GOVERNANCE-STYLE
  name: "Governance Style Pack"
  version: 1.0.0
  description: "Defines the platform's named governance tiers, from no merge approval through formal two-approver review."
  category: platform   # Ch.5 §6.1 lists "Default Governance" as a Platform Pack example
  owner: "Platform Engineering Guild"
  publisher: "AI Software Organisation Platform"
  dependencies: []
  installation_classification: Recommended
  composition_strategy: Union
  supported_platform_version: ">=3.0"
  status: Active
  default_tier: minimal   # applied when a Profile selects this Pack without overriding governance_tier
  contributions:
    tiers:
      rapid:
        policies:
          - "No merge approval required."
        quality_gates:
          - id: rapid-release-gate
            classification: machine-verifiable
            statement: "Automated tests pass; no manual sign-off required for release."
      minimal:
        policies:
          - "Single-approver merge required."
        quality_gates:
          - id: minimal-release-gate
            classification: machine-verifiable
            statement: "Automated tests pass; single approver has merged the change."
      enterprise:
        policies:
          - "Two-approver merge required; mandatory architecture review for every release."
        quality_gates:
          - id: enterprise-release-gate
            classification: human-attested
            statement: "Architecture Review Board sign-off obtained before release."
  policies:
    # tier-independent canonical policies (policies.md), distinct from the tier-specific
    # approval strings above — these apply regardless of which tier is active, with tier-aware
    # thresholds resolved from whichever tier a Profile selects (e.g. POL-TEST-COVERAGE-THRESHOLD's
    # own condition references "the threshold declared by the active governance tier")
    - POL-ARCH-DOC-REQUIRED
    - POL-TEST-COVERAGE-THRESHOLD
    - POL-REQUIREMENTS-TRACEABILITY
    - POL-BASELINE-INTEGRITY
    - POL-CODE-REVIEW-REQUIRED
    - POL-PERFORMANCE-VALIDATION
    - POL-DEPLOYMENT-APPROVAL-REQUIRED
    - POL-BACKUP-VALIDATION
    - POL-ROLLBACK-CAPABILITY
    - POL-CHANGE-APPROVAL-REQUIRED
    - POL-ADR-REQUIRED
    - POL-API-DOC-MANDATORY
    - POL-OPERATIONAL-RUNBOOK-REQUIRED
    - POL-CUSTOMER-SIGNOFF-REQUIRED
    - POL-BUSINESS-APPROVAL-REQUIRED
    - POL-RELEASE-NOTIFICATION
    - POL-INTERNAL-REVIEW-PROCESS
    - POL-ENGINEERING-STANDARDS
    - POL-VENDOR-RISK-ASSESSMENT
    - POL-GOVERNANCE-TIER-ALIGNMENT
```

---

## 5. Profile

A reusable, named configuration choice — not derived from the Template, just paired with it at commissioning. Ch.7 §7 requires `Base Template` as one of Profile's own structure fields, so a Profile is scoped to one specific Template, not freely reusable across different Template categories. Two Profiles below, same `base_template`, to make the reuse concrete rather than argued: nothing about `TPL-ENTERPRISE-WEB-APP` — its Deliverable Catalogue, its dependency graph, its identity, its version — changes between them. Only which Packs are selected differs.

```
profile:
  identifier: PROFILE-NODEJS-STARTUP
  base_template: TPL-ENTERPRISE-WEB-APP
  description: "Startup category (Ch.7 §8) — minimal governance overhead, optimised for rapid initial delivery."
  selected_packs:
    - pack: PACK-TECH-NODEJS
    - pack: PACK-GOVERNANCE-STYLE
```

`selected_packs` is a list of entries, not a bare list of identifiers — each entry may carry its own `config`, scoped to that Pack specifically, not a separate top-level dict that leaves it ambiguous which Pack a parameter belongs to. Neither entry here has a `config` block: `PACK-TECH-NODEJS` has no configurable dial in this example, and `PACK-GOVERNANCE-STYLE`'s own `default_tier: minimal` (§4) is accepted as-is — restating it would be the same redundancy `primary_programming_language` was.

```
profile:
  identifier: PROFILE-JAVA-ENTERPRISE
  base_template: TPL-ENTERPRISE-WEB-APP
  description: "Enterprise category (Ch.7 §8) — formal governance for regulated, multi-stakeholder delivery."
  selected_packs:
    - pack: PACK-TECH-JAVA
    - pack: PACK-GOVERNANCE-STYLE
      config:
        governance_tier: enterprise   # overrides this Pack's default_tier; must be one of the tier keys PACK-GOVERNANCE-STYLE itself defines
```

`config` sits directly under the `PACK-GOVERNANCE-STYLE` entry, not floating at the Profile level — if `PACK-TECH-JAVA` also had a configurable dial, its override would sit under its own entry instead, with no risk of two Packs' parameters colliding or needing to be disambiguated by convention. `enterprise` is only a valid value here because it's a key `PACK-GOVERNANCE-STYLE` already declares under `contributions.tiers` (§4) — a Profile can select or override a tier, never invent one the Pack didn't define.

If Profile didn't exist and this were instead expressed as two Templates — `TPL-ENTERPRISE-WEB-APP-NODEJS-STARTUP` and `TPL-ENTERPRISE-WEB-APP-JAVA-ENTERPRISE` — each would need its own independent copy of the entire nine-item Deliverable Catalogue and ten-edge dependency graph from §2, published and versioned separately, with nothing enforcing they stay in sync if that structure ever changes. With one Template and two Profiles, that structural change is made once.

---

## 6. Commissioning Request

SEU is commissioned *in service of* the Objective — Template and Profile are inputs to that, not independent things it's commissioned against on equal footing.

```
commissioning_request:
  objective_id: 1.1.2   # Engineering tier: "Create a book checkin/checkout/waitlist" — matches the WI-001 thread below
  template_id: TPL-ENTERPRISE-WEB-APP
  profile_id: PROFILE-NODEJS-STARTUP
  authorised_requestor: "jane.doe@library.org"
```

Validation (Ch.1 §11): does `TPL-ENTERPRISE-WEB-APP` support every Capability Objective 1.1.2 requires? Yes — capability `6`. **Passes.**

---

## 7. Composition Engine → EBM

The frozen, versioned result. This is what the SEU is actually commissioned *against*, operationally — distinct from the Objective, which is what it's commissioned *in service of*.

```
ebm:
  id: EBM-001
  composed_from:
    template: TPL-ENTERPRISE-WEB-APP
    profile: PROFILE-NODEJS-STARTUP
    resolved_packs: [ PACK-TECH-NODEJS@2.1.0, PACK-GOVERNANCE-STYLE@1.0.0 ]
    # Profile's selected_packs names these unversioned and stays valid as they evolve;
    # this is that same list resolved and pinned to the exact version Active at composition time

  resolved_quality_gate:
    entity_type: Deliverable
    applies_to: "Source Code"
    from_state: "In Progress"
    to_state: "Ready"
    scoped_to_capability: 6
    evaluation_criteria:
      # PACK-COMPLIANCE-OWASP is not in PROFILE-NODEJS-STARTUP's resolved_packs (§5) —
      # its policies (S1/S2/S3) do not apply to this gate. Only what's actually composed applies.
      - policy: POL-CODE-REVIEW-REQUIRED (from PACK-GOVERNANCE-STYLE@1.0.0)
        constraint_type: Policy   # blocking
        conditions: [ review_passed, reviewer_distinct_from_author, prior_findings_resolved ]
      - tier_gate: minimal-release-gate (from PACK-GOVERNANCE-STYLE@1.0.0, tier: minimal)
        # PROFILE-NODEJS-STARTUP accepted the Pack's default_tier; resolved and fixed here regardless
        constraint_type: Policy
        conditions: [ automated_tests_pass, single_approver_merged ]
      - policy: POL-CODING-STANDARDS (from PACK-TECH-NODEJS@2.1.0)
        constraint_type: Standard   # non-blocking, surfaced via Telemetry
        conditions: [ zero_lint_errors, warning_count_under_threshold, complexity_under_ceiling, no_dead_code_blocks ]
      - policy: POL-STATIC-ANALYSIS-REQUIRED (from PACK-TECH-NODEJS@2.1.0)
        constraint_type: Policy
        conditions: [ zero_critical_high_defects, zero_security_findings, tech_debt_ratio_under_threshold ]
      - policy: POL-REQUIREMENTS-TRACEABILITY (from PACK-GOVERNANCE-STYLE@1.0.0)
        constraint_type: Standard   # deviation surfaced, not blocking (Ch.24 §11)
        conditions: [ traces_to_requirements_specification ]
    # resolved at composition time; fixed for the life of EBM-001 regardless of
    # later Pack updates (Chapter 5 §12 — EBM records exact Pack versions)
```

---

## 8. SEU

```
seu:
  id: SEU-EBOOKLIB-001
  commissioned_against: EBM-001
  objective_id: 1.1.2
  status: Ready for Execution
```

---

## 9. Deliverable instance

Carries no service or Pack reference of its own — only the capability code inherited from Template's dependency edge (step 2). This is why the same Service can be reused across Templates without ever being duplicated onto the Deliverable.

```
deliverable:
  id: DLV-SOURCE-CODE-001
  seu_id: SEU-EBOOKLIB-001
  deliverable_type: "Source Code"
  current_state: "In Progress"
  required_capability_code: 6
```

---

## 10. Work Item, Execution, Evidence

```
work_item:
  id: WI-001
  deliverable_id: DLV-SOURCE-CODE-001
  requires_capability: 6
  description: "Implement book-borrowing endpoint (POST /loans)"
  participant_assigned: "AI-Participant-07 (Node.js-capable)"
  authored_by: "AI-Participant-07"
```

Execution produces evidence mapped to each condition the resolved gate (§7) actually checks — not one evidence item per Policy, one per condition, since that's the granularity the gate evaluates at:

```
evidence (WI-001):
  - type: code_artifact
    ref: "src/loans/borrowBook.js"
  - type: review_result                        # POL-CODE-REVIEW-REQUIRED
    review_gate: nodejs-standards-review
    outcome: Passed
    reviewer_identity: "AI-Participant-12"      # distinct from authored_by above
    prior_findings_status: "none outstanding"
  - type: merge_record                          # minimal-release-gate (tier: minimal)
    approver_count: 1
  - type: lint_result                           # POL-CODING-STANDARDS
    severity_filter: error
    count: 0
    warning_count: 2                            # under this tier's declared threshold
  - type: complexity_scan_result                # POL-CODING-STANDARDS
    max_cyclomatic_complexity: 6                # under Pack's declared ceiling
  - type: static_analysis_result                # POL-STATIC-ANALYSIS-REQUIRED
    severity_filter: critical_high
    count: 0
    security_findings: 0
    technical_debt_ratio: 0.02                  # under threshold
  - type: traceability_record                   # POL-REQUIREMENTS-TRACEABILITY
    direction: code_to_requirement
    linked_requirement: "REQ-1.1.2-03"
```

---

## 11. Quality Gate evaluation → State Transition

Evaluating the gate resolved in EBM-001 (§7) against WI-001's evidence, condition by condition:

| Policy | Condition | Result |
|---|---|---|
| POL-CODE-REVIEW-REQUIRED | review outcome = Passed | **PASS** |
| POL-CODE-REVIEW-REQUIRED | reviewer distinct from author | **PASS** (`AI-Participant-12` ≠ `AI-Participant-07`) |
| POL-CODE-REVIEW-REQUIRED | prior findings resolved | **PASS** |
| minimal-release-gate | single approver merged | **PASS** |
| POL-CODING-STANDARDS | zero lint errors | **PASS** |
| POL-CODING-STANDARDS | warnings under threshold | **PASS** |
| POL-CODING-STANDARDS | complexity under ceiling | **PASS** |
| POL-STATIC-ANALYSIS-REQUIRED | zero critical/high defects | **PASS** |
| POL-STATIC-ANALYSIS-REQUIRED | zero security findings | **PASS** |
| POL-STATIC-ANALYSIS-REQUIRED | tech debt ratio under threshold | **PASS** |
| POL-REQUIREMENTS-TRACEABILITY (Standard) | traces to a requirement | **PASS** |

Every Policy-constraint condition satisfied → **`DLV-SOURCE-CODE-001` transitions `In Progress → Ready`.**

**Contrast case — same gate, a second Work Item that fails on the condition the earlier version of this example never actually tested: separation of duties, not just review outcome.**

```
work_item:
  id: WI-002
  deliverable_id: DLV-SOURCE-CODE-001
  requires_capability: 6
  authored_by: "AI-Participant-07"

evidence (WI-002):
  - type: review_result
    review_gate: nodejs-standards-review
    outcome: Passed
    reviewer_identity: "AI-Participant-07"   # same participant as authored_by — self-review
```

| Policy | Condition | Result |
|---|---|---|
| POL-CODE-REVIEW-REQUIRED | review outcome = Passed | PASS |
| POL-CODE-REVIEW-REQUIRED | reviewer distinct from author | **FAIL** (`AI-Participant-07` = `AI-Participant-07`) |

`POL-CODE-REVIEW-REQUIRED` has `constraint_type: Policy` (Ch.24 §11) — one failed condition blocks the whole Policy regardless of the other condition passing. `DLV-SOURCE-CODE-001` **stays `In Progress`**; a finding is recorded against WI-002 specifically citing the separation-of-duties failure, not a generic "review failed" — the Work Item needs a different reviewer assigned and resubmitted, not a re-review by the same participant.

---

Nothing above is inferred at test-writing time. Steps 1–9 are the fixed setup; step 10–11 give one fully-passing run and one run that fails on a single, specific condition inside an otherwise-passing Policy — both ready to become assertions directly, and the failure case now demonstrates why a condition-level structure matters rather than a single pass/fail per Policy.
