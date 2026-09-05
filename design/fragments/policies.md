# Canonical Policy Definitions

Structured against Chapter 24 §8's exact Policy Structure (Identifier, Name, Description, Category, Constraint Type, Applicability, Conditions, Required Evidence, Related Obligations, Exception Rules, Severity, Version, Originating Pack). Organised under Ch.24 §7's own seven categories, covering all 21 of its named illustrative examples plus extensions grounded in the professional bodies surveyed this session — nothing invented without a named source.

`required_evidence`, `exception_rules`, `related_obligations` all nest inside each condition, not at the Policy level — a Policy-level evidence list couldn't say which condition it satisfies once there's more than one. Every condition always carries `required_evidence`, `related_obligations` and `exception_rules` explicitly — empty (`[]`) where there's nothing to declare, never omitted.

**`configurable` is a structural marker, not a claim made in prose** — owner: "I am repeatedly saying applicability is configurable. Where is this captured? How will downstream systems know this is configurable?" Every cascadable value lives inside a literal `configurable:` key, at whichever level it applies, so a downstream system discovers what's tunable by looking for that key, never by reading a comment: a policy-level `configurable:` block holds `constraint_type`; each condition's own `configurable:` block holds its `severity`; `applicability`'s own `configurable:` block holds `deliverable-name`, `environment`, and `deliverable_lifecycle` together. Category and which evidence/obligation/exception a condition declares are the only things with no `configurable` block anywhere near them — those change what a policy governs or what proves it, a different kind of change than tuning how strict it is or which of its own declared targets currently apply.

**`applicability.configurable` holds all three of Ch.24 §9's dimensions actually used below, all as lists, all always present, never omitted**: `deliverable-name` (real Ontology `deliverable-name` codes — the refined form of §9's "Deliverable category"), `environment` (real, Ontology-backed — `category:environment`, migration 166: development/staging/production), and `deliverable_lifecycle` (real states from `transition_definitions`, `entity_type = 'Deliverable'` — `Defined`/`In Progress`/`Approved`/`Baselined`; not Ontology, a different canonical source). An empty list (`[]`) means "matches everything today, along this dimension" — the same "absence means all" default already established for Checklist — not "this dimension doesn't apply here." Every one of the 25 full definitions below carries all three, even the ones where every one of them is `[]`: owner — "applicability has to be configurable, and dropping it completely is going to cause issues downstream on how to configure it." A key that's sometimes present and sometimes not gives Pack/Template/Profile nothing reliable to attach a future narrowing override to; a key that's always there, empty or not, does.

The remaining §9 dimensions are deliberately not fields here: **Capability** — a deliverable-name already indirectly names its producing capability (Ch.11's own inputs/outputs contract), so a separate Capability filter would be redundant. **Engineering stage** — no real vocabulary exists for this anywhere in the platform; dropped rather than left as free, ungrounded text. **Organisation / Domain / Technology / Compliance requirement** — these are already fully handled by *which Packs* choose to adopt a given canonical Policy (Pack's own `category:pack` value), not by the Policy declaring its own scope along the same axis a second time.

Every condition below is a specific, independently checkable predicate, not a restatement of the Policy's own name — a Policy with one vague condition isn't a canonical definition, it's a description.

---

# Engineering Policies

## E1. Architecture Documentation Required

Ch.24 §7 example. SWEBOK Design KA (design rationale, trade-off analysis) plus the standard ADR shape (Context, Alternatives, Decision, Consequences).

