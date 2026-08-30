// Database Clean Slate — Instructions for the Other Session
// (design/mvp-build-plan/Database Clean Slate — Instructions.md).
//
// Wipes demo/usage data and test-fixture pollution while leaving the
// platform in exactly the state it needs to be in for the SDK UI and every
// governed entity type to work immediately afterward. Run:
//   pnpm db:clean-slate
//
// Design notes beyond the instructions doc:
//
// 1. No Pack is exempt from the wipe-and-reseed cycle — every real Pack
//    (OpenUP capability patterns, SDLC-phase, domain/technology, test-fixture
//    twins) is deleted here and recreated fresh by the reseed steps below.
//    The vocabulary tables that hang off Packs (capabilities, services,
//    authority_rules, policies, quality_gates, checklists, execution_targets)
//    are cleared first, keyed off `originating_pack_id IS NOT NULL` — a NULL
//    origin is real, migration-seeded vocabulary (the 4 SDK-authoring
//    Capabilities, 2 base Authority Rules), never Pack-attributable junk, and
//    always survives. metric_definitions is never Pack-attributed at all
//    (identifier allow-list instead). transition_definitions is wiped and
//    reseeded fresh from transitionDefinitions.json by
//    seedTransitionDefinitions() below, since it otherwise accumulates
//    test-fixture rows; the authority rules/policies it references all
//    survive the vocabulary filtering above, so the reseed resolves every
//    code, and the verb column is then back-filled by
//    seedAuthorityVocabulary().
//
// 1a. compliance_frameworks/compliance_requirements are wiped
//    unconditionally — no real seed data exists for either today (unlike
//    capabilities/authority_rules, a NULL originating_pack_id here means
//    "dry-run fixture," not "real migration-seeded vocabulary").
//
// 2. dependency_edges and ebms are real usage data with NO ACTION FKs that
//    block the seus/deliverables/templates/profiles wipe if left behind —
//    included in the usage-data TRUNCATE.
//
// 3. app_config is not part of this platform — Donchian-channel/trading
//    config for a different application sharing this Postgres schema
//    (seeded in the base schema.sql, not any SEU migration; owned by a
//    different table-owner role than every SEU-platform table). Never
//    touched here. `users`, by contrast, lives only in the `aisworg`
//    database and is this platform's own auth table (the other app's
//    accounts are in a separate, Postgres-isolated `endow` database) — wiped
//    in step 1b like everything else.
//
// 4. schema_definitions (the "schema registry") is INSERT-only at the
//    application layer (createSchemaVersion never updates/deletes), so every
//    version authored via the SDK UI would otherwise persist forever. A
//    minimum-clean DB holds exactly version 1 per kind (seeded idempotently
//    by migrations 014/015/016); step 2e trims back to that.
//
// Everything runs inside one transaction — an unexpected FK conflict (e.g.
// from a table added by a migration since this script was last reviewed)
// rolls back cleanly instead of leaving the database half-wiped.
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { seedIdentityBaseline } from "./seedIdentityBaseline.js";
import { seedTransitionDefinitions } from "./seedTransitionDefinitions.js";
import { seedAuthorityVocabulary } from "./seedAuthorityVocabulary.js";
import { seedEventSubscriptions } from "./seedEventSubscriptions.js";
import { seedCapabilityPatternPacks } from "./seedCapabilityPatternPacks.js";
import { seedDomainTechnologyPacks } from "./seedDomainTechnologyPacks.js";
import { seedSdlcPhasePacks } from "./seedSdlcPhasePacks.js";
import { seedSdlcStandardTemplates } from "./seedSdlcStandardTemplates.js";
import { seedAllTestFixturePacks } from "./seedTestFixturePacks.js";
import { seedAllTabsPackFixture } from "./seedAllTabsPackFixture.js";

