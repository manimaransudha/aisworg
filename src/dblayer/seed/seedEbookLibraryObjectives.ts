import { createObjective } from "../../routes/seu/core/objectives.js";
import { logger } from "../../utils/logger.js";
import { getTesterId, TEST_ALL_EMAIL } from "../constants.js";
import { userDB } from "../userDB.js";

export async function seedEbookLibraryObjectives(): Promise<void> {
  const REQUESTED_BY = await getTesterId(TEST_ALL_EMAIL);

  const { objective: root } = await createObjective({
    statement: "Deliver an ebook library management system enabling members to browse, borrow and return digital books.",
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy: REQUESTED_BY
  });

  const { objective: manageBooks } = await createObjective({
    statement: "Create system to manage flow of books",
    requiredCapabilityCodes: [],
    tier: "Operational",
    status: "Proposed",
    parentObjectiveId: root.id,
    requestedBy: REQUESTED_BY,
  });

  const { objective: manageMembers } = await createObjective({
    statement: "Create system to manage library members",
    requiredCapabilityCodes: [],
    tier: "Operational",
    status: "Proposed",
    parentObjectiveId: root.id,
    requestedBy: REQUESTED_BY,
  });

  await createObjective({
    statement: "Create and manage a catalog of books",
    requiredCapabilityCodes: [],
    tier: "Engineering",
    status: "Proposed",
    parentObjectiveId: manageBooks.id,
    requestedBy: REQUESTED_BY,
  });

  await createObjective({
    statement: "Create a book checkin/checkout/waitlist",
    requiredCapabilityCodes: [],
    tier: "Engineering",
    status: "Proposed",
    parentObjectiveId: manageBooks.id,
    requestedBy: REQUESTED_BY,
  });

  await createObjective({
    statement: "Create mechanisms to track waitlist and notify availability",
    requiredCapabilityCodes: [],
    tier: "Engineering",
    status: "Proposed",
    parentObjectiveId: manageBooks.id,
    requestedBy: REQUESTED_BY,
  });

  await createObjective({
    statement: "Enroll members",
    requiredCapabilityCodes: [],
    tier: "Engineering",
    status: "Proposed",
    parentObjectiveId: manageMembers.id,
    requestedBy: REQUESTED_BY,
  });

  await createObjective({
    statement: "Create a module for member account and profile.",
    requiredCapabilityCodes: [],
    tier: "Engineering",
    status: "Proposed",
    parentObjectiveId: manageMembers.id,
    requestedBy: REQUESTED_BY,
  });

  logger.info(`[seed:ebook-library-objectives] seeded root "${root.statement}" + 2 Operational + 5 Engineering Objectives, all Proposed.`);
}
