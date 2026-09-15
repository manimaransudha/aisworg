-- Owner (Ch.24, lines 388-394 — "An exception shall specify: justification;
-- approving authority; duration; scope; review requirements"): exceptionStatement
-- already covers justification and exceptionApprovers already covers
-- approving authority — three real fields were missing outright: duration,
-- scope (named exceptionScope here, distinct from Policy's own top-level
-- scope field — Transition/Eligibility — which this is not), and review
-- requirements.
--
-- Owner, separately: "Exceptions are defined only when Constraint
-- type='Policy'" (Ch.24 §4 — Standard deviations already don't block;
-- an exception to something non-blocking has nothing to except) —
-- exceptionRules itself gets x-show-when/x-show-when-values against the
-- top-level constraintType field (bare, unindexed — form.elements
-- resolves it regardless of how deep exceptionRules itself sits).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        schema,
                        '{properties,conditions,items,properties,exceptionRules,x-show-when}',
                        '"constraintType"'::jsonb,
                        true
                      ),
                      '{properties,conditions,items,properties,exceptionRules,x-show-when-values}',
                      '["Policy"]'::jsonb,
                      true
                    ),
                    '{properties,conditions,items,properties,exceptionRules,items,properties,duration}',
                    '{"type": "string", "x-help": "Ch.24 — how long this exception remains in effect, e.g. \"90 days\", \"Until next release\"."}'::jsonb,
                    true
                  ),
                  '{properties,conditions,items,properties,exceptionRules,items,properties,exceptionScope}',
                  '{"type": "string", "x-help": "Ch.24 — what this exception applies to, e.g. \"This SEU only\", \"All Deliverables of type X\". Distinct from the Policy''s own scope (Transition/Eligibility)."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties'->'exceptionRules' IS NOT NULL;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,exceptionRules,items,properties,reviewRequirements}',
                  '{"type": "string", "x-help": "Ch.24 — what review this exception itself requires, e.g. a recurring check-in, a follow-up audit."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties'->'exceptionRules' IS NOT NULL;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,exceptionRules,items,x-property-order}',
                  '["identifier", "exceptionStatement", "duration", "exceptionScope", "exceptionApprovers", "exceptionComposition", "reviewRequirements"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties'->'exceptionRules' IS NOT NULL;
