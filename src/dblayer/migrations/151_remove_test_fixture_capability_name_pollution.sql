-- CR-086 step 3 follow-up — test fixtures should not be adding to the
-- capability-name Ontology (owner: "Are test fixtures adding capability-name
-- to ontology? they should not be."). Confirmed: migration 119 registered 26
-- concepts under concept_type = 'capability-name' (2 "real" Pack fixes —
-- domain-ebook-library, technology-nodejs — plus 24 test-<code> twins), and
-- cleanSlate.ts's own TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS array drifted to 36
-- by also adding technology-c/technology-cpp/technology-sass/technology-html/
-- technology-git/technology-css/technology-react/technology-react-native/
-- technology-js/technology-php. Every single one of these 36 codes is a Pack
-- IDENTITY code (already correctly registered under engineering-name/
-- domain-name via migration 132's CATEGORY_SCOPED_PACK_NAME_CONCEPTS) — none
-- of them is an actual contributions.capabilities[].code any Pack declares
-- (every real/test-fixture Pack contributes the shared canonical terms —
-- software-construction, engineering-work-review, understanding-business-
-- domain, operating-production-systems, etc. — confirmed by direct check
-- against every seed/fixture Pack file). They were never valid capability-name
-- terms; removing them here, and removed from cleanSlate.ts's own insert loop
-- so a future clean-slate run doesn't recreate them.
DELETE FROM ontology_concepts
 WHERE concept_type = 'capability-name'
   AND code IN (
     'domain-ebook-library', 'technology-nodejs', 'technology-c', 'technology-cpp',
     'technology-sass', 'technology-html', 'technology-git', 'technology-css',
     'technology-react', 'technology-react-native', 'technology-js', 'technology-php',
     'test-domain-ebook-library', 'test-architecture-solution-design',
     'test-configuration-management', 'test-development', 'test-project-management',
     'test-requirements-analysis', 'test-testing-qa', 'test-vision-opportunity-framing',
     'test-product-discovery', 'test-experience-design',
     'test-technical-architecture-discovery', 'test-security-privacy-compliance',
     'test-platform-developer-experience', 'test-backlog-release-planning',
     'test-implementation-engineering', 'test-quality-engineering-hardening',
     'test-scale-performance-optimization', 'test-beta-early-access-management',
     'test-launch-management', 'test-hypercare-stabilization', 'test-growth-optimization',
     'test-internationalization-localization', 'test-ongoing-operations-governance',
     'test-technology-nodejs'
   );