// Migration 119's own INSERT, duplicated here so clean-slate is
// self-sufficient for these concepts regardless of migration-apply history —
// same discipline step 1c below already uses for the root badge_grant row.
// domain-ebook-library/technology-nodejs/technology-c/technology-cpp (real
// Packs) plus one `test-<code>` twin per real seed Pack except the unloaded
// core-engineering.pack.json — see seedTestFixturePacks.ts's own header.
const TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS: Array<[code: string, label: string]> = [
  ["domain-ebook-library", "E-Book Library Domain Practices"],
  ["technology-nodejs", "Node.js Engineering Practices"],
  ["technology-c", "C Engineering Practices"],
  ["technology-cpp", "C++ Engineering Practices"],
  ["test-domain-ebook-library", "Test: E-Book Library Domain Practices"],
  ["test-architecture-solution-design", "Test: Architecture (OpenUP Capability Pattern)"],
  ["test-configuration-management", "Test: Configuration & Change Management (OpenUP Capability Pattern)"],
  ["test-development", "Test: Development (OpenUP Capability Pattern)"],
  ["test-project-management", "Test: Project Management (OpenUP Capability Pattern)"],
  ["test-requirements-analysis", "Test: Requirements (OpenUP Capability Pattern)"],
  ["test-testing-qa", "Test: Test (OpenUP Capability Pattern)"],
  ["test-vision-opportunity-framing", "Test: Vision & Opportunity (SDLC Phase 0)"],
  ["test-product-discovery", "Test: Product Discovery (SDLC Phase 1)"],
  ["test-experience-design", "Test: Experience Design (SDLC Phase 2)"],
  ["test-technical-architecture-discovery", "Test: Technical Discovery & Architecture (SDLC Phase 3)"],
  ["test-security-privacy-compliance", "Test: Security, Privacy & Compliance (SDLC Phase 4)"],
  ["test-platform-developer-experience", "Test: Platform & Developer Experience (SDLC Phase 5)"],
  ["test-backlog-release-planning", "Test: Backlog & Release Planning (SDLC Phase 6)"],
  ["test-implementation-engineering", "Test: Implementation (SDLC Phase 7)"],
  ["test-quality-engineering-hardening", "Test: Quality Engineering & Hardening (SDLC Phase 8)"],
  ["test-scale-performance-optimization", "Test: Scale & Performance Optimization (SDLC Phase 9)"],
  ["test-beta-early-access-management", "Test: Beta / Early Access (SDLC Phase 10)"],
  ["test-launch-management", "Test: Launch (SDLC Phase 11)"],
  ["test-hypercare-stabilization", "Test: Hypercare & Stabilization (SDLC Phase 12)"],
  ["test-growth-optimization", "Test: Growth & Optimization (SDLC Phase 13)"],
  ["test-internationalization-localization", "Test: Internationalization & Localization (SDLC Phase 14)"],
  ["test-ongoing-operations-governance", "Test: Ongoing Operations & Governance (SDLC Phase 15)"],
  ["test-technology-nodejs", "Test: Node.js Engineering Practices"],
];

// template-categories (migration 053) is a fixed, real 9-value business
// classification — every one of the 9 real codes is already claimed by a
// real seeded Template (seedSdlcStandardTemplates.ts), so tests/testFixtures.ts's
// shared Template fixture (`test-enterprise-web-application`, used as the
// CR-026 inheritance parent in sdk-authoring.test.ts) has no free real code
// to borrow. Same `test-<code>` treatment capability-name already gets above
// for every test-fixture Pack twin.
const TEMPLATE_CATEGORY_TEST_CONCEPTS: Array<[code: string, label: string]> = [["test-enterprise-web-application", "Test: Web Application"]];

