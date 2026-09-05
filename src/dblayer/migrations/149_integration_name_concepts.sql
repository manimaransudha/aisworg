-- Owner (2026-09-01): "added new integration-* packs. Both of these sets
-- have to be included to the seed data in cleanSlate." integration-name had
-- zero rows (confirmed directly — CR-079's own migration 132 comment
-- predicted this: "no integration-name rows yet — no real Integration-
-- category Pack exists"). All 20 real now, so seeding Track B (CR-079 —
-- a Pack's own top-level code, validated against
-- ${category.toLowerCase()}-name) for real this time.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('integration-name', 'integration-aws', 'Amazon Web Services (AWS) Cloud Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-azure-devops', 'Azure DevOps Services Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-azure', 'Microsoft Azure Cloud Platform Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-bitbucket', 'Atlassian Bitbucket Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-confluence', 'Atlassian Confluence Knowledge Base Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-datadog', 'Datadog Observability Platform Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-gcp', 'Google Cloud Platform (GCP) Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-github', 'GitHub Developer Platform Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-gitlab', 'GitLab DevOps Platform Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-jenkins', 'Jenkins Automation Server Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-jira', 'Atlassian Jira Software Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-kubernetes', 'Kubernetes Orchestration & Helm Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-pagerduty', 'PagerDuty Incident Response Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-prometheus-grafana', 'Prometheus & Grafana Observability Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-sentry', 'Sentry Application Monitoring Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-servicenow', 'ServiceNow Enterprise ITSM Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-slack', 'Slack Collaboration & ChatOps Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-snyk', 'Snyk Security & Vulnerability Scanning Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-sonarqube', 'SonarQube & SonarCloud Integration', '11111111-1111-1111-1111-111111111111'),
  ('integration-name', 'integration-terraform', 'HashiCorp Terraform IaC Platform Integration', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