```
policy:
  identifier: POL-ARCH-DOC-REQUIRED
  name: "Architecture Documentation Required"
  description: "Every Architecture Deliverable requires a reviewed ADR documenting context, alternatives, and consequences before Approval."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [architecture-decision-record]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "An ADR record exists, linked to this Architecture Deliverable."
      required_evidence: [{ type: adr_record }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The ADR documents the problem context motivating the decision."
      required_evidence: [{ type: adr_record, field: context }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "The ADR documents at least one alternative that was considered and rejected, with rationale."
      required_evidence: [{ type: adr_record, field: alternatives_considered }]
      configurable:
        severity: Medium
      exception_rules:
        - "A decision with no viable alternative (single-vendor constraint, regulatory mandate) may state 'no alternative' explicitly, with justification, in place of a rejected option."
      related_obligations: []
    - statement: "The ADR documents both positive and negative consequences of the decision, including identified risk."
      required_evidence: [{ type: adr_record, field: consequences }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "The ADR was reviewed and approved by an Architecture-capability participant other than its author."
      required_evidence: [{ type: review_result }]
      configurable:
        severity: Critical
      exception_rules:
        - "A single-architect SEU (no second Architecture participant available) may substitute Authority sign-off for peer review, logged as a governance exception."
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E2. Unit Test Coverage Threshold

Ch.24 §7 example. ISTQB Test Analysis and Design — differentiated coverage types and differentiated thresholds for critical-path code are standard practice, not a single blanket number.

```
policy:
  identifier: POL-TEST-COVERAGE-THRESHOLD
  name: "Test Coverage Threshold"
  description: "Source Code must meet differentiated line, branch and critical-path coverage thresholds before Verification passes."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Line coverage >= the threshold declared by the active governance tier."
      required_evidence: [{ type: test_result, metric: line_coverage }]
      configurable:
        severity: High
      exception_rules:
        - "Legacy code under active remediation may be granted a temporary lower threshold, time-boxed and tracked as an Obligation."
      related_obligations: []
    - statement: "Branch coverage >= the threshold declared by the active governance tier."
      required_evidence: [{ type: test_result, metric: branch_coverage }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Modules tagged critical-path (authentication, payment, data-integrity) meet a threshold at least 15 points higher than the general threshold."
      required_evidence: [{ type: test_result, metric: line_coverage, scope: critical_path }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "No source file is excluded from coverage measurement without a documented, Authority-approved justification."
      required_evidence: [{ type: coverage_exclusion_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E3. Coding Standards

Ch.24 §7 example. Elevates `PACK-TECH-NODEJS` / `PACK-TECH-JAVA`'s own declared standards into checkable conditions, distinguishing blocking style violations from complexity and dead-code hygiene.

```
policy:
  identifier: POL-CODING-STANDARDS
  name: "Coding Standards"
  description: "Source Code must conform to the style, complexity and hygiene standards declared by the active Technology Pack."
  category: Engineering Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Lint tool reports zero errors against the active Technology Pack's declared ruleset."
      required_evidence: [{ type: lint_result, severity_filter: error }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Lint warning count does not exceed the threshold declared by the active governance tier."
      required_evidence: [{ type: lint_result, severity_filter: warning }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
    - statement: "Cyclomatic complexity per function does not exceed the Technology Pack's declared ceiling."
      required_evidence: [{ type: complexity_scan_result }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "No block of commented-out code exceeding five lines is present in the Deliverable."
      required_evidence: [{ type: lint_result, rule: no-dead-code }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-TECH-NODEJS   # or PACK-TECH-JAVA — resolved per which Pack is active, same as the Review Gate pattern in example.md §7
```

## E4. Requirements Traceability Required

BABOK Requirements Life Cycle Management — Trace Requirements. Traceability is bidirectional in practice, not one-directional, and orphaned requirements are the failure mode that actually matters.

```
policy:
  identifier: POL-REQUIREMENTS-TRACEABILITY
  name: "Requirements Traceability Required"
  description: "Source Code and Requirements Specification must trace to each other bidirectionally, with no undeclared orphans on either side."
  category: Engineering Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Source Code module traces to at least one Requirements Specification item."
      required_evidence: [{ type: traceability_record, direction: code_to_requirement }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Every Requirements Specification item traces to at least one Source Code module, or is explicitly marked Deferred or Rejected."
      required_evidence: [{ type: traceability_record, direction: requirement_to_code }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "No Requirements Specification item remains untraced and unmarked for more than one release cycle."
      required_evidence: [{ type: traceability_gap_report }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E5. Baseline Integrity

SWEBOK Software Configuration Management — Configuration Control. A real baseline-integrity check verifies the artefact hash, not just the presence of a change record.

```
policy:
  identifier: POL-BASELINE-INTEGRITY
  name: "Baseline Integrity"
  description: "A Baselined Deliverable's content must match its last approved snapshot exactly, and every divergence must be attributable to an approved change."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: [Baselined]
  conditions:
    - statement: "The Deliverable's current content hash matches its recorded baseline hash, or the divergence is attributed to exactly one approved Change record."
      required_evidence: [{ type: baseline_hash_comparison }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "No commit to the baselined branch lacks an associated Change ID."
      required_evidence: [{ type: change_approval_record }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E6. Requirements and Discovery Artifact Completeness

BABOK Business Analysis Planning and Monitoring KA (stakeholder/plan completeness) and Strategy Analysis KA (current/future state, solution options). Covers the 10 Discovery-phase deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-REQUIREMENTS-DISCOVERY-COMPLETENESS
  name: "Requirements and Discovery Artifact Completeness"
  description: "Vision, business analysis, and requirements artefacts each name a measurable objective and a recorded author before downstream work relies on them."
  category: Engineering Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [vision, business-case, business-analysis-plan, requirements-backlog, requirements-analysis-model, requirements-prioritisation-record, requirements-specification, solution-options-analysis, reuse-assessment, objective-alignment-report]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Vision or Business Case names at least one measurable business objective."
      required_evidence: [{ type: business_case_review }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Every Requirements artefact (Backlog, Analysis Model, Prioritisation Record, Specification) has a recorded author and last-review date."
      required_evidence: [{ type: artefact_metadata_check }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
    - statement: "A Solution Options Analysis or Reuse Assessment exists before Architecture work begins for a new capability, and an Objective Alignment Report confirms it traces back to a declared Objective."
      required_evidence: [{ type: solution_options_review }]
      configurable:
        severity: Medium
      exception_rules:
        - "A single, mandated solution (regulatory or platform constraint) may document that constraint in place of a comparative options analysis."
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E7. Design Completeness and Review

SWEBOK Design KA (design rationale, decomposition) and OWASP ASVS V1 (secure design). Covers the 8 design-phase deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-DESIGN-COMPLETENESS-REVIEW
  name: "Design Completeness and Review"
  description: "Design artefacts trace to the requirement or capability they satisfy, security design is reviewed wherever sensitive data or external input is handled, and interface contracts don't conflict with each other."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [solution-architecture-document, system-model, security-design, ux-ui-design-specification, detailed-design-specification, database-schema-data-model, integration-specification-interface-contracts, domain-model]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Design artefact declares the requirement or capability it satisfies, not left as free-standing content."
      required_evidence: [{ type: traceability_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "A Security Design exists, reviewed by a security-capable participant, for any component handling sensitive data or external input."
      required_evidence: [{ type: review_result }]
      configurable:
        severity: Critical
      exception_rules:
        - "A component with no sensitive data and no external-facing surface may be exempted, logged with justification."
      related_obligations: []
    - statement: "Interface/integration contracts (API, database schema, integration specification) are internally consistent — no two Design artefacts declare conflicting contracts for the same interface."
      required_evidence: [{ type: contract_consistency_check }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E8. Build and Configuration Artifact Integrity

NIST SSDF PO.3/PS.3 (well-secured configuration) and SWEBOK Software Configuration Management. Covers the 6 build/config deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-BUILD-CONFIG-ARTIFACT-INTEGRITY
  name: "Build and Configuration Artifact Integrity"
  description: "Configuration, pipeline, and infrastructure-as-code artefacts are version-controlled and secret-free, the Test Suite runs as part of the pipeline rather than manually, and an Integration Build must pass before promotion."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [configuration-files, ci-cd-pipeline-definition, infrastructure-as-code-environment-configuration, integration-build, test-suite, technical-notes]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Configuration File, CI/CD Pipeline Definition, and Infrastructure-as-Code artefact is version-controlled and free of embedded secrets."
      required_evidence: [{ type: secrets_scan_result }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The Test Suite executes as part of the CI/CD Pipeline Definition, not run manually and separately from it."
      required_evidence: [{ type: pipeline_configuration_check }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "An Integration Build completes without error before being promoted beyond the environment it was built in."
      required_evidence: [{ type: build_result }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## E9. AI, Embedded, and Data Specialisation Artifact Completeness

NIST AI RMF (model documentation and evaluation) and standard embedded-systems hardware-interface verification practice. Covers the 8 specialisation deliverable-names (AI Model Engineering, Embedded Firmware Engineering, Data Pipeline Engineering Packs) with no prior governing policy.

```
policy:
  identifier: POL-AI-EMBEDDED-DATA-SPECIALISATION-COMPLETENESS
  name: "AI, Embedded, and Data Specialisation Artifact Completeness"
  description: "A trained model is documented and evaluated, a firmware build is verified against its declared hardware interface, and a data pipeline's output meets its own declared quality thresholds."
  category: Engineering Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [training-data-specification, model-card, model-evaluation-report, hardware-interface-specification, firmware-build, hardware-compatibility-report, data-pipeline-specification, data-quality-report]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "A Model Card exists for every trained model, declaring its own Training Data Specification and Model Evaluation Report."
      required_evidence: [{ type: model_documentation_check }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "A Firmware Build is accompanied by a Hardware Compatibility Report confirming it against its declared Hardware Interface Specification."
      required_evidence: [{ type: hardware_compatibility_report }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "A Data Pipeline Specification's own output meets the thresholds declared in its Data Quality Report before being consumed downstream."
      required_evidence: [{ type: data_quality_report }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Security Policies

## S1. Encryption Required

Ch.24 §7 example. OWASP ASVS V6/V9, NIST SSDF PW.1 — key management is a distinct, commonly-missed failure mode from encryption-at-rest itself, and internal cross-segment traffic is frequently and wrongly exempted.

```
policy:
  identifier: POL-ENCRYPTION-REQUIRED
  name: "Encryption Required"
  description: "Sensitive data must be encrypted at rest and in transit, with keys held in an approved key management service."
  category: Security Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Sensitive data fields are encrypted at rest using AES-256 or an approved equivalent."
      required_evidence: [{ type: encryption_at_rest_scan_result }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Encryption keys are held in an approved key management service, never embedded in code or configuration."
      required_evidence: [{ type: secrets_scan_result, scope: encryption_keys }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "All external network communication uses TLS 1.2 or higher."
      required_evidence: [{ type: tls_configuration_scan_result, scope: external }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Internal service-to-service communication crossing a network segment boundary also uses TLS."
      required_evidence: [{ type: tls_configuration_scan_result, scope: internal_cross_segment }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-COMPLIANCE-OWASP
```

## S2. Secrets Management

Ch.24 §7 example. NIST SSDF PS.1. A real secrets check scans full history, not just current state — a removed secret is still exposed in git log.

```
policy:
  identifier: POL-SECRETS-MANAGEMENT
  name: "Secrets Management"
  description: "No credential, API key or secret may exist in current repository content or history; all secrets are retrieved from an approved secrets manager."
  category: Security Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Secret-scanning tool reports zero secrets in current repository content."
      required_evidence: [{ type: security_scan_result, scope: current_state }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Secret-scanning tool reports zero secrets across full repository commit history."
      required_evidence: [{ type: security_scan_result, scope: full_history }]
      configurable:
        severity: Critical
      exception_rules:
        - "A historical secret already rotated and confirmed invalid may be logged as accepted residual history rather than requiring history rewrite, subject to Security Engineering sign-off."
      related_obligations: []
    - statement: "All runtime secret references resolve via environment variable or secrets-manager lookup, never a literal value."
      required_evidence: [{ type: static_analysis_result, rule: no-hardcoded-secret-reference }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-COMPLIANCE-OWASP
```

## S3. Dependency Vulnerability Threshold

Ch.24 §7 example. OWASP ASVS + NIST SSDF RV.1. Severity-differentiated SLAs and scan freshness are what distinguish a real vulnerability-management policy from a single pass/fail gate.

```
policy:
  identifier: POL-DEPENDENCY-VULN-THRESHOLD
  name: "Dependency Vulnerability Threshold"
  description: "Dependencies must carry no unremediated Critical CVE, and no High CVE beyond its remediation SLA, verified against a current scan."
  category: Security Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: [production]
      deliverable_lifecycle: []
  conditions:
    - statement: "Zero unresolved Critical-severity CVEs across all dependencies."
      required_evidence: [{ type: dependency_scan_result, severity_filter: critical }]
      configurable:
        severity: Critical
      exception_rules:
        - "Time-boxed waiver requires Security Engineering approval and a tracked remediation Obligation."
      related_obligations:
        - "Obligation raised for any Critical CVE granted a waiver, tracked to remediation."
    - statement: "Zero unresolved High-severity CVEs open longer than the declared 30-day remediation SLA."
      required_evidence: [{ type: dependency_scan_result, severity_filter: high }]
      configurable:
        severity: High
      related_obligations:
        - "Obligation raised for any High CVE approaching its SLA boundary."
      exception_rules: []
    - statement: "The dependency scan used for this evaluation completed within the last 7 days."
      required_evidence: [{ type: dependency_scan_result, field: scan_timestamp }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-COMPLIANCE-OWASP
```

---

# Quality Policies

## Q1. Code Review Mandatory

Ch.24 §7 example. SWEBOK Design/Construction KA. Separation of duties — reviewer distinct from author — is the condition that actually makes this a governance control rather than a formality.

```
policy:
  identifier: POL-CODE-REVIEW-REQUIRED
  name: "Code Review Required"
  description: "Source Code requires a passed review, by a participant other than its author, addressing all prior findings, before Ready."
  category: Quality Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "At least one review_result with outcome Passed exists for the Work Item."
      required_evidence: [{ type: review_result }]
      configurable:
        severity: Critical
      exception_rules:
        - "Emergency hotfix, approved by an Authority holder, may defer review to within 24 hours post-release."
      related_obligations: []
    - statement: "The reviewing participant is not the same participant who authored the change."
      required_evidence: [{ type: review_result, field: reviewer_identity }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "All findings raised in a prior review round on this Deliverable are marked resolved or explicitly deferred with rationale."
      required_evidence: [{ type: review_result, field: prior_findings_status }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## Q2. Static Analysis Required

Ch.24 §7 example. Distinct from E3 (style/convention) — this is defect- and security-relevant static analysis, plus a technical-debt trend, not just a linter pass.

```
policy:
  identifier: POL-STATIC-ANALYSIS-REQUIRED
  name: "Static Analysis Required"
  description: "Source Code must clear defect- and security-relevant static analysis, with technical debt held below a declared ratio."
  category: Quality Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Zero Critical or High severity defects reported by static analysis."
      required_evidence: [{ type: static_analysis_result, severity_filter: critical_high }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Zero security-relevant findings reported by static analysis (distinct from the dependency-level scan in S1-S3)."
      required_evidence: [{ type: static_analysis_result, category: security }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Technical debt ratio, as reported by the static analysis tool, does not exceed the threshold declared by the active governance tier."
      required_evidence: [{ type: static_analysis_result, metric: technical_debt_ratio }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-TECH-NODEJS
```

## Q3. Performance Validation

Ch.24 §7 example. ISTQB non-functional testing. Latency, throughput, resource ceiling and leak detection are four independently-failing dimensions in real performance testing, not one pass/fail.

```
policy:
  identifier: POL-PERFORMANCE-VALIDATION
  name: "Performance Validation"
  description: "Source Code must meet declared latency, throughput and resource targets under sustained load, with no detected memory leak, before Release."
  category: Quality Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [source-code]
      environment: [production]
      deliverable_lifecycle: []
  conditions:
    - statement: "P95 latency under declared load is at or below the SLA target."
      required_evidence: [{ type: performance_report, metric: p95_latency }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Throughput under declared load meets or exceeds the minimum requests-per-second target."
      required_evidence: [{ type: performance_report, metric: throughput }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "No memory leak detected over a sustained load-test window (memory usage returns to baseline after load subsides)."
      required_evidence: [{ type: performance_report, metric: memory_profile }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "CPU and memory utilisation under peak declared load remain below the declared ceiling."
      required_evidence: [{ type: performance_report, metric: resource_utilisation }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## Q4. Test and Quality Evidence Completeness

ISTQB Test Management (defect tracking, test reporting) and SWEBOK Testing KA. Covers the 5 test/quality-evidence deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-TEST-QUALITY-EVIDENCE-COMPLETENESS
  name: "Test and Quality Evidence Completeness"
  description: "Test and performance reports name the exact version they were run against, every open defect has an assigned severity and owner, and confidence/benchmark evidence is produced before, not after, the decision that relies on it."
  category: Quality Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [test-report-results, performance-load-test-report, defect-log, confidence-assessment, benchmark-report]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Test Report Results and Performance/Load Test Report names the specific build or version it was executed against."
      required_evidence: [{ type: test_result, field: version_under_test }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Every open entry in the Defect Log has an assigned severity and owner."
      required_evidence: [{ type: defect_log_review }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "A Confidence Assessment or Benchmark Report is produced before the Release-stage decision that relies on it, not compiled retroactively to justify one already made."
      required_evidence: [{ type: confidence_assessment }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Operational Policies

## O1. Deployment Approval Required

Ch.24 §7 example. ITIL Release Management — distinct from O4 (approval of the change) and E5/S3-style obligation checks (nothing outstanding at the moment of deployment specifically).

```
policy:
  identifier: POL-DEPLOYMENT-APPROVAL-REQUIRED
  name: "Deployment Approval Required"
  description: "A Release Package requires a current, unexpired approval with no outstanding Critical or High Obligation before production deployment."
  category: Operational Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [release-package]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Release Management Service has issued an approved release recommendation for this exact package version."
      required_evidence: [{ type: release_approval_record }]
      configurable:
        severity: Critical
      exception_rules:
        - "Emergency rollback deployment may bypass approval, subject to retrospective review."
      related_obligations: []
    - statement: "The approval was issued within its declared validity window (has not gone stale relative to the deployment attempt)."
      required_evidence: [{ type: release_approval_record, field: issued_at }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "No Critical or High severity Obligation remains open against this Release Package at deployment time."
      required_evidence: [{ type: obligation_register_snapshot }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## O2. Backup Validation

Ch.24 §7 example. ITIL Service Continuity Management / COBIT DSS04. A backup that completed but was never restore-tested is not actually validated — this is the real-world failure mode the policy exists to catch.

```
policy:
  identifier: POL-BACKUP-VALIDATION
  name: "Backup Validation"
  description: "The most recent production backup must have completed successfully, been restore-tested, and meet the declared retention minimum."
  category: Operational Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "The most recent scheduled backup completed successfully."
      required_evidence: [{ type: backup_completion_record }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "A restoration test against the most recent backup succeeded within the declared cadence window."
      required_evidence: [{ type: backup_validation_result }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Backup retention meets or exceeds the declared minimum duration."
      required_evidence: [{ type: backup_retention_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## O3. Rollback Capability

Ch.24 §7 example. ITIL Release/Deployment Management. Documentation without a dry-run test is not a verified rollback path.

```
policy:
  identifier: POL-ROLLBACK-CAPABILITY
  name: "Rollback Capability"
  description: "A Release Package must have a documented rollback procedure, dry-run tested, completing within the declared recovery time objective."
  category: Operational Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [release-package]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Rollback procedure is documented for this release."
      required_evidence: [{ type: rollback_procedure_document }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Rollback was dry-run tested in a non-production environment for this release."
      required_evidence: [{ type: rollback_test_result }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The tested rollback completed within the declared recovery time objective (RTO)."
      required_evidence: [{ type: rollback_test_result, metric: duration }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## O4. Change Approval Required

ITIL Change Enablement practice. Also satisfies Organisation Policies' "Change management" example (G2). Conflict detection against concurrently-scheduled changes is what a Change Advisory Board actually does beyond simple approval.

```
policy:
  identifier: POL-CHANGE-APPROVAL-REQUIRED
  name: "Change Approval Required"
  description: "A change requires an approved decision from the Change Evaluation and Scheduling Service, confirmed non-conflicting with concurrently scheduled changes, with a documented rollback plan."
  category: Operational Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Change request has an associated approved decision from the Change Evaluation and Scheduling Service."
      required_evidence: [{ type: change_approval_record }]
      configurable:
        severity: Critical
      exception_rules:
        - "Emergency change may proceed with retrospective approval within one business day, per Authority policy."
      related_obligations: []
    - statement: "The change does not conflict with another approved change scheduled for the same window."
      required_evidence: [{ type: change_conflict_report }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "The change includes a documented rollback plan (satisfies O3 where the change is itself a release)."
      required_evidence: [{ type: rollback_procedure_document }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## O5. Release and Operations Artifact Completeness

ITIL Release Management and ITIL Incident/Problem Management (post-mortem, root cause, known error). Covers the 9 release/operations deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-RELEASE-OPERATIONS-COMPLETENESS
  name: "Release and Operations Artifact Completeness"
  description: "A deployment is accompanied by release notes and active monitoring before reaching production, and every incident produces a root cause analysis, with recurring causes logged as known errors."
  category: Operational Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [deployment-manifest, deployment-package, release-notes-change-log, app-store-submission-package, monitoring-alerting-configuration, incident-report-post-mortem, root-cause-analysis-report, known-error-record, operational-intelligence-report]
      environment: [production]
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Deployment Manifest or Deployment Package is accompanied by Release Notes / Change Log naming what changed."
      required_evidence: [{ type: release_notes_review }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Monitoring & Alerting Configuration exists and is active before a Deployment Package reaches production."
      required_evidence: [{ type: monitoring_configuration_check }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Every Incident Report / Post-Mortem produces a Root Cause Analysis Report, and a recurring cause is logged as a Known Error Record rather than re-investigated from scratch each time."
      required_evidence: [{ type: root_cause_analysis_report }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "An App Store Submission Package includes the target platform's required metadata and passes automated store-compliance checks before submission."
      required_evidence: [{ type: store_compliance_check }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Documentation Policies

## D1. ADR Required

Ch.24 §7 example. Broader than E1 (which is Architecture-Deliverable-specific) — this applies to any significant decision generally.

```
policy:
  identifier: POL-ADR-REQUIRED
  name: "ADR Required"
  description: "Every significant engineering decision must be recorded as an ADR, traceable to what it affects, and not left indefinitely in Draft."
  category: Documentation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "The decision has a linked ADR record."
      required_evidence: [{ type: adr_record }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The ADR references the Objective or Deliverable it affects."
      required_evidence: [{ type: adr_record, field: affected_entity }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "The ADR's status is Published, not left in Draft beyond the declared grace period."
      required_evidence: [{ type: adr_record, field: status }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## D2. API Documentation Mandatory

Ch.24 §7 example. Contract validation — checking the docs actually match the live API — is what separates real API documentation policy from a one-time authored file that silently drifts.

```
policy:
  identifier: POL-API-DOC-MANDATORY
  name: "API Documentation Mandatory"
  description: "Every public API endpoint must have current, example-bearing, contract-validated documentation before Release."
  category: Documentation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [api-specification]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every public endpoint has documented request and response schemas, including error responses."
      required_evidence: [{ type: documentation_artifact, field: schema_coverage }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Every public endpoint has at least one worked example."
      required_evidence: [{ type: documentation_artifact, field: examples }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "The documented contract (e.g. OpenAPI spec) validates against the live API's actual behaviour, with zero drift."
      required_evidence: [{ type: contract_validation_result }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## D3. Operational Runbook Required

Ch.24 §7 example. A runbook missing escalation contacts is a common real-world gap this decomposition catches that a single "does a runbook exist" check would miss.

```
policy:
  identifier: POL-OPERATIONAL-RUNBOOK-REQUIRED
  name: "Operational Runbook Required"
  description: "A Release Package must be accompanied by a current Operational Guide covering incident response, rollback, and escalation."
  category: Documentation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [runbook-operational-documentation]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Operational Guide covers incident response procedure."
      required_evidence: [{ type: documentation_artifact, field: incident_response }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Operational Guide covers rollback procedure, consistent with O3's documented rollback plan."
      required_evidence: [{ type: documentation_artifact, field: rollback }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Operational Guide includes current on-call escalation contacts."
      required_evidence: [{ type: documentation_artifact, field: escalation_contacts }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Operational Guide was updated within the current release cycle."
      required_evidence: [{ type: documentation_artifact, field: last_updated }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Customer Policies

## C1. Customer Sign-off Required

Ch.24 §7 example. §19.3's own worked example of Human-attested evidence. Sign-off must name the exact version accepted, or it doesn't actually establish what was approved.

```
policy:
  identifier: POL-CUSTOMER-SIGNOFF-REQUIRED
  name: "Customer Sign-off Required"
  description: "A customer-facing Deliverable requires a human-attested sign-off, naming the exact version accepted, obtained before Baselined."
  category: Customer Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: [Baselined]
  conditions:
    - statement: "A human-attested sign-off record exists from the designated customer authority."
      required_evidence: [{ type: human_attestation, classification: human-attested }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The sign-off record names the specific Deliverable version being accepted."
      required_evidence: [{ type: human_attestation, field: accepted_version }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "The sign-off timestamp precedes the Baselined transition, not recorded after the fact."
      required_evidence: [{ type: human_attestation, field: timestamp }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## C2. Business Approval Required

Ch.24 §7 example. BABOK Solution Evaluation KA.

```
policy:
  identifier: POL-BUSINESS-APPROVAL-REQUIRED
  name: "Business Approval Required"
  description: "A recommended solution option requires business sponsor approval, naming the specific option, obtained before Architecture work begins."
  category: Customer Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Business sponsor approval is recorded for the recommended option."
      required_evidence: [{ type: human_attestation, classification: human-attested }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The approval record references the specific recommended option's comparative analysis, not the objective generally."
      required_evidence: [{ type: human_attestation, field: approved_option }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Approval was obtained before Architecture work began, not retroactively."
      required_evidence: [{ type: human_attestation, field: timestamp }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## C3. Release Notification

Ch.24 §7 example. ITIL Release Management stakeholder communication.

```
policy:
  identifier: POL-RELEASE-NOTIFICATION
  name: "Release Notification"
  description: "Stakeholders must be notified of a pending Release Package, with adequate lead time and support information."
  category: Customer Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [release-package]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "A notification record exists, sent to every declared stakeholder distribution list."
      required_evidence: [{ type: notification_record, field: recipients }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Notification was sent at least the declared lead time before deployment."
      required_evidence: [{ type: notification_record, field: sent_at }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Notification includes rollback status and support contact information."
      required_evidence: [{ type: notification_record, field: content }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Organisation Policies

## G1. Internal Review Process

Ch.24 §7 example. Distinct from Q1 — a standing organisational review cadence for high-risk decisions, not a per-Deliverable gate. An approved outcome, not merely a completed review, is what should satisfy this.

```
policy:
  identifier: POL-INTERNAL-REVIEW-PROCESS
  name: "Internal Review Process"
  description: "Decisions above a defined risk threshold require an Architecture Review Board review that concluded Approved."
  category: Organisation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "The decision has a recorded risk score."
      required_evidence: [{ type: risk_assessment_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Decisions scoring at or above the declared risk threshold have a recorded Architecture Review Board review."
      required_evidence: [{ type: review_result, board: architecture_review_board }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The review's recorded outcome is Approved, not merely Reviewed or Rejected."
      required_evidence: [{ type: review_result, field: outcome }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G2. Change Management

Ch.24 §7 example — satisfied by O4 (Change Approval Required) above; cross-referenced rather than duplicated, per Ch.24 §10's own composition model (one Policy, many applicable contexts).

## G3. Engineering Standards

Ch.24 §7 example. SWEBOK's overall framing. A revision grounded in accumulated Telemetry evidence is a materially different, stronger condition than a revision grounded in opinion.

```
policy:
  identifier: POL-ENGINEERING-STANDARDS
  name: "Engineering Standards"
  description: "Engineering standards must be reviewed on a defined cadence, with revisions grounded in accumulated evidence rather than unstructured opinion."
  category: Organisation Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [engineering-standard]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "The standard has been reviewed within the declared cadence window."
      required_evidence: [{ type: standard_review_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "Any revision to the standard cites accumulated Telemetry evidence as its basis, not unstructured opinion alone."
      required_evidence: [{ type: standard_review_record, field: evidentiary_basis }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G4. Vendor Risk Assessment Required

COBIT APO10, confirmed independently by ITIL Supplier Management. Expired assessments and missing contractual protections are the two failure modes a single "assessment exists" check would miss.

```
policy:
  identifier: POL-VENDOR-RISK-ASSESSMENT
  name: "Vendor Risk Assessment Required"
  description: "A third-party vendor requires a current risk assessment, an acceptable or waived risk rating, and appropriate contractual data-protection terms."
  category: Organisation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "The vendor has a risk assessment on record, completed within the declared validity period."
      required_evidence: [{ type: vendor_risk_assessment, field: assessment_date }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "The assessed risk rating is below the declared acceptance threshold, or has been explicitly waived by an Authority holder."
      required_evidence: [{ type: vendor_risk_assessment, field: risk_rating }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "Where the vendor processes sensitive data, the contract includes a data-protection clause."
      required_evidence: [{ type: vendor_contract, field: data_protection_clause }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G5. Governance Tier Alignment

OCEG's integrated GRC thesis, checked against the tiered `PACK-GOVERNANCE-STYLE` Pack built in `example.md`. Cross-checks against G1 for the enterprise-tier case, rather than restating it.

```
policy:
  identifier: POL-GOVERNANCE-TIER-ALIGNMENT
  name: "Governance Tier Alignment"
  description: "A Profile's governance tier must be consistent with its compliance-relevant Pack selections and, at the enterprise tier, with formal review practice."
  category: Organisation Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: []
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "If any selected Pack has category: compliance, the resolved governance_tier is not 'rapid'."
      required_evidence: [{ type: profile_definition, field: selected_packs }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "If the resolved governance_tier is 'enterprise', at least one Architecture Review Board review (G1) exists per release."
      required_evidence: [{ type: review_result, board: architecture_review_board }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G6. Change and Decision Governance Artifact Completeness

ITIL Change Enablement and COBIT APO12 (Risk Management). Covers the 7 change/decision-governance deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-CHANGE-DECISION-GOVERNANCE-COMPLETENESS
  name: "Change and Decision Governance Artifact Completeness"
  description: "A Change Request has an impact analysis before approval, a Decision Record cites the risk assessment it relied on, a Data Migration Plan has a documented rollback, and unresolved policy conflicts don't carry silently into the next release."
  category: Organisation Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [change-request, decision-record, configuration-baseline-record, impact-analysis-report, policy-conflict-report, risk-assessment-report, data-migration-plan]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Change Request has an Impact Analysis Report before a Change Approval decision (O4) is made against it."
      required_evidence: [{ type: impact_analysis_report }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "A Decision Record cites the Risk Assessment Report it relied on, wherever the decision carries identified risk."
      required_evidence: [{ type: decision_record_review }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
    - statement: "A Data Migration Plan includes a Configuration Baseline Record of the pre-migration state and a documented rollback path."
      required_evidence: [{ type: rollback_procedure_document }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Any Policy Conflict Report raised against this Policy set is resolved, or explicitly accepted by an Authority holder, before the next Release."
      required_evidence: [{ type: policy_conflict_report }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations:
        - "Obligation raised for any Policy Conflict Report still unresolved at Release."
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G7. Vendor and Compliance Evidence Completeness

COBIT APO10 (Vendor Management) and standard audit-evidence practice (evidence traces to the specific control it satisfies). Covers the 5 vendor/compliance-evidence deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-VENDOR-COMPLIANCE-EVIDENCE-COMPLETENESS
  name: "Vendor and Compliance Evidence Completeness"
  description: "Compliance audit evidence names the specific control it satisfies, a security assessment exists for any data-handling vendor, and vendor performance is reviewed against its own contracted SLA."
  category: Organisation Policies
  configurable:
    constraint_type: Policy
  applicability:
    configurable:
      deliverable-name: [compliance-audit-evidence, security-assessment-report, vendor-assessment, vendor-contract, vendor-performance-record]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Every Compliance Audit Evidence item names the specific control or requirement it evidences, not submitted as undifferentiated supporting material."
      required_evidence: [{ type: compliance_audit_evidence }]
      configurable:
        severity: High
      exception_rules: []
      related_obligations: []
    - statement: "A Security Assessment Report exists for any Vendor Assessment covering a vendor with access to sensitive data."
      required_evidence: [{ type: security_assessment_report }]
      configurable:
        severity: Critical
      exception_rules: []
      related_obligations: []
    - statement: "Vendor Performance Records are reviewed against the Vendor Contract's own declared SLA at least once per contract term."
      required_evidence: [{ type: vendor_performance_record }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

## G8. Organisational Knowledge Currency

SWEBOK Software Engineering Process KA (knowledge management) and OCEG's organisational-learning framing. Covers the 7 remaining organisational-knowledge deliverable-names with no prior governing policy.

```
policy:
  identifier: POL-ORGANISATIONAL-KNOWLEDGE-CURRENCY
  name: "Organisational Knowledge Currency"
  description: "Knowledge base and lessons-learned content stays reviewed and current, capability maturity/roadmap artefacts are refreshed as lessons accumulate, and traceability/user documentation is updated when what it describes changes."
  category: Organisation Policies
  configurable:
    constraint_type: Standard
  applicability:
    configurable:
      deliverable-name: [knowledge-base-articles, lessons-learned-report, capability-maturity-assessment, capability-evolution-roadmap, traceability-matrix, review-report, user-technical-documentation]
      environment: []
      deliverable_lifecycle: []
  conditions:
    - statement: "Knowledge Base Articles and Lessons Learned Reports are reviewed for continued accuracy on a defined cadence, not left indefinitely from their original authoring date."
      required_evidence: [{ type: knowledge_review_record }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
    - statement: "A Capability Maturity Assessment or Capability Evolution Roadmap is refreshed following each major Lessons Learned Report."
      required_evidence: [{ type: capability_maturity_assessment }]
      configurable:
        severity: Low
      exception_rules: []
      related_obligations: []
    - statement: "A Traceability Matrix or piece of User/Technical Documentation is updated whenever the artefacts it traces or describes change materially, not left to drift."
      required_evidence: [{ type: traceability_matrix_currency_check }]
      configurable:
        severity: Medium
      exception_rules: []
      related_obligations: []
  version: 1.0.0
  originating_pack: PACK-GOVERNANCE-STYLE
```

---

# Coverage Summary

| Category | Ch.24 §7 named examples | Covered |
|---|---|---|
| Engineering | 3 | 3/3, plus 6 extensions (traceability, baseline integrity, requirements/discovery, design, build/config, AI/embedded/data) |
| Security | 3 | 3/3 |
| Quality | 3 | 3/3, plus 1 extension (test/quality evidence) |
| Operational | 3 | 3/3, plus 2 extensions (change approval shared with Organisation; release/operations) |
| Documentation | 3 | 3/3 |
| Customer | 3 | 3/3 |
| Organisation | 3 | 3/3 (one cross-referenced, not duplicated), plus 5 extensions (vendor risk, governance tier alignment, change/decision governance, vendor/compliance evidence, organisational knowledge) |

21 of 21 named examples covered, plus 14 extensions. 35 distinct Policy records total (34 full definitions plus G2's cross-reference).

**Deliverable-name coverage** (2026-09-05): every one of the 71 real, canonical `deliverable-name` Ontology codes now has at least one governing policy — verified programmatically, not just by inspection. The original 25 definitions named 6 codes directly (`source-code`, `release-package`, `api-specification`, `architecture-decision-record`, `runbook-operational-documentation`, plus `engineering-standard` added to G3). The 9 new policies (E6-E9, Q4, O5, G6-G8) close the remaining 65, grouped by governing concern rather than one policy per deliverable — each with its own real conditions and citation, not a single shallow condition repeated across a long `deliverable-name` list.