// CR-079 step (a) — the six new category-scoped Pack-identity concept types
// (migration 132), mirrored here the same way capability-name's own Pack
// codes are above: every real Pack's own current code, grouped by its real
// category, plus each one's test-fixture twin. Kept in exact sync with
// migration 132's own INSERT — this dual-source pattern is a known,
// accepted drift risk (already caught once for capability-name: technology-c/
// technology-cpp existed only in this file's own list, not migration 119),
// not a new one introduced here.
const CATEGORY_SCOPED_PACK_NAME_CONCEPTS: Array<[conceptType: string, code: string, label: string]> = [
  ["compliance-name", "security-privacy-compliance", "Security, Privacy & Compliance (SDLC Phase 4)"],
  ["compliance-name", "test-security-privacy-compliance", "Security, Privacy & Compliance (SDLC Phase 4)"],
  ["domain-name", "domain-ebook-library", "E-Book Library Domain Practices"],
  ["domain-name", "test-domain-ebook-library", "E-Book Library Domain Practices"],
  ["engineering-name", "architecture-solution-design", "Architecture (OpenUP Capability Pattern)"],
  ["engineering-name", "configuration-management", "Configuration & Change Management (OpenUP Capability Pattern)"],
  ["engineering-name", "development", "Development (OpenUP Capability Pattern)"],
  ["engineering-name", "experience-design", "Experience Design (SDLC Phase 2)"],
  ["engineering-name", "hypercare-stabilization", "Hypercare & Stabilization (SDLC Phase 12)"],
  ["engineering-name", "implementation-engineering", "Implementation (SDLC Phase 7)"],
  ["engineering-name", "internationalization-localization", "Internationalization & Localization (SDLC Phase 14)"],
  ["engineering-name", "launch-management", "Launch (SDLC Phase 11)"],
  ["engineering-name", "ongoing-operations-governance", "Ongoing Operations & Governance (SDLC Phase 15)"],
  ["engineering-name", "platform-developer-experience", "Platform & Developer Experience (SDLC Phase 5)"],
  ["engineering-name", "project-management", "Project Management (OpenUP Capability Pattern)"],
  ["engineering-name", "quality-engineering-hardening", "Quality Engineering & Hardening (SDLC Phase 8)"],
  ["engineering-name", "requirements-analysis", "Requirements (OpenUP Capability Pattern)"],
  ["engineering-name", "scale-performance-optimization", "Scale & Performance Optimization (SDLC Phase 9)"],
  ["engineering-name", "technical-architecture-discovery", "Technical Discovery & Architecture (SDLC Phase 3)"],
  ["engineering-name", "test-configuration-management", "Configuration & Change Management (OpenUP Capability Pattern)"],
  ["engineering-name", "test-experience-design", "Experience Design (SDLC Phase 2)"],
  ["engineering-name", "test-hypercare-stabilization", "Hypercare & Stabilization (SDLC Phase 12)"],
  ["engineering-name", "test-implementation-engineering", "Implementation (SDLC Phase 7)"],
  ["engineering-name", "test-internationalization-localization", "Internationalization & Localization (SDLC Phase 14)"],
  ["engineering-name", "test-launch-management", "Launch (SDLC Phase 11)"],
  ["engineering-name", "test-ongoing-operations-governance", "Ongoing Operations & Governance (SDLC Phase 15)"],
  ["engineering-name", "test-platform-developer-experience", "Platform & Developer Experience (SDLC Phase 5)"],
  ["engineering-name", "test-project-management", "Project Management (OpenUP Capability Pattern)"],
  ["engineering-name", "test-quality-engineering-hardening", "Quality Engineering & Hardening (SDLC Phase 8)"],
  ["engineering-name", "test-scale-performance-optimization", "Scale & Performance Optimization (SDLC Phase 9)"],
  ["engineering-name", "test-technical-architecture-discovery", "Technical Discovery & Architecture (SDLC Phase 3)"],
  ["engineering-name", "test-testing-qa", "Test (OpenUP Capability Pattern)"],
  ["engineering-name", "testing-qa", "Test (OpenUP Capability Pattern)"],
  // CR-079 bug fix / CR-080 / CR-081 — migrations 134/135/136/138/139's own
  // stable test-run Pack identity codes (registerTestOntologyCode's
  // dynamically-minted junk, removed; replaced by these permanent concepts —
  // see migration 134's own header). Missed from this dual-source list when
  // each migration was first added; caught and closed together here rather
  // than one at a time, per the SAME known-drift-risk pattern already
  // flagged above for capability-name/technology-c/technology-cpp.
  ["engineering-name", "test-comp-arity", "Test: Composition Arity"],
  ["engineering-name", "test-comp-samecode", "Test: Composition Same Code"],
  ["engineering-name", "test-comp-cd", "Test: Composition Conflict Detection"],
  ["engineering-name", "test-compose-specialize-parent", "Test: Compose Specialize Parent"],
  ["engineering-name", "test-compose-specialize-child", "Test: Compose Specialize Child"],
  ["engineering-name", "test-compose-union-a", "Test: Compose Union A"],
  ["engineering-name", "test-compose-union-b", "Test: Compose Union B"],
  ["engineering-name", "test-compose-union-child", "Test: Compose Union Child"],
  ["engineering-name", "test-compose-merge-shared", "Test: Compose Merge Shared"],
  ["engineering-name", "test-compose-merge-child", "Test: Compose Merge Child"],
  ["engineering-name", "test-compose-intersect-a", "Test: Compose Intersect A"],
  ["engineering-name", "test-compose-intersect-b", "Test: Compose Intersect B"],
  ["engineering-name", "test-compose-intersect-child", "Test: Compose Intersect Child"],
  ["engineering-name", "test-compose-supplement-base", "Test: Compose Supplement Base"],
  ["engineering-name", "test-compose-supplement-extra", "Test: Compose Supplement Extra"],
  ["engineering-name", "test-compose-supplement-child", "Test: Compose Supplement Child"],
  ["engineering-name", "test-compose-override", "Test: Compose Override"],
  ["engineering-name", "test-compose-override-draft", "Test: Compose Override Draft"],
  ["engineering-name", "test-compose-notdraft-parent", "Test: Compose Not-Draft Parent"],
  ["engineering-name", "test-compose-mandatory", "Test: Compose Mandatory"],
  ["engineering-name", "test-compose-optional", "Test: Compose Optional"],
  ["engineering-name", "test-pack", "Test: Pack"],
  ["engineering-name", "test-conflict", "Test: Conflict"],
  ["engineering-name", "test-live-code", "Test: Live Code"],
  ["engineering-name", "test-reactivate-supersede", "Test: Reactivate Supersede"],
  ["engineering-name", "test-tenant-scoped", "Test: Tenant Scoped"],
  ["engineering-name", "test-tenant-reactivate", "Test: Tenant Reactivate"],
  ["engineering-name", "webflow-phase9-pack", "Test: WebFlow Phase 9 Pack"],
  ["engineering-name", "test-sdk-pack", "Test: SDK Pack"],
  ["engineering-name", "test-pack-versioning", "Test: Pack Versioning"],
  ["engineering-name", "test-pack-no-active-version", "Test: Pack No Active Version"],
  ["engineering-name", "test-pack-still-active", "Test: Pack Still Active"],
  ["engineering-name", "test-pack-reject", "Test: Pack Reject"],
  ["engineering-name", "test-pack-sequence", "Test: Pack Version Sequence"],
  ["engineering-name", "test-pack-all-tabs", "Test: All Tabs Populated"],
  ["organisation-name", "backlog-release-planning", "Backlog & Release Planning (SDLC Phase 6)"],
  ["organisation-name", "beta-early-access-management", "Beta / Early Access (SDLC Phase 10)"],
  ["organisation-name", "growth-optimization", "Growth & Optimization (SDLC Phase 13)"],
  ["organisation-name", "product-discovery", "Product Discovery (SDLC Phase 1)"],
  ["organisation-name", "test-backlog-release-planning", "Backlog & Release Planning (SDLC Phase 6)"],
  ["organisation-name", "test-beta-early-access-management", "Beta / Early Access (SDLC Phase 10)"],
  ["organisation-name", "test-growth-optimization", "Growth & Optimization (SDLC Phase 13)"],
  ["organisation-name", "test-product-discovery", "Product Discovery (SDLC Phase 1)"],
  ["organisation-name", "test-vision-opportunity-framing", "Vision & Opportunity (SDLC Phase 0)"],
  ["organisation-name", "vision-opportunity-framing", "Vision & Opportunity (SDLC Phase 0)"],
  // migration 134 — governance-ebm-sharpening.test.ts's own two Packs use category: "Organisation".
  ["organisation-name", "conflict-a", "Test: Conflict A"],
  ["organisation-name", "conflict-b", "Test: Conflict B"],
  ["technology-name", "technology-c", "C Engineering Practices"],
  ["technology-name", "technology-cpp", "C++ Engineering Practices"],
  ["technology-name", "technology-nodejs", "Node.js Engineering Practices"],
  ["technology-name", "test-technology-nodejs", "Node.js Engineering Practices"],
];

