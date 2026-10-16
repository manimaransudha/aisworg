import { logger } from "../utils/logger";
import { tenantsDB } from "./tenantsDB";
import { userDB } from "./userDB";
import { participantsMasterDB } from "./participantsMasterDB";
import { participantsDB } from "./participantsDB";

export const PLATFORM_TENANT_NAME = "Platform";
export const DEMO_TENANT_NAME = "Demo";
export const ATHENS_TENANT_NAME = "Athens AI-Native";
export const BABYLON_TENANT_NAME = "Babylon AI-Native";
export const CAMBODIA_TENANT_NAME = "Cambodia AI-Native";
export const RESERVED_TENANT_CODES = ["default", "platform", "demo"];
export const INITIAL_VERSION = "1.0.0";
export const SYSTEM_ACTOR_NAME = "System";
export const SYSTEM_ACTOR_BADGE = "system";
export const DELIVERABLE_BADGE_PREFIX = "deliverable_";
export const DELIVERABLE_PRODUCING_STATE = "In Progress";
export const PRODUCE_COMMAND_VERB = "produce";
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

    console.log(JSON.stringify(result))
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

async function findPlatformSystemActorId(): Promise<string> {
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
