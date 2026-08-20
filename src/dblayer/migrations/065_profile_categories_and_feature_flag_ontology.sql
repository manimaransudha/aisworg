-- Ontology (Ch.18) — two new concept types for Profile. Owner, 2026-08-19.
--
-- profile-categories: Ch.7 §8's own 6 examples, verbatim — the same
-- data-driven-vocabulary treatment CR-021 gave Template's §8 categories.
-- Unlike Template, this does NOT become Profile's `code` (see migration 064's
-- own comment on why) — it's a real, separate `category` field.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, description) VALUES
  ('profile-categories', 'startup', 'Startup', '11111111-1111-1111-1111-111111111111', 'Minimal governance, rapid delivery, default Platform Packs.'),
  ('profile-categories', 'enterprise', 'Enterprise', '11111111-1111-1111-1111-111111111111', 'Enterprise governance, multiple Organisation Packs, formal reviews.'),
  ('profile-categories', 'healthcare', 'Healthcare', '11111111-1111-1111-1111-111111111111', 'Healthcare Domain Pack, HIPAA (or equivalent regional compliance), healthcare integrations.'),
  ('profile-categories', 'banking', 'Banking', '11111111-1111-1111-1111-111111111111', 'Banking Domain Pack, financial compliance, enhanced audit requirements.'),
  ('profile-categories', 'prototype', 'Prototype', '11111111-1111-1111-1111-111111111111', 'Lightweight governance, minimal documentation, rapid iteration.'),
  ('profile-categories', 'production', 'Production', '11111111-1111-1111-1111-111111111111', 'Complete governance, operational monitoring, security validation, full traceability.')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- feature-flag: Ch.7 §11's own 5 examples — an open, curatable vocabulary
-- (a tenant can add its own via Ontology Management, same as any other
-- concept type), not a fixed platform-code enum.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, description) VALUES
  ('feature-flag', 'legacy-code-analysis', 'Legacy Code Analysis', '11111111-1111-1111-1111-111111111111', null),
  ('feature-flag', 'knowledge-graph', 'Knowledge Graph', '11111111-1111-1111-1111-111111111111', null),
  ('feature-flag', 'multi-llm-execution', 'Multi-LLM execution', '11111111-1111-1111-1111-111111111111', null),
  ('feature-flag', 'advanced-metrics', 'Advanced Metrics', '11111111-1111-1111-1111-111111111111', null),
  ('feature-flag', 'experimental-features', 'Experimental Features', '11111111-1111-1111-1111-111111111111', null)
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
