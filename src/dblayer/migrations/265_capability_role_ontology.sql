-- CR-111 — Capability Registry. One row per capability-name code: the
-- Ontology already carries code/label/description (migration 046); this adds
-- the roles a capability decomposes into, each with its worktype codes
-- (migrations 263/264), so capability fulfillment has something to match
-- candidates against. `code` is validated against the `capability-name`
-- concept type at the application layer, same discipline as
-- service_definitions.capability_code (migration 153) — no DB-level FK to
-- ontology_concepts, since ontology_concepts has no unique key on
-- (concept_type, code) alone to reference (it's scoped by tenant_id too).
CREATE TABLE IF NOT EXISTS capability_definitions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL,
  default_label  TEXT NOT NULL,
  description    TEXT,
  roles          JSONB NOT NULL DEFAULT '[]',
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT capability_definitions_code_tenant_key UNIQUE (code, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_capability_definitions_tenant_id ON capability_definitions (tenant_id);

INSERT INTO capability_definitions
    (code, default_label, description, roles, tenant_id)
VALUES

('requirements-elicitation', 'Requirements Elicitation',
 'Systematically discover and capture stakeholder needs, business objectives, constraints, and expectations from relevant sources and express them as candidate requirements for subsequent analysis and validation.',
 '[
   {"name":"stakeholder-discovery","worktypes":["stakeholder-identification","stakeholder-context-discovery"]},
   {"name":"requirement-elicitation","worktypes":["interviewing","workshop-facilitation","observation","questioning"]},
   {"name":"requirement-capture","worktypes":["requirement-recording","requirement-structuring","requirement-source-capture"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('understanding-business-domain', 'Understanding business domain',
 'Establish, model, validate, and maintain a shared understanding of the business domain, including its concepts, terminology, entities, relationships, processes, rules, roles, and constraints, so that engineering decisions are grounded in accurate domain knowledge.',
 '[
   {"name":"domain-discovery","worktypes":["concept-discovery","terminology-discovery","entity-discovery","process-discovery"]},
   {"name":"domain-modelling","worktypes":["concept-modelling","entity-modelling","relationship-modelling","process-modelling","rule-modelling"]},
   {"name":"domain-knowledge-capture","worktypes":["knowledge-capture","terminology-capture","business-rule-capture","domain-documentation"]},
   {"name":"domain-validation","worktypes":["domain-model-validation","business-rule-validation","domain-knowledge-validation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('requirements-analysis', 'Analysing engineering requirements',
 'examine, structure, refine, model, and reason about elicited requirements to establish their meaning, relationships, dependencies, conflicts, constraints, priorities, and implications, producing a coherent requirements specification suitable for validation and subsequent engineering.',
 '[
   {"name":"requirement-analysis","worktypes":["requirement-examination","requirement-interpretation","requirement-structuring"]},
   {"name":"requirement-decomposition","worktypes":["requirement-decomposition","requirement-refinement","requirement-allocation"]},
   {"name":"requirement-relationship-analysis","worktypes":["dependency-analysis","relationship-analysis","conflict-analysis"]},
   {"name":"requirement-modelling","worktypes":["requirement-modelling","constraint-modelling","requirement-dependency-modelling"]},
   {"name":"requirement-specification","worktypes":["requirement-specification","requirement-consolidation","requirement-baseline-preparation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('requirements-validation', 'Validating engineering requirements',
 'establish that analysed requirements accurately represent intended business and stakeholder needs and are correct, complete, consistent, feasible, unambiguous, verifiable, traceable, and appropriately agreed before being established as the authoritative engineering baseline.',
 '[
   {"name":"requirement-validation","worktypes":["requirement-review","requirement-validation","requirement-acceptance-checking"]},
   {"name":"requirement-completeness-assessment","worktypes":["completeness-checking","missing-requirement-detection","boundary-checking"]},
   {"name":"requirement-consistency-assessment","worktypes":["consistency-checking","conflict-detection","dependency-checking"]},
   {"name":"requirement-feasibility-assessment","worktypes":["technical-feasibility","operational-feasibility","constraint-assessment"]},
   {"name":"requirement-verifiability-assessment","worktypes":["verifiability-checking","testability-checking","acceptance-criteria-checking"]},
   {"name":"requirement-traceability-assessment","worktypes":["traceability-checking","traceability-gap-detection","requirement-to-source-verification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('modelling-complex-systems', 'Modelling complex systems',
 'create, analyse, and maintain coherent structural and behavioural representations of a system, its context, interactions, dependencies, and constraints, so that system complexity can be understood and used as a reliable basis for architectural and engineering decisions.',
 '[
   {"name":"system-modelling","worktypes":["system-boundary-modelling","system-decomposition","context-modelling"]},
   {"name":"structural-modelling","worktypes":["component-modelling","entity-modelling","relationship-modelling"]},
   {"name":"behaviour-modelling","worktypes":["state-modelling","process-modelling","interaction-modelling"]},
   {"name":"dependency-modelling","worktypes":["dependency-identification","dependency-mapping","dependency-analysis"]},
   {"name":"model-validation","worktypes":["model-consistency-checking","model-completeness-checking","model-behaviour-validation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('architecture-design', 'Designing software architecture',
 'determine, evaluate, document, and maintain the fundamental structure of a software system, including its major components, responsibilities, interfaces, interactions, architectural patterns, constraints, and significant design decisions, so that validated requirements and business objectives can be realised within acceptable engineering risk',
 '[
   {"name":"architecture-definition","worktypes":["architecture-structure-definition","component-definition","responsibility-allocation"]},
   {"name":"architecture-decomposition","worktypes":["system-decomposition","component-decomposition","subsystem-decomposition"]},
   {"name":"architecture-interface-design","worktypes":["interface-definition","interaction-definition","integration-boundary-definition"]},
   {"name":"architecture-evaluation","worktypes":["architecture-evaluation","alternative-evaluation","trade-off-analysis"]},
   {"name":"architecture-evolution","worktypes":["architecture-change","architecture-migration","architecture-modernisation"]},
   {"name":"architectural-decision-making","worktypes":["architectural-decision-analysis","pattern-selection","constraint-resolution"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('software-construction', 'Constructing software systems',
 'transform architectural and detailed design specifications into working software components and implementation artefacts through coding, configuration, generation, and use of appropriate software assets, while maintaining conformance with applicable requirements, architecture, and engineering standards',
 '[
   {"name":"implementation","worktypes":["component-construction","feature-construction","interface-construction","change-implementation"]},
   {"name":"component-ownership","worktypes":["component-maintenance","component-evolution","component-integrity-maintenance"]},
   {"name":"code-review","worktypes":["implementation-review","code-quality-review","defect-identification"]},
   {"name":"integration","worktypes":["component-integration","interface-integration","integration-conflict-resolution"]},
   {"name":"defect-correction","worktypes":["defect-diagnosis","defect-reproduction","corrective-implementation","correction-verification"]},
   {"name":"refactoring","worktypes":["structural-improvement","code-simplification","duplication-removal"]},
   {"name":"technical-debt-remediation","worktypes":["debt-identification","debt-assessment","debt-reduction"]},
   {"name":"build-and-packaging","worktypes":["build-configuration","compilation","dependency-resolution","packaging"]},
   {"name":"development-tooling","worktypes":["development-automation","developer-utilities","code-generation","development-environment-support"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('software-design', 'Designing software components',
 'decompose architectural elements into implementable software components and determine their responsibilities, interfaces, behaviour, internal structure, dependencies, and design constraints so that they can be constructed consistently with the architecture and allocated requirements',
 '[
   {"name":"component-decomposition","worktypes":["component-identification","component-decomposition","responsibility-allocation"]},
   {"name":"component-design","worktypes":["component-structure-design","internal-structure-design","behaviour-design"]},
   {"name":"interface-design","worktypes":["interface-definition","interface-contract-design","interaction-design"]},
   {"name":"component-dependency-design","worktypes":["dependency-identification","dependency-definition","dependency-constraint-definition"]},
   {"name":"component-design-validation","worktypes":["design-consistency-checking","requirement-allocation-checking","architecture-conformance-checking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-configuration', 'Managing engineering configuration',
 'establish and maintain controlled configuration items, baselines, versions, dependencies, and configuration status throughout the engineering lifecycle, ensuring that authorised changes are incorporated consistently and that the composition of any engineering product or environment can be determined and reproduced.',
 '[
   {"name":"configuration-identification","worktypes":["configuration-item-identification","configuration-structure-definition","configuration-attribute-definition"]},
   {"name":"version-management","worktypes":["version-creation","version-tracking","branch-management","merge-management"]},
   {"name":"baseline-management","worktypes":["baseline-creation","baseline-maintenance","baseline-comparison","baseline-restoration"]},
   {"name":"configuration-change-tracking","worktypes":["change-recording","change-association","change-history-tracking"]},
   {"name":"configuration-status-management","worktypes":["configuration-status-recording","version-status-reporting","baseline-status-reporting"]},
   {"name":"configuration-verification","worktypes":["configuration-comparison","configuration-integrity-checking","configuration-reproducibility-checking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('software-validation', 'Verifying software quality',
 'systematically examine and test software and associated engineering artefacts against defined requirements, specifications, standards, and quality criteria, producing objective evidence of conformance and identifying deviations that require resolution.',
 '[
   {"name":"verification-planning","worktypes":["verification-scope-definition","verification-criteria-definition","verification-planning"]},
   {"name":"test-design","worktypes":["test-scenario-design","test-case-design","test-data-design"]},
   {"name":"test-execution","worktypes":["test-execution","result-capture","retesting"]},
   {"name":"test-automation","worktypes":["automated-test-development","automated-test-execution","test-automation-maintenance"]},
   {"name":"defect-detection","worktypes":["failure-detection","defect-identification","defect-reproduction"]},
   {"name":"quality-measurement","worktypes":["quality-measurement","quality-metric-collection","quality-result-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-documentation', 'Documenting engineering work',
 'create, maintain, organise, and retrieve authoritative records of engineering activities, decisions, artefacts, rationale, and evidence throughout the engineering lifecycle, ensuring that relevant engineering knowledge is understandable, traceable, and available to those who need it.',
 '[
   {"name":"engineering-documentation","worktypes":["technical-documentation","design-documentation","implementation-documentation","operational-documentation"]},
   {"name":"documentation-authoring","worktypes":["content-authoring","technical-explanation","procedure-writing"]},
   {"name":"documentation-maintenance","worktypes":["content-updating","documentation-synchronisation","obsolete-content-removal"]},
   {"name":"documentation-validation","worktypes":["accuracy-checking","consistency-checking","completeness-checking"]},
   {"name":"documentation-organisation","worktypes":["information-organisation","content-classification","cross-referencing"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('protect-organisational-assets', 'Protecting organisational assets',
 'identify organisational assets and their protection requirements, assess threats and vulnerabilities, establish and apply appropriate protective controls, and monitor their effectiveness so that assets remain protected against unauthorised access, misuse, damage, loss, compromise, or disruption',
 '[
   {"name":"asset-protection","worktypes":["asset-identification","asset-classification","protection-requirement-identification"]},
   {"name":"access-protection","worktypes":["access-control","permission-management","authentication-protection","authorisation-enforcement"]},
   {"name":"data-protection","worktypes":["data-classification","data-protection","data-encryption","data-handling"]},
   {"name":"vulnerability-management","worktypes":["vulnerability-identification","vulnerability-assessment","vulnerability-tracking","remediation"]},
   {"name":"threat-analysis","worktypes":["threat-identification","threat-analysis","exposure-analysis"]},
   {"name":"protection-monitoring","worktypes":["security-monitoring","protection-control-monitoring","protection-effectiveness-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('governing-engineering-decisions', 'Governing engineering decisions',
 'establish decision-making authority, criteria, processes, and controls for significant engineering decisions, and to ensure that such decisions are appropriately evaluated, authorised, recorded, and subject to review throughout the engineering lifecycle.',
 '[
   {"name":"decision-analysis","worktypes":["decision-problem-definition","option-analysis","trade-off-analysis","consequence-analysis"]},
   {"name":"decision-evaluation","worktypes":["decision-criteria-evaluation","evidence-evaluation","alternative-evaluation"]},
   {"name":"decision-authorisation","worktypes":["decision-authority-assessment","decision-approval","decision-escalation"]},
   {"name":"decision-recording","worktypes":["decision-capture","rationale-recording","decision-context-recording"]},
   {"name":"decision-traceability","worktypes":["decision-to-evidence-linking","decision-to-requirement-linking","decision-history-tracking"]},
   {"name":"decision-review","worktypes":["decision-reassessment","outcome-review","decision-validity-review"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('software-release', 'Managing software release',
 'plan, assemble, assess, authorise, and control the release of identified software configurations into their intended environments, ensuring that release prerequisites are satisfied, the released configuration is known and reproducible, and the transition is performed in a controlled manner',
 '[
   {"name":"release-planning","worktypes":["release-scope-definition","release-scheduling","release-dependency-analysis"]},
   {"name":"release-preparation","worktypes":["release-readiness-preparation","release-configuration","deployment-preparation"]},
   {"name":"release-packaging","worktypes":["build-assembly","package-creation","artifact-assembly"]},
   {"name":"release-validation","worktypes":["release-verification","release-acceptance-testing","deployment-validation"]},
   {"name":"release-deployment","worktypes":["deployment-execution","environment-promotion","deployment-verification"]},
   {"name":"release-tracking","worktypes":["release-status-tracking","deployment-tracking","release-outcome-tracking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('operating-production-systems', 'Operating production systems',
 'operate, monitor, maintain, support, and control software systems in their production environments, ensuring that services remain available, perform as required, remain secure, and respond appropriately to operational events and changing conditions',
 '[
   {"name":"production-monitoring","worktypes":["system-monitoring","service-monitoring","event-monitoring","health-monitoring"]},
   {"name":"operational-management","worktypes":["operational-scheduling","routine-operations","operational-maintenance"]},
   {"name":"performance-management","worktypes":["performance-monitoring","performance-analysis","performance-tuning"]},
   {"name":"capacity-management","worktypes":["capacity-monitoring","capacity-analysis","capacity-forecasting"]},
   {"name":"availability-management","worktypes":["availability-monitoring","availability-analysis","availability-improvement"]},
   {"name":"operational-support","worktypes":["operational-issue-handling","service-restoration","operational-assistance"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('recovering-organisational-knowledge', 'Recovering organisational knowledge',
 'locate, retrieve, reconstruct, and contextualise existing organisational knowledge from available records, artefacts, systems, and other sources so that previously established knowledge can be made accessible and usable for current engineering and organisational needs.',
 '[
   {"name":"knowledge-discovery","worktypes":["knowledge-source-discovery","historical-evidence-discovery","knowledge-retrieval"]},
   {"name":"knowledge-extraction","worktypes":["information-extraction","concept-extraction","rule-extraction","relationship-extraction"]},
   {"name":"knowledge-reconstruction","worktypes":["process-reconstruction","architecture-reconstruction","behaviour-reconstruction","decision-reconstruction"]},
   {"name":"knowledge-validation","worktypes":["evidence-validation","knowledge-consistency-checking","knowledge-accuracy-checking"]},
   {"name":"knowledge-structuring","worktypes":["knowledge-classification","knowledge-modelling","knowledge-organisation","knowledge-linking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('learning', 'Learning from operational experience',
 'systematically capture, analyse, and synthesise operational experience, incidents, problems, performance data, and other operational evidence into actionable lessons and improvements for engineering, operations, and organisational practice.',
 '[
   {"name":"experience-capture","worktypes":["incident-capture","operational-experience-capture","performance-experience-capture"]},
   {"name":"operational-experience-analysis","worktypes":["incident-analysis","failure-analysis","performance-analysis"]},
   {"name":"pattern-identification","worktypes":["pattern-discovery","recurrence-analysis","cross-incident-analysis"]},
   {"name":"lesson-extraction","worktypes":["lesson-identification","lesson-extraction","lesson-validation"]},
   {"name":"knowledge-consolidation","worktypes":["lesson-consolidation","experience-synthesis","knowledge-integration"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-practice-improvement', 'Improving engineering practice',
 'systematically evaluate engineering practices using experience, evidence, performance information, and identified deficiencies, and to develop, validate, adopt, and maintain improvements to the methods, processes, standards, and practices used to perform engineering work.',
 '[
   {"name":"practice-analysis","worktypes":["practice-observation","practice-analysis","practice-comparison"]},
   {"name":"practice-evaluation","worktypes":["practice-effectiveness-evaluation","outcome-analysis","practice-assessment"]},
   {"name":"practice-improvement","worktypes":["improvement-identification","practice-modification","practice-optimisation"]},
   {"name":"practice-experimentation","worktypes":["experiment-design","practice-experimentation","experiment-evaluation"]},
   {"name":"practice-adoption","worktypes":["practice-selection","practice-introduction","practice-application","adoption-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('adapting-business-needs', 'Adapting to changing business need',
 'detect and assess changes in business objectives, priorities, operating conditions, and organisational needs, determine their implications for engineering capabilities and systems, and realign engineering direction, resources, and priorities so that engineering remains relevant to the business.',
 '[
   {"name":"business-change-identification","worktypes":["business-change-detection","change-signal-analysis","need-identification"]},
   {"name":"change-impact-analysis","worktypes":["business-impact-analysis","engineering-impact-analysis","capability-impact-analysis"]},
   {"name":"engineering-reconciliation","worktypes":["objective-reconciliation","priority-reconciliation","requirement-reconciliation"]},
   {"name":"engineering-realignment","worktypes":["direction-realignment","resource-realignment","priority-realignment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-architectural-analysis', 'Continuous architectural analysis',
 'continuously analyse the evolving architecture of software systems against their requirements, architectural principles, constraints, dependencies, and operational evidence, identifying architectural risks, deviations, degradation, and emerging implications early enough to support corrective or evolutionary decisions',
 '[
   {"name":"architecture-monitoring","worktypes":["architecture-observation","architecture-state-tracking","architecture-change-detection"]},
   {"name":"architecture-analysis","worktypes":["structural-analysis","dependency-analysis","quality-attribute-analysis"]},
   {"name":"architecture-deviation-detection","worktypes":["architecture-comparison","drift-detection","conformance-analysis"]},
   {"name":"architecture-risk-analysis","worktypes":["architecture-risk-identification","architecture-degradation-analysis","emerging-implication-analysis"]},
   {"name":"architecture-evolution-analysis","worktypes":["architecture-change-analysis","evolution-impact-analysis","evolution-option-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('real-time-organisational-documentation', 'Real-time organisational documentation',
 'continuously capture, update, organise, and maintain organisational knowledge and engineering information as work occurs and changes are made, keeping authoritative documentation closely synchronised with the current state of the organisation, its systems, decisions, and practices.',
 '[
   {"name":"documentation-capture","worktypes":["information-capture","knowledge-capture","change-capture"]},
   {"name":"documentation-generation","worktypes":["document-generation","content-generation","record-generation"]},
   {"name":"documentation-synchronisation","worktypes":["implementation-synchronisation","change-synchronisation","state-synchronisation"]},
   {"name":"documentation-validation","worktypes":["accuracy-checking","consistency-checking","completeness-checking"]},
   {"name":"documentation-maintenance","worktypes":["content-updating","obsolete-content-detection","content-refinement"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('automatic-traceability-generation', 'Automatic traceability generation',
 'automatically identify and maintain traceable relationships among engineering artefacts, including requirements, designs, architecture, implementation, tests, defects, and releases, so that dependencies, lineage, coverage, and impact relationships can be determined throughout the engineering lifecycle.',
 '[
   {"name":"traceability-discovery","worktypes":["relationship-discovery","artefact-relationship-identification","dependency-discovery"]},
   {"name":"traceability-creation","worktypes":["trace-creation","artefact-linking","relationship-recording"]},
   {"name":"traceability-maintenance","worktypes":["trace-updating","relationship-updating","trace-synchronisation"]},
   {"name":"traceability-validation","worktypes":["trace-verification","relationship-verification","trace-consistency-checking"]},
   {"name":"traceability-analysis","worktypes":["lineage-analysis","coverage-analysis","impact-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('legacy-modernisation', 'Knowledge recovery from legacy systems (Specialisation from “Recovering organisational knowledge”)',
 NULL,
 '[
   {"name":"legacy-knowledge-discovery","worktypes":["legacy-code-analysis","legacy-documentation-analysis","historical-evidence-analysis"]},
   {"name":"legacy-behaviour-reconstruction","worktypes":["runtime-behaviour-analysis","business-rule-reconstruction","workflow-reconstruction"]},
   {"name":"legacy-architecture-reconstruction","worktypes":["architecture-extraction","component-discovery","structural-reconstruction"]},
   {"name":"legacy-dependency-reconstruction","worktypes":["dependency-discovery","interface-discovery","data-dependency-analysis"]},
   {"name":"legacy-knowledge-validation","worktypes":["recovered-knowledge-validation","behaviour-validation","evidence-validation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-compliance-verification', 'Continuous compliance verification',
 NULL,
 '[
   {"name":"compliance-assessment","worktypes":["obligation-identification","applicability-assessment","compliance-assessment"]},
   {"name":"compliance-evidence-analysis","worktypes":["evidence-collection","evidence-extraction","evidence-evaluation"]},
   {"name":"compliance-gap-detection","worktypes":["gap-identification","nonconformance-detection","coverage-analysis"]},
   {"name":"compliance-verification","worktypes":["requirement-checking","control-verification","evidence-verification"]},
   {"name":"compliance-monitoring","worktypes":["continuous-checking","compliance-state-monitoring","change-monitoring"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-decision-explainability', 'Engineering decision explainability',
 NULL,
 '[
   {"name":"decision-evidence-linking","worktypes":["evidence-discovery","evidence-linking","supporting-evidence-identification"]},
   {"name":"decision-rationale-capture","worktypes":["rationale-extraction","rationale-recording","assumption-recording"]},
   {"name":"decision-context-reconstruction","worktypes":["context-reconstruction","constraint-reconstruction","objective-reconstruction"]},
   {"name":"decision-traceability","worktypes":["decision-to-evidence-linking","decision-to-requirement-linking","decision-history-tracking"]},
   {"name":"decision-outcome-analysis","worktypes":["outcome-tracking","outcome-comparison","decision-effectiveness-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('evidence-based-organisational-reasoning', 'Evidence-based organisational reasoning',
 NULL,
 '[
   {"name":"evidence-discovery","worktypes":["evidence-search","evidence-retrieval","evidence-identification"]},
   {"name":"evidence-synthesis","worktypes":["evidence-aggregation","evidence-consolidation","evidence-synthesis"]},
   {"name":"knowledge-correlation","worktypes":["cross-source-correlation","relationship-discovery","pattern-correlation"]},
   {"name":"evidence-evaluation","worktypes":["evidence-quality-assessment","evidence-relevance-assessment","evidence-consistency-assessment"]},
   {"name":"organisational-reasoning","worktypes":["contextual-reasoning","constraint-reasoning","causal-reasoning","comparative-reasoning"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-requirements-validation', 'Continuous requirements validation',
 'continuously evaluate requirements against current business and stakeholder needs, system context, engineering constraints, and evolving implementation evidence, detecting invalid, obsolete, conflicting, incomplete, or otherwise non-conforming requirements early enough to support corrective action.',
 '[
   {"name":"continuous-requirement-validation","worktypes":["requirement-monitoring","requirement-revalidation","requirement-consistency-checking"]},
   {"name":"requirement-drift-detection","worktypes":["requirement-change-detection","intent-drift-detection","baseline-comparison"]},
   {"name":"requirement-completeness-monitoring","worktypes":["completeness-monitoring","missing-requirement-detection","boundary-monitoring"]},
   {"name":"requirement-conflict-detection","worktypes":["conflict-monitoring","dependency-monitoring","contradiction-detection"]},
   {"name":"requirement-traceability-monitoring","worktypes":["trace-monitoring","trace-gap-detection","trace-consistency-monitoring"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('predictive-engineering-risk-assessment', 'Predictive engineering risk assessment',
 'analyse current and historical engineering information to identify emerging risk patterns, forecast the likelihood and potential impact of future engineering risks, and provide early risk assessments that support preventive action and engineering decision-making.',
 '[
   {"name":"risk-identification","worktypes":["risk-signal-detection","risk-discovery","risk-classification"]},
   {"name":"risk-prediction","worktypes":["risk-forecasting","risk-likelihood-prediction","risk-trend-prediction"]},
   {"name":"risk-correlation","worktypes":["risk-relationship-analysis","historical-correlation","cross-system-risk-correlation"]},
   {"name":"risk-impact-analysis","worktypes":["impact-assessment","consequence-analysis","exposure-analysis"]},
   {"name":"risk-trend-analysis","worktypes":["risk-trend-monitoring","emerging-risk-detection","risk-pattern-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-quality-assurance', 'Continuous quality assurance',
 'continuously monitor and assess the quality of engineering processes, artefacts, and outcomes against defined requirements, standards, policies, and quality criteria, providing ongoing evidence of quality status and initiating corrective action when deviations are detected.',
 '[
   {"name":"quality-monitoring","worktypes":["quality-signal-monitoring","quality-state-monitoring","quality-trend-monitoring"]},
   {"name":"quality-assessment","worktypes":["quality-assessment","quality-attribute-assessment","quality-baseline-comparison"]},
   {"name":"quality-verification","worktypes":["quality-checking","quality-evidence-verification","quality-result-verification"]},
   {"name":"quality-deviation-detection","worktypes":["deviation-detection","regression-detection","quality-anomaly-detection"]},
   {"name":"quality-improvement-identification","worktypes":["quality-gap-detection","improvement-identification","corrective-action-identification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('organisational-memory-synthesis', 'Organisational memory synthesis across multiple projects',
 'aggregate, relate, and synthesise knowledge from multiple projects and their engineering artefacts, experiences, decisions, and outcomes to identify reusable organisational knowledge, cross-project patterns, dependencies, lessons, and insights.',
 '[
   {"name":"knowledge-aggregation","worktypes":["project-knowledge-collection","artefact-collection","experience-collection"]},
   {"name":"knowledge-correlation","worktypes":["cross-project-correlation","cross-domain-correlation","relationship-discovery"]},
   {"name":"cross-project-synthesis","worktypes":["project-comparison","commonality-identification","difference-analysis"]},
   {"name":"pattern-extraction","worktypes":["pattern-discovery","recurrence-detection","cross-project-pattern-analysis"]},
   {"name":"knowledge-consolidation","worktypes":["knowledge-deduplication","knowledge-integration","knowledge-consolidation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-organisational-learning', 'Continuous organisational learning',
 'continuously capture and synthesise organisational experience and knowledge, evaluate its implications, incorporate validated learning into organisational knowledge, practices, decisions, and capabilities, and assess whether the resulting changes improve organisational outcomes.',
 '[
   {"name":"experience-capture","worktypes":["experience-collection","outcome-collection","event-collection"]},
   {"name":"knowledge-extraction","worktypes":["lesson-extraction","pattern-extraction","knowledge-extraction"]},
   {"name":"learning-analysis","worktypes":["pattern-discovery","learning-analysis","outcome-analysis"]},
   {"name":"lesson-synthesis","worktypes":["lesson-consolidation","lesson-correlation","lesson-generalisation"]},
   {"name":"learning-application","worktypes":["practice-adaptation","knowledge-application","capability-improvement"]},
   {"name":"learning-outcome-assessment","worktypes":["outcome-measurement","improvement-assessment","learning-effectiveness-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('autonomous-capability-optimisation', 'Autonomous capability optimisation',
 'continuously assess organisational capability performance and autonomously identify, evaluate, prioritise, and implement changes to capability structure, capacity, processes, resources, and supporting mechanisms in order to improve organisational outcomes within defined objectives, constraints, and governance controls.',
 '[
   {"name":"capability-assessment","worktypes":["capability-measurement","capability-state-assessment","capability-gap-assessment"]},
   {"name":"capability-analysis","worktypes":["capability-structure-analysis","capability-dependency-analysis","capability-performance-analysis"]},
   {"name":"performance-analysis","worktypes":["performance-measurement","performance-trend-analysis","bottleneck-analysis"]},
   {"name":"improvement-identification","worktypes":["improvement-opportunity-discovery","gap-analysis","improvement-identification"]},
   {"name":"capability-optimisation","worktypes":["optimisation-analysis","change-simulation","optimisation-implementation","outcome-evaluation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('enterprise-wide-engineering-impact-analysis', 'Enterprise-wide engineering impact analysis',
 'analyse the relationships and dependencies across the organisation''s engineering systems, capabilities, projects, assets, and processes to determine the direct and indirect effects of proposed changes or conditions, including affected stakeholders, requirements, architecture, resources, risks, and downstream activities.',
 '[
   {"name":"impact-discovery","worktypes":["impact-signal-discovery","affected-asset-discovery","change-scope-discovery"]},
   {"name":"dependency-analysis","worktypes":["dependency-discovery","dependency-mapping","dependency-traversal"]},
   {"name":"change-impact-analysis","worktypes":["change-impact-assessment","requirement-impact","architecture-impact","implementation-impact"]},
   {"name":"cross-system-impact-analysis","worktypes":["cross-system-dependency-analysis","cross-system-impact-assessment","portfolio-impact-analysis"]},
   {"name":"impact-propagation-analysis","worktypes":["impact-propagation-mapping","downstream-impact-analysis","transitive-impact-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-stakeholder-intent-reconciliation', 'Continuous stakeholder-intent reconciliation',
 'continuously capture and analyse evolving stakeholder intentions, compare them with established requirements and with one another, identify conflicts, ambiguities, and divergences, and facilitate their resolution so that the engineering baseline remains aligned with the current and collectively agreed stakeholder intent.',
 '[
   {"name":"stakeholder-signal-collection","worktypes":["meeting-analysis","ticket-analysis","support-conversation-analysis","communication-analysis"]},
   {"name":"intent-extraction","worktypes":["intent-identification","need-extraction","expectation-extraction","concern-extraction"]},
   {"name":"intent-reconciliation","worktypes":["conflict-reconciliation","intent-comparison","intent-consolidation"]},
   {"name":"requirement-synthesis","worktypes":["signal-to-requirement-conversion","requirement-consolidation","requirement-refinement"]},
   {"name":"requirement-baseline-maintenance","worktypes":["baseline-updating","requirement-change-detection","intent-to-baseline-reconciliation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-domain-model-drift-detection', 'Continuous domain-model drift detection',
 'continuously monitor changes in the business domain and compare them with the established domain model, identifying changes, inconsistencies, omissions, or obsolete representations that cause the model to diverge from the domain it represents.',
 '[
   {"name":"domain-behaviour-monitoring","worktypes":["business-behaviour-observation","process-behaviour-monitoring","transaction-behaviour-monitoring"]},
   {"name":"domain-model-comparison","worktypes":["model-to-behaviour-comparison","model-version-comparison","structural-comparison"]},
   {"name":"domain-drift-detection","worktypes":["concept-drift-detection","relationship-drift-detection","behaviour-drift-detection"]},
   {"name":"model-reconciliation","worktypes":["model-correction","model-alignment","behaviour-to-model-reconciliation"]},
   {"name":"domain-model-validation","worktypes":["model-validation","behaviour-validation","domain-consistency-checking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('predictive-architectural-obsolescence-detection', 'Predictive architectural obsolescence detection (Specialisation from “Predictive engineering risk assessment”)',
 'continuously analyse architectural technologies, dependencies, patterns, constraints, support lifecycles, and external technology trends to predict emerging architectural obsolescence and provide sufficient early warning for architectural remediation, replacement, or evolution.',
 '[
   {"name":"architecture-trend-analysis","worktypes":["architecture-trend-monitoring","technology-trend-analysis","usage-trend-analysis"]},
   {"name":"technology-lifecycle-analysis","worktypes":["technology-lifecycle-analysis","support-lifecycle-analysis","dependency-lifecycle-analysis"]},
   {"name":"obsolescence-detection","worktypes":["obsolescence-signal-detection","technology-obsolescence-detection","pattern-obsolescence-detection"]},
   {"name":"obsolescence-prediction","worktypes":["obsolescence-forecasting","lifecycle-prediction","obsolescence-risk-prediction"]},
   {"name":"architecture-evolution-analysis","worktypes":["remediation-analysis","replacement-analysis","evolution-option-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('cross-system-structural-pattern-recognition', 'Cross-system structural pattern recognition',
 'analyse and compare the structures of multiple software systems and identify recurring, significant, or anomalous structural patterns across their architectures, components, interfaces, dependencies, and other engineering relationships.',
 '[
   {"name":"structural-pattern-discovery","worktypes":["architecture-pattern-discovery","structural-pattern-discovery","dependency-pattern-discovery"]},
   {"name":"cross-system-comparison","worktypes":["architecture-comparison","structural-comparison","dependency-comparison"]},
   {"name":"pattern-analysis","worktypes":["pattern-analysis","pattern-classification","pattern-correlation"]},
   {"name":"structural-weakness-detection","worktypes":["structural-weakness-detection","recurring-weakness-detection","structural-anomaly-detection"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('cross-codebase-pattern-propagation', 'Cross-codebase pattern propagation',
 'identify engineering patterns or improvements that are applicable across multiple codebases, determine their affected locations and contextual variations, and propagate the approved pattern or change across those codebases while preserving correctness, consistency, and local compatibility.',
 '[
   {"name":"code-pattern-discovery","worktypes":["code-pattern-discovery","implementation-pattern-discovery","fix-pattern-discovery"]},
   {"name":"codebase-comparison","worktypes":["code-comparison","structural-comparison","dependency-comparison"]},
   {"name":"applicability-analysis","worktypes":["pattern-applicability-analysis","affected-code-identification","contextual-variation-analysis"]},
   {"name":"change-propagation","worktypes":["equivalent-change-identification","change-propagation-analysis","change-application"]},
   {"name":"propagation-verification","worktypes":["change-verification","consistency-verification","compatibility-verification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-configuration-drift-detection', 'Continuous configuration drift detection',
 'continuously monitor and compare actual software, infrastructure, environment, and configuration states against authorised configuration baselines and policies, detecting, assessing, and reporting deviations so that configuration integrity can be maintained.',
 '[
   {"name":"configuration-monitoring","worktypes":["configuration-collection","configuration-state-monitoring","environment-monitoring"]},
   {"name":"configuration-comparison","worktypes":["desired-state-comparison","environment-comparison","version-comparison"]},
   {"name":"drift-detection","worktypes":["configuration-drift-detection","environment-drift-detection","dependency-drift-detection"]},
   {"name":"drift-analysis","worktypes":["drift-classification","drift-impact-analysis","drift-cause-analysis"]},
   {"name":"configuration-reconciliation","worktypes":["configuration-correction","configuration-restoration","state-reconciliation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('predictive-test-coverage-gap-detection', 'Predictive test-coverage gap detection (Specialisation from “Predictive engineering risk assessment”)',
 'analyse software structure, requirements, changes, dependencies, existing test assets, and historical verification evidence to predict areas where test coverage is likely to be insufficient, identify the nature and significance of the anticipated gaps, and provide early direction for additional verification.',
 '[
   {"name":"coverage-analysis","worktypes":["coverage-measurement","coverage-analysis","coverage-trend-analysis"]},
   {"name":"defect-pattern-analysis","worktypes":["historical-defect-analysis","defect-classification","defect-coverage-correlation"]},
   {"name":"coverage-gap-prediction","worktypes":["gap-prediction","defect-exposure-prediction","coverage-risk-prediction"]},
   {"name":"test-gap-identification","worktypes":["missing-test-identification","weak-coverage-identification","uncovered-scenario-identification"]},
   {"name":"test-recommendation","worktypes":["test-case-recommendation","test-scenario-recommendation","coverage-improvement-recommendation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-vulnerability-posture-assessment', 'Continuous vulnerability posture assessment',
 'continuously identify, assess, correlate, and monitor vulnerabilities across organisational technology assets and their environments, determine their significance and exposure, and maintain an up-to-date view of the organisation''s vulnerability posture to support prioritised remediation and risk decisions.',
 '[
   {"name":"vulnerability-discovery","worktypes":["vulnerability-identification","vulnerability-scanning","vulnerability-correlation"]},
   {"name":"exposure-analysis","worktypes":["exposure-discovery","attack-surface-analysis","exposure-assessment"]},
   {"name":"vulnerability-assessment","worktypes":["severity-assessment","exploitability-assessment","vulnerability-impact-assessment"]},
   {"name":"vulnerability-monitoring","worktypes":["vulnerability-monitoring","vulnerability-state-tracking","remediation-monitoring"]},
   {"name":"security-posture-assessment","worktypes":["posture-measurement","exposure-measurement","security-state-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('predictive-threat-pattern-anticipation', 'Predictive threat-pattern anticipation',
 'continuously analyse threat intelligence, historical security events, emerging attack techniques, vulnerabilities, system characteristics, and environmental signals to identify and forecast threat patterns that are likely to affect organisational assets, providing early warning to support preventive security action.',
 '[
   {"name":"threat-pattern-discovery","worktypes":["threat-intelligence-analysis","emerging-pattern-discovery","attack-pattern-analysis"]},
   {"name":"threat-correlation","worktypes":["threat-to-asset-correlation","threat-to-vulnerability-correlation","cross-system-threat-correlation"]},
   {"name":"threat-assessment","worktypes":["threat-evaluation","threat-relevance-assessment","threat-impact-assessment"]},
   {"name":"threat-prediction","worktypes":["threat-pattern-prediction","threat-forecasting","exposure-prediction"]},
   {"name":"preventive-analysis","worktypes":["pre-emptive-exposure-analysis","preventive-control-analysis","preventive-action-identification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-policy-conflict-detection', 'Continuous policy-conflict detection',
 'continuously analyse applicable policies, rules, standards, and controls and their relationships to identify conflicting, contradictory, or mutually incompatible requirements, determine the affected engineering activities or decisions, and provide timely evidence for policy resolution.',
 '[
   {"name":"policy-analysis","worktypes":["policy-extraction","policy-interpretation","policy-comparison"]},
   {"name":"rule-comparison","worktypes":["rule-extraction","rule-comparison","rule-relationship-analysis"]},
   {"name":"conflict-detection","worktypes":["policy-conflict-detection","rule-conflict-detection","contradiction-detection"]},
   {"name":"contradiction-analysis","worktypes":["contradiction-analysis","conflict-context-analysis","conflict-impact-analysis"]},
   {"name":"conflict-reconciliation-analysis","worktypes":["conflict-resolution-analysis","alternative-interpretation-analysis","reconciliation-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-release-risk-management', 'Continuous release-risk forecasting',
 'continuously analyse release contents, changes, dependencies, verification evidence, defects, configuration, operational conditions, and historical release outcomes to forecast the likelihood and potential impact of release-related problems and provide early risk information for release decisions.',
 '[
   {"name":"release-risk-analysis","worktypes":["release-risk-identification","release-risk-assessment","release-risk-correlation"]},
   {"name":"release-history-analysis","worktypes":["historical-release-analysis","release-outcome-analysis","failure-pattern-analysis"]},
   {"name":"release-risk-prediction","worktypes":["release-risk-prediction","failure-prediction","outcome-prediction"]},
   {"name":"release-risk-monitoring","worktypes":["risk-trend-monitoring","emerging-risk-detection","risk-state-tracking"]},
   {"name":"release-impact-analysis","worktypes":["release-change-impact","release-dependency-impact","release-scope-impact"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('predictive-incident-anticipation', 'Predictive incident anticipation',
 'continuously analyse operational conditions, system behaviour, telemetry, changes, dependencies, historical incidents, and other relevant signals to identify patterns indicating that an operational incident is likely to occur, assess its potential impact, and provide early warning to support preventive or mitigating action.',
 '[
   {"name":"telemetry-analysis","worktypes":["telemetry-collection","telemetry-analysis","signal-analysis"]},
   {"name":"anomaly-detection","worktypes":["anomaly-identification","behavioural-deviation-detection","threshold-analysis"]},
   {"name":"event-correlation","worktypes":["event-correlation","signal-correlation","temporal-correlation"]},
   {"name":"precursor-detection","worktypes":["precursor-identification","leading-indicator-detection","failure-signal-detection"]},
   {"name":"incident-prediction","worktypes":["incident-pattern-prediction","failure-prediction","incident-forecasting"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('autonomous-root-cause-synthesis', 'Autonomous root-cause synthesis',
 'autonomously correlate and analyse evidence from incidents, system behaviour, telemetry, changes, configurations, dependencies, defects, and engineering records to identify, evaluate, and synthesise probable root causes and their causal relationships, providing an explainable basis for corrective action.',
 '[
   {"name":"root-cause-discovery","worktypes":["cause-identification","failure-chain-discovery","contributing-factor-identification"]},
   {"name":"causal-analysis","worktypes":["causal-relationship-analysis","dependency-analysis","failure-propagation-analysis"]},
   {"name":"evidence-correlation","worktypes":["code-evidence-correlation","infrastructure-evidence-correlation","configuration-evidence-correlation","decision-evidence-correlation"]},
   {"name":"incident-reconstruction","worktypes":["timeline-reconstruction","state-reconstruction","change-reconstruction"]},
   {"name":"root-cause-synthesis","worktypes":["cause-chain-synthesis","evidence-synthesis","root-cause-explanation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('autonomous-standard-synthesis', 'Autonomous standard synthesis (Specialisation from “Improving engineering practice”)',
 'drafting or refining engineering standards directly from continuously accumulating evidence of what works, rather than through periodic committee review',
 '[
   {"name":"practice-analysis","worktypes":["practice-observation","practice-comparison","practice-effectiveness-analysis"]},
   {"name":"evidence-synthesis","worktypes":["evidence-collection","evidence-correlation","evidence-synthesis"]},
   {"name":"standard-discovery","worktypes":["pattern-discovery","common-practice-discovery","recurring-practice-identification"]},
   {"name":"standard-formulation","worktypes":["standard-drafting","rule-formulation","practice-specification"]},
   {"name":"standard-refinement","worktypes":["standard-evaluation","standard-revision","standard-optimisation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('cross-organisational-capability-benchmarking', 'Cross-organisational capability benchmarking',
 'systematically compare organisational capabilities and their performance against relevant external organisations or established benchmarks, using comparable measures and contextual information to determine relative capability position and identify opportunities for improvement.',
 '[
   {"name":"capability-measurement","worktypes":["capability-measurement","performance-measurement","outcome-measurement"]},
   {"name":"capability-comparison","worktypes":["peer-comparison","capability-instance-comparison","performance-comparison"]},
   {"name":"maturity-assessment","worktypes":["maturity-measurement","maturity-gap-analysis","capability-state-assessment"]},
   {"name":"benchmark-analysis","worktypes":["benchmark-construction","benchmark-comparison","variance-analysis"]},
   {"name":"improvement-identification","worktypes":["capability-gap-identification","improvement-opportunity-discovery","improvement-analysis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('continuous-objective-alignment-monitoring', 'Continuous objective-alignment monitoring',
 'continuously monitor and evaluate the alignment of engineering activities, decisions, systems, investments, and outcomes with established business and organisational objectives, detecting divergence, loss of relevance, or conflicting priorities early enough to support corrective action.',
 '[
   {"name":"objective-monitoring","worktypes":["objective-state-monitoring","objective-change-detection","objective-tracking"]},
   {"name":"work-alignment-analysis","worktypes":["work-to-objective-mapping","alignment-analysis","contribution-analysis"]},
   {"name":"objective-drift-detection","worktypes":["alignment-drift-detection","objective-deviation-detection","context-drift-detection"]},
   {"name":"business-context-analysis","worktypes":["business-context-monitoring","business-change-analysis","environmental-change-analysis"]},
   {"name":"alignment-assessment","worktypes":["alignment-evaluation","contribution-evaluation","objective-reconciliation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('business-analysis-approach', 'Planning the business analysis approach',
 'determine and establish the methods, activities, techniques, roles, responsibilities, deliverables, timing, and governance by which business analysis will be conducted for an initiative, taking into account its context, objectives, complexity, constraints, and stakeholder environment.',
 '[
   {"name":"analysis-approach-definition","worktypes":["approach-definition","method-selection","technique-selection"]},
   {"name":"analysis-activity-planning","worktypes":["activity-identification","activity-sequencing","activity-scheduling"]},
   {"name":"analysis-resource-planning","worktypes":["role-identification","responsibility-assignment","resource-planning"]},
   {"name":"analysis-deliverable-planning","worktypes":["deliverable-identification","deliverable-definition","deliverable-scheduling"]},
   {"name":"analysis-context-assessment","worktypes":["context-assessment","constraint-assessment","stakeholder-environment-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('requirements-prioritising', 'Prioritising engineering requirements',
 'evaluate and establish the relative priority of engineering requirements using defined business, stakeholder, technical, risk, regulatory, dependency, cost, and other relevant criteria, so that requirements can be appropriately sequenced and resources directed toward the most important outcomes.',
 '[
   {"name":"requirement-prioritisation","worktypes":["priority-assessment","priority-assignment","priority-comparison"]},
   {"name":"requirement-value-analysis","worktypes":["business-value-analysis","stakeholder-value-analysis","outcome-value-analysis"]},
   {"name":"requirement-constraint-analysis","worktypes":["cost-analysis","risk-analysis","dependency-analysis","regulatory-constraint-analysis"]},
   {"name":"requirement-sequencing","worktypes":["requirement-sequencing","implementation-ordering","dependency-based-ordering"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('solution-options', 'Recommending solution options by value',
 'identify and evaluate alternative solution options against business objectives, stakeholder needs, expected benefits, costs, risks, constraints, and other relevant criteria, and to recommend the option or combination of options that provides the most appropriate overall value.',
 '[
   {"name":"solution-option-discovery","worktypes":["alternative-identification","solution-search","option-generation"]},
   {"name":"solution-option-analysis","worktypes":["benefit-analysis","cost-analysis","risk-analysis","constraint-analysis"]},
   {"name":"solution-option-comparison","worktypes":["option-comparison","trade-off-analysis","value-comparison"]},
   {"name":"solution-value-assessment","worktypes":["expected-value-assessment","outcome-assessment","value-risk-analysis"]},
   {"name":"solution-recommendation","worktypes":["option-recommendation","recommendation-rationale","recommendation-evidence"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('integrating-constructed-components', 'Integrating constructed components',
 'combine independently constructed software components and assemblies into progressively larger, coherent subsystems and systems, ensuring that their interfaces, dependencies, interactions, and configurations conform to the defined integration specifications.',
 '[
   {"name":"component-integration","worktypes":["component-assembly","component-integration","subsystem-integration"]},
   {"name":"interface-integration","worktypes":["interface-connection","interface-compatibility-checking","interface-integration"]},
   {"name":"integration-verification","worktypes":["integration-testing","integration-verification","integration-result-analysis"]},
   {"name":"integration-conflict-resolution","worktypes":["dependency-conflict-resolution","interface-conflict-resolution","configuration-conflict-resolution"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-assets-reuse', 'Reusing existing engineering assets',
 'identify potentially reusable engineering assets, assess their suitability, quality, security, compatibility, provenance, licensing, and lifecycle status, and select and incorporate appropriate assets into engineering solutions where reuse provides an acceptable alternative to new construction.',
 '[
   {"name":"asset-discovery","worktypes":["reusable-asset-search","asset-identification","asset-retrieval"]},
   {"name":"asset-suitability-assessment","worktypes":["quality-assessment","security-assessment","compatibility-assessment","lifecycle-assessment"]},
   {"name":"asset-provenance-assessment","worktypes":["provenance-checking","ownership-checking","licensing-assessment"]},
   {"name":"asset-selection","worktypes":["asset-comparison","asset-selection","reuse-decision-support"]},
   {"name":"asset-incorporation","worktypes":["asset-integration","asset-adaptation","reuse-verification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-work-review', 'Reviewing engineering work',
 'independently examine engineering artefacts, activities, and decisions against applicable requirements, standards, policies, and review criteria, identify and communicate deficiencies or deviations, and determine whether the reviewed work is acceptable for progression or requires correction and re-review.',
 '[
   {"name":"engineering-work-examination","worktypes":["artefact-examination","activity-examination","decision-examination"]},
   {"name":"conformance-assessment","worktypes":["requirement-conformance-checking","standard-conformance-checking","criteria-checking"]},
   {"name":"deficiency-identification","worktypes":["deficiency-detection","deviation-detection","issue-identification"]},
   {"name":"review-finding-analysis","worktypes":["finding-analysis","finding-classification","finding-communication"]},
   {"name":"re-review","worktypes":["correction-review","finding-closure-review","re-review"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('corrective-actions', 'Eliminating recurring operational problems',
 'systematically identify recurring operational problems, analyse their underlying causes, implement and track permanent corrective actions, and verify that the causes have been eliminated or adequately controlled so that the problems do not recur.',
 '[
   {"name":"recurring-problem-identification","worktypes":["problem-recurrence-detection","problem-classification","problem-pattern-identification"]},
   {"name":"cause-analysis","worktypes":["root-cause-analysis","contributing-cause-analysis","recurrence-cause-analysis"]},
   {"name":"corrective-action-definition","worktypes":["corrective-action-identification","corrective-action-design","action-planning"]},
   {"name":"corrective-action-implementation","worktypes":["action-implementation","action-tracking","action-verification"]},
   {"name":"recurrence-verification","worktypes":["recurrence-monitoring","effectiveness-verification","problem-closure-verification"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('defect-management', 'Managing defects to resolution',
 'systematically capture, classify, assess, prioritise, assign, track, resolve, and close software defects, ensuring that resolutions are verified and that defects that cannot yet be resolved are explicitly deferred, owned, and controlled.',
 '[
   {"name":"defect-capture","worktypes":["defect-recording","defect-evidence-capture","defect-reproduction-information-capture"]},
   {"name":"defect-analysis","worktypes":["defect-classification","defect-diagnosis","defect-impact-assessment"]},
   {"name":"defect-prioritisation","worktypes":["severity-assessment","priority-assignment","resolution-ordering"]},
   {"name":"defect-resolution","worktypes":["defect-correction","corrective-change","resolution-implementation"]},
   {"name":"defect-verification","worktypes":["correction-verification","regression-verification","resolution-validation"]},
   {"name":"defect-closure","worktypes":["closure-assessment","defect-closure","deferred-defect-tracking"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('vendor-supplier-management', 'Managing external vendors and suppliers',
 'establish and manage relationships with external vendors, suppliers, and service providers, including their selection, contractual arrangements, performance, risk, compliance, and ongoing relationship management, so that externally provided products and services meet organisational requirements.',
 '[
   {"name":"supplier-selection","worktypes":["supplier-identification","supplier-evaluation","supplier-selection"]},
   {"name":"supplier-arrangement-management","worktypes":["contract-definition","service-definition","deliverable-definition"]},
   {"name":"supplier-performance-management","worktypes":["performance-monitoring","service-assessment","deliverable-assessment"]},
   {"name":"supplier-risk-management","worktypes":["supplier-risk-identification","supplier-risk-assessment","supplier-risk-monitoring"]},
   {"name":"supplier-compliance-management","worktypes":["compliance-assessment","requirement-compliance-checking","evidence-review"]},
   {"name":"supplier-relationship-management","worktypes":["supplier-communication","issue-resolution","relationship-review"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('capability-evolution', 'Stewarding capability evolution and maturity',
 'assess, govern, and guide the evolution and maturity of organisational capabilities by establishing capability objectives, evaluating current capability performance and maturity, identifying gaps and improvement opportunities, defining evolutionary priorities, and monitoring progress toward the desired capability state.',
 '[
   {"name":"capability-assessment","worktypes":["capability-state-assessment","capability-performance-assessment","maturity-assessment"]},
   {"name":"capability-gap-analysis","worktypes":["capability-gap-identification","maturity-gap-analysis","performance-gap-analysis"]},
   {"name":"capability-evolution-planning","worktypes":["evolution-objective-definition","evolution-planning","evolution-prioritisation"]},
   {"name":"capability-improvement","worktypes":["improvement-identification","capability-enhancement","capability-expansion"]},
   {"name":"capability-progress-assessment","worktypes":["progress-monitoring","maturity-progress-assessment","outcome-assessment"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('change-management', 'Managing engineering change',
 'control proposed changes to engineering artefacts and engineering baselines by assessing their justification, impact, dependencies, risks, and consequences, obtaining appropriate authorisation, coordinating their implementation, and maintaining traceable records of the resulting state.',
 '[
   {"name":"change-identification","worktypes":["change-proposal-capture","change-request-recording","change-scope-definition"]},
   {"name":"change-impact-analysis","worktypes":["requirement-impact-analysis","architecture-impact-analysis","implementation-impact-analysis","dependency-impact-analysis"]},
   {"name":"change-assessment","worktypes":["change-justification-assessment","change-risk-assessment","change-consequence-analysis"]},
   {"name":"change-coordination","worktypes":["change-planning","change-scheduling","change-dependency-coordination"]},
   {"name":"change-implementation","worktypes":["change-implementation","change-integration","change-verification"]},
   {"name":"change-traceability","worktypes":["change-recording","change-history-tracking","resulting-state-recording"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('training-and-evaluating-models', 'Training and evaluating models',
 'prepare training/evaluation data, train or fine-tune a model against a defined objective, and evaluate its quality, bias, and performance against acceptance criteria before it is fit to serve — a materially different discipline from constructing general-purpose software components.',
 '[
   {"name":"training-data-preparation","worktypes":["training-data-collection","data-preparation","data-quality-assessment","evaluation-data-preparation"]},
   {"name":"model-training","worktypes":["model-training","model-fine-tuning","training-configuration"]},
   {"name":"model-evaluation","worktypes":["model-performance-evaluation","acceptance-evaluation","comparative-evaluation"]},
   {"name":"model-quality-assessment","worktypes":["quality-assessment","bias-assessment","error-analysis"]},
   {"name":"model-readiness-assessment","worktypes":["acceptance-criteria-assessment","deployment-readiness-assessment","model-validation"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-embedded-firmware', 'Engineering embedded firmware',
 'build and verify firmware against a hardware-constrained target — memory, timing, interrupt, and power budgets a general-purpose runtime does not have — confirming it behaves correctly on the real or simulated hardware it will ship on.',
 '[
   {"name":"firmware-implementation","worktypes":["firmware-coding","hardware-interface-implementation","embedded-feature-implementation"]},
   {"name":"hardware-constrained-design","worktypes":["memory-constraint-handling","timing-constraint-handling","power-constraint-handling"]},
   {"name":"firmware-integration","worktypes":["hardware-integration","peripheral-integration","firmware-hardware-integration"]},
   {"name":"firmware-verification","worktypes":["firmware-testing","hardware-in-the-loop-testing","timing-verification","power-verification"]},
   {"name":"firmware-debugging","worktypes":["runtime-debugging","hardware-debugging","fault-diagnosis"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111'),

('engineering-data-pipelines', 'Engineering data pipelines',
 'design, build, and operate the ingestion, transformation, and quality-assurance pipelines that move and shape data reliably — a distinct discipline from constructing general application components.',
 '[
   {"name":"data-ingestion","worktypes":["source-connection","data-extraction","data-ingestion"]},
   {"name":"data-transformation","worktypes":["data-transformation","data-mapping","data-normalisation"]},
   {"name":"pipeline-construction","worktypes":["pipeline-implementation","pipeline-orchestration","pipeline-integration"]},
   {"name":"data-quality","worktypes":["data-quality-checking","data-validation","data-anomaly-detection"]},
   {"name":"pipeline-operation","worktypes":["pipeline-monitoring","pipeline-failure-handling","pipeline-maintenance"]}
 ]'::jsonb,
 '11111111-1111-1111-1111-111111111111')

ON CONFLICT (code, tenant_id) DO NOTHING;