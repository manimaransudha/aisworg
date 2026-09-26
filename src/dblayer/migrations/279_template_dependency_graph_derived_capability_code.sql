-- CR-114 Pass 2 — dependencyGraph[].fromCapabilityCode was the only field
-- smuggling a derivation name ("derived:requiredCapabilityCodes") inside the
-- generic x-referential key. x-referential-source-derived-by is now its own
-- real keyword (formGenerator.ts/schemaCompiler.ts), parallel to
-- x-referential-source-by, naming the registered derivation
-- (sdkAuthoring.ts's loadDerivedPackCapabilityOptions) directly instead of
-- overloading x-referential's string value. Same jsonb_set-against-
-- MAX(version) pattern as migration 276.
UPDATE schema_definitions
   SET schema = jsonb_set(
         schema #- '{properties,dependencyGraph,items,properties,fromCapabilityCode,x-referential}',
         '{properties,dependencyGraph,items,properties,fromCapabilityCode,x-referential-source-derived-by}',
         '"requiredCapabilityCodes"'::jsonb,
         true
       )
 WHERE entity_kind = 'Template'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Template')
   AND schema->'properties'->'dependencyGraph'->'items'->'properties'->'fromCapabilityCode'->>'x-referential' = 'derived:requiredCapabilityCodes';
