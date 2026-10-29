import { logger } from "../utils/logger";
import { tenantsDB } from "./tenantsDB";
import { userDB } from "./userDB";
import { participantsMasterDB } from "./participantsMasterDB";
import { participantsDB } from "./participantsDB";

export const PLATFORM_TENANT_NAME = "Platform";
export const DEMO_TENANT_NAME = "Demo";
export const DEMO_AREAS = ["Declare", "Commission", "Execute"] as const;
// The Demo tenant is reseeded every day at midnight in the US Pacific timezone (Pacific Standard or Daylight Time as in force).
export const DEMO_RESET_CRON = "0 0 * * *";
export const DEMO_RESET_TIMEZONE = "America/Los_Angeles";
export const ATHENS_TENANT_NAME = "Athens AI-Native";
export const BABYLON_TENANT_NAME = "Babylon AI-Native";
export const CAMBODIA_TENANT_NAME = "Cambodia AI-Native";
export const NO_EXPIRY_DATE = "9999-12-31";
export const RESERVED_TENANT_CODES = ["default", "platform", "demo"];
export const INITIAL_VERSION = "1.0.0";
// The from-state of a birth row in transition_definitions (CR-128). transition_definitions_schema_recovery.sql repeats this literal in its partial unique index.
export const BIRTH_STATE = "None";
// Published after the event `UNDEFINED_EVENT` when a transition row names no event (CR-128). No consumer yet.
export const SDK_ATTENTION_EVENT = "SDKAttention";
export const UNDEFINED_EVENT = "Undefined";
// A Policy condition of this type is decided by a function in src/policies (CR-128).
export const IMPLEMENTED_CONDITION_TYPE = "implemented";
export const ONTOLOGY_VALUES_PRESENT_POLICY_CODE = "policy-ontology-values-present";
export const VALIDATE_SCHEMA_POLICY_CODE = "policy-validate-schema";
// A Pack a Template, Profile or Pack may reference: Active, or a state after Active (CR-128).
export const REFERENCEABLE_PACK_STATUSES = ["Active", "Retired", "Archived"] as const;

// The transition entity type of an authoring kind whose name differs from it (CR-128). The Deliverable Definition has its own lifecycle apart from the runtime Deliverable.
export const AUTHORING_KIND_ENTITY_TYPE = { Deliverable: "DeliverableDefinition" } as const;

export const COMMENT_REQUIRED_POLICY_CODE = "policy-comment-required";
export const MATERIALISE_TEMPLATE_POLICY_CODE = "policy-materialise-template";
export const MATERIALISE_PROFILE_POLICY_CODE = "policy-materialise-profile";
export const UNRAVEL_TEMPLATE_ACTION_CODE = "unravel-template";
export const UNRAVEL_PROFILE_ACTION_CODE = "unravel-profile";
export const SUPERSEDE_OBJECTIVE_ACTION_CODE = "supersede-objective";
export const SUPERSEDE_DECISION_ACTION_CODE = "supersede-decision";
export const COMPLETE_REVIEW_ACTION_CODE = "complete-review";
export const CONVERT_FINDING_ACTION_CODE = "convert-finding";
export const RAISE_EBM_RETIRED_ATTENTION_ACTION_CODE = "raise-ebm-retired-attention";
export const SYSTEM_ACTOR_NAME = "System";
export const SYSTEM_ACTOR_BADGE = "system";
export const DELIVERABLE_BADGE_PREFIX = "deliverable_";
export const PARTICIPANT_BADGE_PREFIX = "participant_";
export const DELIVERABLE_PRODUCING_STATE = "In Progress";
export const PRODUCE_COMMAND_VERB = "produce";
export const TRANSITION_DEFINITION_DEFINE_BADGE = "transitiondefinition_define";
export const EBM_ACTIVE_STATE = "Active";
export const EBM_VALIDATED_STATE = "Validated";
export const EBM_RETIRED_STATE = "Retired";
export const VALIDATE_SEU_REQUEST_ACTION_CODE = "validate-seu-request";
export const SEU_INITIATED_STATE = "Initiated";
export const SEU_VALIDATED_STATE = "Validated";
export const SEU_CONFIGURED_STATE = "Configured";
export const SEU_COMMISSIONED_STATE = "Commissioned";
export const SEU_ACTIVATED_STATE = "Activated";
export const SEU_OPERATIONAL_STATE = "Operational";
export const SEU_FAILED_STATE = "Failed";
export const CAPABILITY_ACTIVE_STATE = "Active";
export const SERVICE_ACTIVE_STATE = "Active";
export const OBJECTIVE_ACTIVE_STATE = "Active";
export const OBJECTIVE_RETIRED_STATE = "Retired";
export const OBJECTIVE_REJECT_STATE = "Reject";
export const OBJECTIVE_SUPERSEDED_STATE = "Superseded";
export const CAPABILITY_RETRY_DELAY_SECONDS = 300;
export const ATTESTATION_REQUIRED_POLICY_CODE = "policy-attestation-required";

