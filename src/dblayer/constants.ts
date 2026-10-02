import { logger } from "../utils/logger";
import { tenantsDB } from "./tenantsDB";
import { userDB } from "./userDB";
import { participantsMasterDB } from "./participantsMasterDB";

// Fixed names for the reserved tenants 
export const PLATFORM_TENANT_NAME = "Platform";
export const DEMO_TENANT_NAME = "Demo";
// const DEFAULT_TENANT_NAME = "Default Tenant";
export const ATHENS_TENANT_NAME = "Athens AI-Native";
export const BABYLON_TENANT_NAME = "Babylon AI-Native";
export const CAMBODIA_TENANT_NAME = "Cambodia AI-Native";
export const RESERVED_TENANT_CODES = ["default", "platform", "demo"];
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