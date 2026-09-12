-- CR-099 — Pack-contributed Competencies. A Pack declares which competency
-- (dimension = category:pack code, value = that dimension's own child
-- concept_type code) it represents — closing the gap where a Profile's
-- Technology/Domain Pack selections had no real, declared relationship to
-- participants_master.competency (CR-098). Declaration only (packs.contributions
-- JSONB) — same precedent as Obligation Definitions/Engineering Capital, no
-- new table, no seedContributions materialisation step.
--
-- Grammar: contributionCompetencies[] on Pack, one {dimension, value} pair
-- per entry. `dimension` is a static referential-select sourced from
-- category:pack (already seeded, migration 049). `value` is meant to be a
-- dependent dropdown driven by `dimension` — CR-079's x-referential-source-by
-- mechanism only resolves a TOP-LEVEL driver field today (Pack's own code
-- driven by Pack's own category); dimension/value both live inside the same
-- referential-list ROW, which formGenerator.ts's buildItemFields/buildRow
-- does not support driving off a sibling item field yet (Ch.12-adjacent
-- finding, CR-099 §6, corrected twice in the CR itself) — so `value` is a
-- plain Ontology-backed referential-select for now (`x-referential`:
-- "technology" as a placeholder default is wrong for a Domain entry; kept as
-- a plain string with x-help pointing the author at the right child concept
-- type by name, validated server-side by validatePackSeed regardless of what
-- the form shows). The dependent-dropdown UI is real follow-up work, not
-- done here — this migration only needs the data to validate correctly,
-- which it does.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionCompetencies}',
                  '{
                    "type": "array",
                    "x-help": "CR-099 — which competency (Ontology category:pack dimension + the value within that dimension) this Pack represents. Required when the Pack category is Technology or Domain.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["dimension", "value"],
                      "x-property-order": ["dimension", "value"],
                      "properties": {
                        "dimension": {"type": "string", "x-referential": "category:pack", "x-ontology": true, "x-help": "Which Pack-category competency dimension this represents (usually matches the category of this Pack)."},
                        "value": {"type": "string", "x-help": "The real value within that dimension, e.g. dimension \"Technology\" uses concept type \"technology\", code \"nodejs\"."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- Competency values — one per real Technology/Domain Pack identity
-- (src/dblayer/seed/data/technology-*.pack.json, domain-*.pack.json).
-- nodejs/react/rust already seeded (migration 195); the rest of the real
-- 23 Technology + 25 Domain codes land here. technology-tmp.pack.json
-- (a stray duplicate of technology-html's own code) is not a distinct
-- identity — no separate value for it.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping) VALUES
  ('technology', 'cobol', 'COBOL', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'csharp', 'C#', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'css', 'CSS', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'db2', 'IBM Db2', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'docker', 'Docker', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'git', 'Git', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'go', 'Go', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'html', 'HTML', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'java', 'Java', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'javascript', 'JavaScript', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'kotlin', 'Kotlin', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'kubernetes', 'Kubernetes', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'oracle', 'Oracle Database', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'php', 'PHP', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'python', 'Python', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'rails', 'Ruby on Rails', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'react-native', 'React Native', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'sass', 'Sass', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'sql', 'SQL', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'swift', 'Swift', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),

  ('domain', 'accounting-finance', 'Accounting & Finance', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'banking-payments-markets', 'Banking, Payments & Markets', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'customer-service', 'Customer Service', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'ebook-library', 'Ebook Library', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'energy-utilities-mining', 'Energy, Utilities & Mining', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'enterprise-workflows', 'Enterprise Workflows', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'facilities-itsm', 'Facilities & ITSM', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'government-public-services', 'Government & Public Services', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'healthcare-pharma', 'Healthcare & Pharma', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'hospitality-travel-aviation', 'Hospitality, Travel & Aviation', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'hr-payroll', 'HR & Payroll', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'insurance-claims', 'Insurance Claims', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'legal-compliance-risk', 'Legal, Compliance & Risk', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'manufacturing-quality', 'Manufacturing Quality', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'marketing-advertising', 'Marketing & Advertising', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'order-management', 'Order Management', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'procurement-sourcing', 'Procurement & Sourcing', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'product-management', 'Product Management', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'project-portfolio', 'Project Portfolio', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'real-estate-construction', 'Real Estate & Construction', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'research-lifesciences', 'Research & Life Sciences', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'retail-ecommerce', 'Retail & Ecommerce', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'sales-crm', 'Sales & CRM', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'supply-chain-wms', 'Supply Chain & WMS', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('domain', 'telecom-media-publishing', 'Telecom, Media & Publishing', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