// One shape for every Command type: the entity type and the verb, e.g. "Deliverable.approve".
export function commandTypeFor(entityType: string, verb: string): string {
    return `${entityType}.${verb}`;
}
export const DEMO_VOICE_PROVIDER = "webspeech";
export const DEMO_EDGETTS_VOICE = "en-IN-NeerjaNeural";
export const TEMP_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const TEST_APPROVER_EMAIL = "tester-approver@test.local";
export const TEST_CREATOR_EMAIL = "tester-creator@test.local";
export const TEST_ALL_EMAIL = "tester-all@test.local";

export async function getPlatformTenantId(): Promise<string> {
    const result = await tenantsDB.findByName(PLATFORM_TENANT_NAME);

    if (result.error) {
        throw new Error(
            `Error retrieving details for ${PLATFORM_TENANT_NAME}`
        );
    }

    if (!result.data?.id) {
        logger.error(
            `[seed:fetch-platform-tenant] ${PLATFORM_TENANT_NAME} not provisioned`
        );
        throw new Error(
            `${PLATFORM_TENANT_NAME} not provisioned`
        );
    }

    return result.data.id;
}

export async function getTesterId(email: string): Promise<string> {
    const result = await userDB.findByEmail(email);

    if (!result) {
        logger.error(
            `[seed:fetch-tester] ${email} not provisioned`
        );
        throw new Error(
            `${email} not provisioned`
        );
    }
    const { data: participant, error } = await participantsMasterDB.findByUserId(result.id);
    if (error) throw error;
    if (!participant) {
        logger.error(
            `[seed:fetch-tester] ${email} not registered as a participant`
        );
        throw new Error(
            `${email} not registered as a participant`
        );
    }
    return participant.id;
}

// The platform system actor: one participants_master row (type Automated, no user) in the Platform tenant.
// Provisioned with the Platform tenant and superuser. Idempotent.
export async function ensurePlatformSystemActor(): Promise<string> {
    const platformTenantId = await getPlatformTenantId();
    const { data: existing, error } = await participantsMasterDB.findByTenantId(platformTenantId);
    if (error) throw error;
    const found = (existing ?? []).find((p) => p.type === "Automated" && p.display_name === SYSTEM_ACTOR_NAME && p.user_id === null);
    if (found) return found.id;
    const { data: created, error: createError } = await participantsMasterDB.create({
        tenantId: platformTenantId,
        type: "Automated",
        displayName: SYSTEM_ACTOR_NAME,
        userId: null,
    });
    if (createError || !created) throw createError ?? new Error("failed to provision the platform system actor");
    return created.id;
}

export async function findPlatformSystemActorId(): Promise<string> {
    const platformTenantId = await getPlatformTenantId();
    const { data, error } = await participantsMasterDB.findByTenantId(platformTenantId);
    if (error) throw error;
    const found = (data ?? []).find((p) => p.type === "Automated" && p.display_name === SYSTEM_ACTOR_NAME && p.user_id === null);
    if (!found) throw new Error("the platform system actor is not provisioned — it is created with the Platform tenant and superuser");
    return found.id;
}

// The system actor acts as root for Deliverable badges only (CR-121 third pass).
export async function isPlatformSystemActor(actorId: string): Promise<boolean> {
    return actorId === (await findPlatformSystemActorId());
}

// The SEU's system participant: a participants row for the platform system actor, named after the SEU id.
// Created when the SEU is Commissioned. Idempotent.
export async function ensureSeuSystemParticipant(seuId: string): Promise<string> {
    const systemActorId = await findPlatformSystemActorId();
    const { data: existing, error } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, systemActorId);
    if (error) throw error;
    if (existing) return existing.id;
    const { data: created, error: createError } = await participantsDB.create({ seuId, type: "Automated", displayName: seuId, participantId: systemActorId });
    if (createError || !created) throw createError ?? new Error(`failed to create the system participant of SEU ${seuId}`);
    return created.id;
}

// The system actor of one SEU: the platform system actor's master id (events), the SEU system participant's id
// (author columns) and the system badge.
export async function getSystemActor(seuId: string): Promise<{ actorId: string; authorId: string; authorBadge: string }> {
    const actorId = await findPlatformSystemActorId();
    const { data: participant, error } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, actorId);
    if (error) throw error;
    if (!participant) throw new Error(`SEU ${seuId} has no system participant — it is created when the SEU is Commissioned`);
    return { actorId, authorId: participant.id, authorBadge: SYSTEM_ACTOR_BADGE };
}

