-- CR-087 — Service Definitions for the 3 new capabilities (migration 046):
-- training-and-evaluating-models, engineering-embedded-firmware,
-- engineering-data-pipelines. Same rigor as the original 60 (migration 154)
-- and same 1:1 capability alignment — inserted directly in the CURRENT
-- schema shape (inputs/outputs as deliverable-name TEXT[], service_level as
-- structured JSONB) rather than the shape migration 154 originally used and
-- migrations 155/159 later evolved, since there's no need to replay that
-- evolution for rows created after it.
--
-- inputs chosen per capability's own available upstream in the Templates
-- that will use them (architecture-decision-record for the two Templates
-- without a software-design capability; requirements-analysis-model for the
-- one with no design step of its own either, before its own model-specific
-- work begins). Each service's own data-preparation sub-step (training data,
-- the hardware interface contract) is modelled as an OUTPUT of the same
-- service, not a separate capability — CR-087's own "creation of a new
-- deliverable does not mean there is a new capability" discipline applied
-- inward, not just to the call-outs that didn't get built.
INSERT INTO service_definitions (code, name, capability_code, purpose, inputs, outputs, service_level, governance, success, consumers, version, status, draft_content, tenant_id) VALUES
  (
    'model-training-evaluation-service', 'Model Training & Evaluation Service', 'training-and-evaluating-models',
    'produce a trained model that meets its defined quality, bias, and performance objective, with evidence that it does',
    ARRAY['requirements-analysis-model']::text[],
    ARRAY['training-data-specification','model-card','model-evaluation-report']::text[],
    '[{"code": "evaluation-coverage", "label": "Evaluation coverage across defined quality/bias/performance criteria", "target_level": "minimum", "target": 90, "units": "percent"}, {"code": "bias-disclosure", "label": "Known bias and limitations disclosed in the Model Card", "target_level": "exact", "target": 100, "units": "percent"}]'::jsonb,
    'model-governance policy, responsible-AI standard',
    'the model''s evaluation record is accepted as sufficient to authorise serving it',
    ARRAY['software-construction']::text[],
    '1.0.0', 'Active',
    '{"code": "model-training-evaluation-service", "name": "Model Training & Evaluation Service", "capabilityCode": "training-and-evaluating-models", "purpose": "produce a trained model that meets its defined quality, bias, and performance objective, with evidence that it does", "inputs": ["requirements-analysis-model"], "outputs": ["training-data-specification", "model-card", "model-evaluation-report"], "serviceLevel": [{"code": "evaluation-coverage", "label": "Evaluation coverage across defined quality/bias/performance criteria", "target_level": "minimum", "target": 90, "units": "percent"}, {"code": "bias-disclosure", "label": "Known bias and limitations disclosed in the Model Card", "target_level": "exact", "target": 100, "units": "percent"}], "governance": "model-governance policy, responsible-AI standard", "success": "the model''s evaluation record is accepted as sufficient to authorise serving it", "consumers": ["software-construction"]}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'firmware-engineering-service', 'Firmware Engineering Service', 'engineering-embedded-firmware',
    'deliver firmware that behaves correctly within the target hardware''s real constraints',
    ARRAY['architecture-decision-record']::text[],
    ARRAY['hardware-interface-specification','firmware-build','hardware-compatibility-report']::text[],
    '[{"code": "timing-budget-compliance", "label": "Timing budget compliance", "target_level": "exact", "target": 100, "units": "percent"}, {"code": "memory-budget-compliance", "label": "Memory budget compliance", "target_level": "exact", "target": 100, "units": "percent"}]'::jsonb,
    'embedded systems engineering standard, safety/regulatory obligation where applicable',
    'firmware verified against the real or simulated target hardware and accepted for integration',
    ARRAY['software-validation']::text[],
    '1.0.0', 'Active',
    '{"code": "firmware-engineering-service", "name": "Firmware Engineering Service", "capabilityCode": "engineering-embedded-firmware", "purpose": "deliver firmware that behaves correctly within the target hardware''s real constraints", "inputs": ["architecture-decision-record"], "outputs": ["hardware-interface-specification", "firmware-build", "hardware-compatibility-report"], "serviceLevel": [{"code": "timing-budget-compliance", "label": "Timing budget compliance", "target_level": "exact", "target": 100, "units": "percent"}, {"code": "memory-budget-compliance", "label": "Memory budget compliance", "target_level": "exact", "target": 100, "units": "percent"}], "governance": "embedded systems engineering standard, safety/regulatory obligation where applicable", "success": "firmware verified against the real or simulated target hardware and accepted for integration", "consumers": ["software-validation"]}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'data-pipeline-engineering-service', 'Data Pipeline Engineering Service', 'engineering-data-pipelines',
    'deliver a data pipeline that moves and transforms data reliably, with evidence of its own quality',
    ARRAY['architecture-decision-record']::text[],
    ARRAY['data-pipeline-specification','data-quality-report']::text[],
    '[{"code": "pipeline-reliability", "label": "Pipeline run success rate", "target_level": "minimum", "target": 99, "units": "percent"}, {"code": "data-quality-coverage", "label": "Data quality checks coverage", "target_level": "minimum", "target": 90, "units": "percent"}]'::jsonb,
    'data-management policy, data-quality standard',
    'the pipeline''s data-quality evidence is accepted as sufficient to trust downstream consumers',
    ARRAY['software-validation']::text[],
    '1.0.0', 'Active',
    '{"code": "data-pipeline-engineering-service", "name": "Data Pipeline Engineering Service", "capabilityCode": "engineering-data-pipelines", "purpose": "deliver a data pipeline that moves and transforms data reliably, with evidence of its own quality", "inputs": ["architecture-decision-record"], "outputs": ["data-pipeline-specification", "data-quality-report"], "serviceLevel": [{"code": "pipeline-reliability", "label": "Pipeline run success rate", "target_level": "minimum", "target": 99, "units": "percent"}, {"code": "data-quality-coverage", "label": "Data quality checks coverage", "target_level": "minimum", "target": 90, "units": "percent"}], "governance": "data-management policy, data-quality standard", "success": "the pipeline''s data-quality evidence is accepted as sufficient to trust downstream consumers", "consumers": ["software-validation"]}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  )
ON CONFLICT (code, version, tenant_id) DO NOTHING;
