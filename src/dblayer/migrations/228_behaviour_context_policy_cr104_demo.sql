-- CR-107 follow-up (owner: "for a few participants behavior context, mark
-- them as background cleared") — cr104-demo-seu-eligibility-policies.pack.json's
-- own scope:'Eligibility' Policy (policy-cr104-demo-background-check.json)
-- checks a candidate Participant's behaviour_context for
-- {policy: 'cr104-demo-background-check', payload: {cleared: true}}, but
-- behaviour_context.policy is itself validated against a real, separate
-- Ontology concept type (behaviour-context-policy, migration 195) —
-- humanOnboardingAdapter.ts can't emit this entry until this code exists,
-- same discipline that concept type's own 2 existing rows already follow.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type) VALUES
  ('behaviour-context-policy', 'cr104-demo-background-check', 'CR-104 Demo: Background Check', '11111111-1111-1111-1111-111111111111', 'text')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