// Demo tenant purge plan (src/dblayer/seed/demo/demoPurge.ts). Tables are listed in delete order,
// dependants before the rows they reference. The order and the nulled references were read from the
// live foreign keys of the schema. A new table with a tenant_id, seu_id or sponsoring_authority
// column, or a foreign key into one of these tables, has to be added here; the purge stops
// with an error when it finds a tenant-scoped table that is missing.
//   tenant      rows whose tenant_id is the Demo tenant
//   sponsoring  rows whose sponsoring_authority names the Demo tenant
//   seu         rows whose seu_id is a Demo SEU
//   seus        the Demo SEUs (Demo tenant, or commissioned against a Demo Objective)
//   via         rows that reference a row already selected for deletion in the parent table
export interface DemoPurgeStep {
  table: string;
  scope: "tenant" | "sponsoring" | "seu" | "seus" | "via";
  via?: Array<{ column: string; parent: string; parentColumn: string }>;
}
export const DEMO_PURGE_PLAN: readonly DemoPurgeStep[] = [
  { table: "attention_items", scope: "seu" },
  { table: "attestations", scope: "seu" },
  { table: "work_items", scope: "via", via: [{ column: "command_id", parent: "commands", parentColumn: "id" }, { column: "participant_id", parent: "participants", parentColumn: "id" }, { column: "author_id", parent: "participants", parentColumn: "id" }] },
  { table: "deliverable_references", scope: "seu" },
  { table: "commands", scope: "seu" },
  { table: "governance_evaluation_outcomes", scope: "seu" },
  { table: "transition_definitions", scope: "via", via: [{ column: "required_authority_rule_id", parent: "authority_rules", parentColumn: "id" }] },
  { table: "authority_rules", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "badge_tiers", scope: "tenant" },
  { table: "badge_types", scope: "tenant" },
  { table: "evidence_relationships", scope: "via", via: [{ column: "evidence_id", parent: "evidence", parentColumn: "id" }] },
  { table: "evidence", scope: "via", via: [{ column: "deliverable_id", parent: "deliverables", parentColumn: "id" }, { column: "author_id", parent: "participants", parentColumn: "id" }] },
  { table: "knowledge_validation_notes", scope: "via", via: [{ column: "knowledge_item_id", parent: "knowledge_items", parentColumn: "id" }] },
  { table: "knowledge_items", scope: "seu" },
  { table: "deliverable_authoring_content", scope: "via", via: [{ column: "deliverable_id", parent: "deliverables", parentColumn: "id" }] },
  { table: "external_interactions", scope: "seu" },
  { table: "deliverables", scope: "seu" },
  { table: "capability_fulfilment_pools", scope: "seu" },
  { table: "capability_fulfilments", scope: "via", via: [{ column: "seu_capability_id", parent: "seu_capabilities", parentColumn: "id" }, { column: "participant_id", parent: "participants", parentColumn: "id" }, { column: "author_id", parent: "participants", parentColumn: "id" }] },
  { table: "seu_capabilities", scope: "seu" },
  { table: "execution_targets", scope: "tenant" },
  { table: "services", scope: "via", via: [{ column: "providing_capability_id", parent: "capabilities", parentColumn: "id" }, { column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "template_capabilities", scope: "via", via: [{ column: "template_id", parent: "templates", parentColumn: "id" }, { column: "capability_id", parent: "capabilities", parentColumn: "id" }] },
  { table: "capabilities", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "capability_definitions", scope: "tenant" },
  { table: "checklists", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "compliance_evaluations", scope: "seu" },
  { table: "compliance_waivers", scope: "seu" },
  { table: "compliance_requirements", scope: "via", via: [{ column: "framework_code", parent: "compliance_frameworks", parentColumn: "code" }, { column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "compliance_frameworks", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "decisions", scope: "seu" },
  { table: "deliverable_definitions", scope: "tenant" },
  { table: "demo_playbooks", scope: "tenant" },
  { table: "demo_scenarios", scope: "tenant" },
  { table: "ebms", scope: "seu" },
  { table: "events", scope: "tenant" },
  { table: "findings", scope: "seu" },
  { table: "metric_definitions", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "objective_capabilities", scope: "via", via: [{ column: "objective_id", parent: "objectives", parentColumn: "id" }] },
  { table: "objective_root_sequences", scope: "tenant" },
  { table: "obligations", scope: "seu" },
  { table: "reviews", scope: "seu" },
  { table: "quality_gate_evaluations", scope: "seu" },
  { table: "participants", scope: "seu" },
  { table: "quality_gate_waivers", scope: "seu" },
  { table: "seus", scope: "seus" },
  { table: "objectives", scope: "sponsoring" },
  { table: "ontology_concept_comments", scope: "via", via: [{ column: "concept_id", parent: "ontology_concepts", parentColumn: "id" }] },
  { table: "ontology_concepts", scope: "tenant" },
  { table: "quality_gates", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "review_gates", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "policies", scope: "via", via: [{ column: "originating_pack_id", parent: "packs", parentColumn: "id" }] },
  { table: "packs", scope: "tenant" },
  { table: "policy_definitions", scope: "tenant" },
  { table: "profile_packs", scope: "via", via: [{ column: "profile_id", parent: "profiles", parentColumn: "id" }] },
  { table: "profiles", scope: "tenant" },
  { table: "service_definitions", scope: "tenant" },
  { table: "template_packs", scope: "via", via: [{ column: "template_id", parent: "templates", parentColumn: "id" }] },
  { table: "templates", scope: "tenant" },
  { table: "version_events", scope: "tenant" },
];

// References that close a foreign-key cycle. They are nulled for the rows about to be deleted before the plan runs.
export const DEMO_PURGE_NULLED_REFERENCES: ReadonlyArray<{ table: string; column: string; parent: string; parentColumn: string }> = [
  { table: "seus", column: "active_ebm_id", parent: "ebms", parentColumn: "id" },
];
