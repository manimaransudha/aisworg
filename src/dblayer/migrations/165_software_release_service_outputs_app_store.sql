-- CR-087 follow-up — found while verifying producingCapabilityCode's
-- automatic derivation (migration 164) is actually sound: mobile-application.
-- template.json's Deliverable Catalogue hand-tagged BOTH deployment-manifest
-- and app-store-submission-package as produced by software-release, but that
-- Capability's own Service Definition only ever declared deployment-manifest
-- as an output — a real, pre-existing gap in the Service Definition, not
-- something this migration invents: app-store-submission-package genuinely
-- is software-release's own output too (mobile app store submission is part
-- of a release), just never recorded there. Without this fix, the entry
-- would silently lose its producing-Capability link the moment derivation
-- replaces the old hand-authored field.
UPDATE service_definitions
   SET outputs = array_append(outputs, 'app-store-submission-package')
 WHERE capability_code = 'software-release'
   AND status = 'Active'
   AND NOT ('app-store-submission-package' = ANY(outputs));