const REAL_METRIC_IDENTIFIERS = [
  "deliverable-cycle-time",
  "quality-gate-latency",
  "command-generation-rate",
  "dispatch-latency",
  "work-item-duration",
  "knowledge-growth",
  "evidence-generation",
  "rework-rate",
  "deliverable-acceptance-rate",
];

// Every table hanging off seus/deliverables/objectives/participants, in one
// multi-table TRUNCATE ... CASCADE — Postgres resolves the full dependency
// closure across every table named in a single statement regardless of
// individual FK delete_rule or the order listed here, and CASCADE only
// pulls in tables that reference these — verified against the full FK dump
// that nothing outside this set does.
const USAGE_DATA_TABLES = [
  "quality_gate_evaluations",
  "work_items",
  "commands",
  "events",
  "external_interactions",
  "attention_items",
  "decisions",
  "knowledge_items",
  "evidence",
  "obligations",
  "capability_fulfilments",
  "seu_capabilities",
  "participants",
  "deliverable_authoring_content",
  "deliverables",
  "ebms",
  "objective_capabilities",
  "objectives",
  "objective_root_sequences",
  "seus",
];

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1 — usage/instance data. Must run before step 2: ebms (just
    // wiped) FKs into templates/profiles, and deleting a Template/Profile
    // while a stale ebms row still referenced it would otherwise fail.
    await client.query(`TRUNCATE TABLE ${USAGE_DATA_TABLES.join(", ")} CASCADE`);
    logger.info(`[db:clean-slate] step 1 — truncated ${USAGE_DATA_TABLES.length} usage-data tables.`);

    // Step 1b — users. clean-slate is a dev/test-only reset (never run in
    // production), so every account goes: real usage data, not a fixture. The
    // god identity (SUPERUSER_EMAIL) is re-created automatically on the next
    // login — passportConfig upserts the row and badgeBootstrap grants it root
    // — so nothing needs preserving here. RESTART IDENTITY resets the serial so
    // that first login comes back as id 1, matching the NODE_ENV=test
    // auto-login shim and the holder_id '1' root grant 012_badge_model seeds.
    // CASCADE covers the requested_by / user_id FKs (objectives, seus, commands,
    // participants, attestations) — all already emptied in step 1. NOTE: this
    // `users` table lives ONLY in the `aisworg` database; the other app's users
    // are in a SEPARATE `endow` database (Postgres-isolated), so wiping here
    // cannot touch them — the older "shared infrastructure" note (below, on
    // app_config) does NOT apply to users.
    await client.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
    logger.info("[db:clean-slate] step 1b — truncated users (RESTART IDENTITY); god user re-created on next login.");

    // Step 1c — badge_grants. Bug fix (real regression, hit 3 times): a grant
    // is meaningless without the holder it names, but badge_grants.holder_id
    // is a polymorphic column (not an FK to users), so step 1b's CASCADE never
    // touches it — every grant survived a "clean slate" untouched. Combined
    // with RESTART IDENTITY resetting the users serial, a freshly-created user
    // could be assigned an id a PRE-RESET grant still names and silently
    // inherit authority (sometimes `root`) it never earned — exactly the
    // accountability failure this platform's own noun×verb model exists to
    // prevent. Same discipline step 5 already applies to transition_definitions
    // below ("wipe the accumulated graph, reseed fresh, self-healing"): wipe
    // every grant here; steps 4/6 (identity baseline + authority vocab
    // back-fill) reseed the real fixture grants fresh afterward.
    // CASCADE: commands.acting_badge_grant_id FKs into badge_grants —
    // Postgres's TRUNCATE FK-check is structural, not content-based, so this
    // is required even though step 1 (above) already emptied commands.
    await client.query("TRUNCATE TABLE badge_grants RESTART IDENTITY CASCADE");
    // Restore the ONE row this truncate takes out that nothing downstream
    // reseeds: 012_badge_model.sql's own idempotent `holder_id '1' -> root`
    // grant, which only runs during `migrate:seu` (not on every clean-slate)
    // — the step 1b comment above already documents every other piece of code
    // that assumes this row survives (NODE_ENV=test's auto-login shim acts as
    // actorId "1" directly, with no real login/badgeBootstrap to (re)grant it).
    // Without this, root's bypass vanishes and every test/dev session that
    // relies on it fails `authority_denied` platform-wide. Same exact INSERT
    // migration 012 uses.
    await client.query(`
      INSERT INTO badge_grants (holder_type, holder_id, badge_type)
      SELECT 'User', '1', 'root'
      WHERE NOT EXISTS (SELECT 1 FROM badge_grants WHERE holder_id = '1' AND badge_type = 'root')
    `);
    logger.info("[db:clean-slate] step 1c — truncated badge_grants (RESTART IDENTITY) and restored the holder '1' root grant; fixture grants reseeded in step 4.");

    // Step 1d — capability-name Ontology concepts for the test-fixture-pack
    // system (migration 119). ontology_concepts is never wiped by clean-slate
    // (additive vocabulary, same as every other migration-seeded concept), so
    // this is a plain idempotent insert, not a wipe+reseed. Needed before
    // step 7b below — Pack.code validation (assertCanonicalCategory) requires
    // every one of these to already exist.
    for (const [code, label] of TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS) {
      await client.query(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id)
         VALUES ('capability-name', $1, $2, '11111111-1111-1111-1111-111111111111')
         ON CONFLICT (concept_type, code, tenant_id) DO NOTHING`,
        [code, label]
      );
    }
    logger.info(`[db:clean-slate] step 1d — ensured ${TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS.length} test-fixture-pack Ontology concepts.`);

    // Step 1d-2 — CR-079 step (a): the six new category-scoped Pack-identity
    // concepts (migration 132), same idempotent-insert treatment as step 1d
    // above, needed before step (b)'s validatePackSeed rewiring can check a
    // real or test Pack's own code against its own category's vocabulary
    // instead of capability-name.
    for (const [conceptType, code, label] of CATEGORY_SCOPED_PACK_NAME_CONCEPTS) {
      await client.query(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id)
         VALUES ($1, $2, $3, '11111111-1111-1111-1111-111111111111')
         ON CONFLICT (concept_type, code, tenant_id) DO NOTHING`,
        [conceptType, code, label]
      );
    }
    logger.info(`[db:clean-slate] step 1d-2 — ensured ${CATEGORY_SCOPED_PACK_NAME_CONCEPTS.length} category-scoped Pack-name Ontology concepts.`);

    // Step 1e — template-categories test concept(s) (see
    // TEMPLATE_CATEGORY_TEST_CONCEPTS's own comment). Not consumed by any
    // step below (cleanSlate.ts's own step 8 only ever publishes real
    // production Templates) — this is a plain idempotent insert ensuring the
    // concept exists in the DB before any later test run walks a Draft
    // locked to one of these codes through publish-time Ontology validation
    // (sdk-authoring.test.ts's CR-026 tests).
    for (const [code, label] of TEMPLATE_CATEGORY_TEST_CONCEPTS) {
      await client.query(
        `INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id)
         VALUES ('template-categories', $1, $2, '11111111-1111-1111-1111-111111111111')
         ON CONFLICT (concept_type, code, tenant_id) DO NOTHING`,
        [code, label]
      );
    }
    logger.info(`[db:clean-slate] step 1e — ensured ${TEMPLATE_CATEGORY_TEST_CONCEPTS.length} template-categories test concept(s).`);

    // Step 2a — every Profile, then every Template (profiles first:
    // profiles.base_template_id -> templates is NO ACTION, so a surviving
    // profile would block deleting the template it points at if templates
    // went first). Cascades template_capabilities, template_packs,
    // profile_packs automatically (real ON DELETE CASCADE FKs).
    // dependency_definitions has a polymorphic owner (Template/Pack/Profile)
    // that Postgres can't express as a real FK, so Template/Profile-owned
    // rows are deleted explicitly here before their owner goes; Pack-owned
    // rows are handled in step 2c below, alongside the Pack deletion itself.
    // Every Template's own rows are re-materialised fresh from its own
    // authored dependencyGraph by seedSdlcStandardTemplates()'s own call to
    // materialiseDependencyGraph in step 7 anyway. Matches the README's own
    // claim: "a clean-slate database has no commissionable Template."
    const dependencyDefsForTemplatesProfilesDeleted = await client.query(
      "DELETE FROM dependency_definitions WHERE owning_entity_type IN ('Template', 'Profile')"
    );
    const profilesDeleted = await client.query("DELETE FROM profiles");
    const templatesDeleted = await client.query("DELETE FROM templates");
    logger.info(
      `[db:clean-slate] step 2a — deleted ${dependencyDefsForTemplatesProfilesDeleted.rowCount} Template/Profile-owned dependency_definitions rows, ${profilesDeleted.rowCount} profiles, ${templatesDeleted.rowCount} templates.`
    );

    // Step 2b — vocabulary rows attributed to a Pack, deleted unconditionally
    // wherever originating_pack_id IS NOT NULL — no Pack is exempt from the
    // wipe-and-reseed cycle, so nothing here needs a keep-by-code allow-list
    // either: whatever Pack a kept row was attributed to would just get
    // deleted anyway in step 2c below, orphaning the FK (real, observed for
    // both quality_gates and policies before this was corrected). Everything
    // real gets recreated fresh by the reseed steps further down. Order
    // matters: services must go before capabilities
    // (services.providing_capability_id is NO ACTION). originating_pack_id
    // IS NULL rows are always kept — real, migration-seeded vocabulary (the
    // 4 SDK-authoring Capabilities, 2 base Authority Rules), not
    // Pack-attributable junk.
    const qgDeleted = await client.query("DELETE FROM quality_gates WHERE originating_pack_id IS NOT NULL");
    const rgDeleted = await client.query("DELETE FROM review_gates WHERE originating_pack_id IS NOT NULL");
    // checklists has a real FK into packs (NOT NULL, unlike review_gates'
    // nullable one — every Checklist has a real originating Pack).
    const clDeleted = await client.query("DELETE FROM checklists");
    const policiesDeleted = await client.query("DELETE FROM policies WHERE originating_pack_id IS NOT NULL");
    // transition_definitions.required_authority_rule_id is a real (NO ACTION)
    // FK into authority_rules — required_policy_ids/required_quality_gate_ids
    // are plain UUID[] columns, not real FKs, so only this one column can
    // block the delete below. transition_definitions itself is deliberately
    // NOT wiped in this transaction (see the NOTE below step 2e — step 4
    // owns its own atomic wipe+reseed, run after this transaction commits),
    // so a stale row left over from before this run can still reference an
    // authority_rule about to be deleted here. Real, observed crash: "update
    // or delete on table authority_rules violates foreign key constraint
    // transition_definitions_required_authority_rule_id_fkey". Deleting the
    // handful of stale referencing rows first is harmless — step 4 replaces
    // the entire table moments later regardless.
    await client.query(
      "DELETE FROM transition_definitions WHERE required_authority_rule_id IN (SELECT id FROM authority_rules WHERE originating_pack_id IS NOT NULL)"
    );
    const authorityRulesDeleted = await client.query("DELETE FROM authority_rules WHERE originating_pack_id IS NOT NULL");
    const servicesDeleted = await client.query("DELETE FROM services WHERE originating_pack_id IS NOT NULL");
    // execution_targets (migration 025) has a NOT NULL, NO ACTION FK into
    // capabilities (one row per Capability, "how a Participant fulfilling it
    // is reached"), never caught by step 2d's own execution_targets delete
    // below (tenant-scoped, for non-reserved tenants only, and runs AFTER
    // this step anyway) — real, observed crash: "update or delete on table
    // capabilities violates foreign key constraint
    // execution_targets_capability_id_fkey". Must run before the
    // capabilitiesDeleted query below.
    const executionTargetsDeleted = await client.query(
      "DELETE FROM execution_targets WHERE capability_id IN (SELECT id FROM capabilities WHERE originating_pack_id IS NOT NULL)"
    );
    const capabilitiesDeleted = await client.query("DELETE FROM capabilities WHERE originating_pack_id IS NOT NULL");
    const metricsDeleted = await client.query("DELETE FROM metric_definitions WHERE identifier != ALL($1::text[])", [REAL_METRIC_IDENTIFIERS]);
    // compliance_requirements/compliance_frameworks (Ch.27, Phase 15) — no
    // seed file declares any real Compliance Framework today, so unlike
    // capabilities/authority_rules a NULL originating_pack_id here means
    // "dry-run fixture," not "real, migration-seeded" — nothing to protect.
    // Wiped unconditionally; requirements before frameworks (FK). No reseed
    // step exists for either; compliance_waivers/compliance_evaluations are
    // already empty by this point (CASCADEd from step 1's own seus truncate).
    const complianceReqDeleted = await client.query("DELETE FROM compliance_requirements");
    const complianceFwDeleted = await client.query("DELETE FROM compliance_frameworks");
    logger.info(
      `[db:clean-slate] step 2b — deleted ${qgDeleted.rowCount} junk quality_gates, ${rgDeleted.rowCount} junk review_gates, ${clDeleted.rowCount} junk checklists, ${policiesDeleted.rowCount} policies, ${authorityRulesDeleted.rowCount} authority_rules, ${servicesDeleted.rowCount} services, ${executionTargetsDeleted.rowCount} execution_targets, ${capabilitiesDeleted.rowCount} capabilities, ${metricsDeleted.rowCount} metric_definitions, ${complianceReqDeleted.rowCount} compliance_requirements, ${complianceFwDeleted.rowCount} compliance_frameworks.`
    );

    // Step 2c — every Pack, unconditionally. Safe now: every table with a NO
    // ACTION FK into packs (authority_rules, capabilities,
    // metric_definitions, policies, quality_gates, services), plus
    // execution_targets' one-hop-removed FK into capabilities, has already
    // been filtered above. template_packs/profile_packs store the Pack's
    // code as plain text, not an FK (013_template_profile_pack_by_code.sql)
    // — Pack deletion was never blocked by them. dependency_definitions rows
    // owned by a Pack (CR-043's polymorphic owner — no real FK, so these
    // would otherwise orphan silently rather than block or cascade) are
    // cleaned up first, same as step 2a does for Template/Profile owners —
    // no real Pack-owned rows exist today (nothing authors them yet), but
    // this keeps the invariant true once something does.
    // CR-080 — pack_comments (migration 137, Validated -> Draft Reject's own
    // comment thread) has a real NO ACTION FK into packs, same as the tables
    // named above — added here too, cleared before packsDeleted, same
    // pattern. Currently always empty pre-reseed (nothing seeds one), so this
    // was harmless to miss until the first real Reject actually ran — caught
    // before that happened, not after clean-slate broke on it.
    const packCommentsDeleted = await client.query("DELETE FROM pack_comments");
    const dependencyDefsForPacksDeleted = await client.query("DELETE FROM dependency_definitions WHERE owning_entity_type = 'Pack'");
    const packsDeleted = await client.query("DELETE FROM packs");
    logger.info(`[db:clean-slate] step 2c — deleted ${packCommentsDeleted.rowCount} pack_comments, ${dependencyDefsForPacksDeleted.rowCount} Pack-owned dependency_definitions rows, ${packsDeleted.rowCount} packs.`);

    // Step 2d — non-reserved Tenants (and everything FK-bound to them). The
    // reserved tenants are fixtures that must survive: 'default' (commissioning
    // fallback), plus CR-004's 'platform' (Platform-user home) and 'demo'
    // (Google-OAuth sandbox). Extra tenants come from the dry-run suite or
    // manual creation and otherwise linger in every tenant dropdown. All tenant
    // FKs are RESTRICT (no ON DELETE CASCADE), so each dependent is cleared
    // first, in FK order, before the tenants themselves. Rows scoped to the
    // reserved tenants survive (config).
    const RESERVED_TENANT_CODES = ["default", "platform", "demo"];
    const { rows: reservedRows } = await client.query("SELECT id FROM tenants WHERE code = ANY($1::text[])", [RESERVED_TENANT_CODES]);
    const reservedIds = reservedRows.map((r) => r.id as string);
    if (!reservedIds.length) {
      throw new Error("no reserved tenant found — migrations seed 'default'/'platform'/'demo'; refusing to wipe the tenants table without a survivor. Rolling back.");
    }
    await client.query("DELETE FROM tenant_contracts WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM execution_targets WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM tenant_concept_aliases WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // Tenant-added badge variants/tiers (Layer-2/3) reference a tenant; the
    // Platform-recommended defaults (tenant_id IS NULL) are vocabulary and stay.
    await client.query("DELETE FROM badge_tiers WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM badge_types WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    const tenantsDeleted = await client.query("DELETE FROM tenants WHERE id <> ALL($1::uuid[])", [reservedIds]);
    logger.info(`[db:clean-slate] step 2d — deleted ${tenantsDeleted.rowCount} non-reserved tenants (+ their contracts, execution targets, aliases, badge variants).`);

    // Step 2e — the schema registry (schema_definitions). createSchemaVersion is
    // INSERT-only (never updates/deletes), so every schema version authored via
    // the SDK UI adds a row and lingers forever — test/dry-run authoring leaves
    // dozens-to-hundreds of stale versions (156 TransitionDefinition versions
    // observed on a real dev DB). The migration-seeded minimum is exactly version
    // 1 per kind (014/015/016, idempotent), which is what a "clean" DB should
    // hold. Trim back to it: delete every version > 1. FK-safe — the only table
    // referencing schema_definitions is deliverable_authoring_content, truncated
    // in step 1.
    const schemaVersionsDeleted = await client.query("DELETE FROM schema_definitions WHERE version > 1");
    logger.info(`[db:clean-slate] step 2e — trimmed ${schemaVersionsDeleted.rowCount} authored schema_definitions versions (kept version 1 per kind).`);

    // NOTE (CR-006): transition_definitions and the authority vocabulary
    // (nouns/verbs/mapping) are NOT wiped here in the main transaction — the
    // reseed steps below own them, each rebuilding fresh with an atomic
    // wipe+reseed of its own (so the app-critical transition graph is never
    // left empty between a wipe and its reseed).

    await client.query("COMMIT");
    logger.info("[db:clean-slate] committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Step 3 — restore the identity baseline (tenants + users) captured from a
  // live dump, so a reset lands on a known identity state rather than an empty
  // auth table. Idempotent upserts; advances the users serial past the seeded
  // ids. Runs after the wipe (step 1b truncated users, step 2d the tenants).
  await seedIdentityBaseline();

  // Step 4 — CR-006 transition definitions: wipe the accumulated graph
  // (incl. test-fixture pollution) and reseed fresh from
  // transitionDefinitions.json. Atomic wipe+reseed inside the module. Must
  // run BEFORE the vocabulary seed, which back-fills `verb` onto these
  // fresh rows. An unresolvable requiredAuthorityRuleCode/requiredPolicyCodes
  // entry doesn't throw — left null/[] and self-healed via
  // backfillAuthorityRuleCode/backfillPolicyCode, called from
  // core/packs.ts's seedContributions during Pack publish (steps 6-7 below)
  // — whichever Pack ends up declaring a matching code wires it up.
  // core-engineering.pack.json (the original source of most of these codes)
  // is not loaded: its own code collides with openup-development.pack.json's,
  // and its capabilities duplicate what the real OpenUP packs already
  // provide (see openup-development.pack.json's own policies for where its
  // 12 real baseline policies live now instead).
  await seedTransitionDefinitions();

  // Step 5 — CR-006 authority vocabulary (nouns/verbs/mapping) + back-fill the
  // verb per transition. Atomic wipe+reseed; depends on step 4's fresh rows.
  await seedAuthorityVocabulary();

  // Step 5b — Ch.30 Event Bus redesign: Event Registry + Event Subscriptions
  // (the one real subscription, WorkItemDispatched -> assignmentDelivery,
  // migrated off the old imperative eventBus.subscribe() call).
  await seedEventSubscriptions();

  // Step 6 — EPF/OpenUP capability-pattern Packs. Must run AFTER steps 4/5:
  // publishing each Pack drives it through transitionEngine (Draft ->
  // Validated -> Published -> Active), which needs Pack's own
  // transition_definitions rows (step 4) and their back-filled verb (step 5)
  // to resolve — every real Pack publish needs this ordering. Rerun-safe
  // (publishPack is a no-op on an already-published (code, version)).
  await seedCapabilityPatternPacks();

  // Step 6b — domain-ebook-library / technology-nodejs / technology-c /
  // technology-cpp, real standalone Packs. Every one depends on `development`,
  // so must run after step 6 above. Rerun-safe.
  await seedDomainTechnologyPacks();

  // Step 7 — SDLC-phase Packs. Same ordering reasoning as step 6 — needs
  // transition_definitions (step 4) and the back-filled verb (step 5) to
  // drive Draft -> Validated -> Published -> Active. Rerun-safe.
  await seedSdlcPhasePacks();

  // Step 7b — test-fixture Pack twins (one per real seed Pack, `test-`
  // prefixed code — see seedTestFixturePacks.ts's own header). Same ordering
  // reasoning as steps 6/7; step 1d above already ensured their Ontology
  // concepts exist. Exists to keep tests from colliding with — and silently
  // deprecating — the real Packs steps 6/7 just seeded (only one Pack
  // version per code can be Active; a test file that mints its own
  // throwaway versions under a REAL Pack's code deprecates it). Rerun-safe.
  await seedAllTestFixturePacks();

  // Step 7c — owner: "Create atleast one pack seed json which has all the
  // tabs populated." test-pack-all-tabs.pack.json deliberately populates
  // every generated-form tab at once (Identity & Metadata, Compatibility,
  // Dependencies, and every Contribution type) — a single realistic fixture
  // for authoring-UI/validation work to exercise all of them against,
  // unlike steps 6/6b/7's real Packs (each only populates the handful of
  // tabs its own real content needs) or step 7b's twins (several explicitly
  // strip reviewGates/checklists — see that file's own header). Must run
  // after step 6 (needs architecture-solution-design, its own required
  // dependency, already Active). Migration 140 registers its own stable
  // engineering-name concept. Rerun-safe.
  await seedAllTabsPackFixture();

  // Step 8 — the 9 standard Templates (+ default Profiles), one per real
  // template-categories Ontology concept, drawing on steps 6/6b/7's real
  // Packs (core-engineering.pack.json is not loaded — see step 4's own
  // comment). Publishes through publishTemplate/publishProfile now (the same
  // validated entry points the interactive SDK authoring flow uses —
  // validateTemplateSeed/validateProfileSeed, Ontology-checked — instead of
  // calling templatesDB.upsert/profilesDB.upsert directly). Underneath, both
  // are still a direct upsert, not transitionEngine-driven (unlike Pack's own
  // Draft -> Validated -> Published -> Active walk), so still no dependency
  // on steps 4/5 themselves. Must run after step 7 (needs its Packs'
  // Capabilities to exist). Rerun-safe (upsert semantics).
  await seedSdlcStandardTemplates();

  logger.info("[db:clean-slate] done. Sanity-check next: hit /aisworg/seu/sdk/pack-authoring (Create starts a fresh Draft directly — no bootstrap Template needed) and /aisworg/seu/telemetry (zero Deliverables measured) as a real user.");
}

run()
  .catch((err) => {
    logger.error("[db:clean-slate] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
