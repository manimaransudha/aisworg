// Owner-provided worked example (example.md) — an ebook library management
// system's Objective decomposition, seeded once per db:clean-slate so it
// doesn't have to be hand-created every time. Every node is created Proposed
// (owner: "Let it stay in the proposed phase") — none of these are meant to
// be Active/commissionable out of the box.
//
// Uses createObjective (core/objectives.ts), not a raw INSERT — this is the
// same validated path the app itself uses (tier-rank checks, requestedBy
// attribution, sponsoring_authority derivation), so this tree is exactly as
// legitimate as one a user built by hand through the UI.
//
// Node order matters: objectivesDB.create's own display_id numbering
// (next_child_seq per parent, next_seq per tenant for roots) is purely
// sequential, so creating these in the exact order below is what makes the
// auto-generated display_id sequence land on 1 / 1.1 / 1.2 / 1.1.1 / 1.1.2 /
// 1.1.3 / 1.2.1 / 1.2.2 — the same ids example.md itself uses — rather than
// something that merely happens to match by coincidence.
import { createObjective } from "../../routes/seu/core/objectives.js";
import { logger } from "../../utils/logger.js";

// Test — All Badges (seedIdentityBaseline.ts's own TESTER_ALL_ID) — the same
// requestedBy convention every other test/seed fixture in this codebase
// already uses (e.g. tests/commission-profile-choice.test.ts).
const REQUESTED_BY = 1001;

export async function seedEbookLibraryObjectives(): Promise<void> {
  const { objective: root } = await createObjective({
    statement: "Deliver an ebook library management system enabling members to browse, borrow and return digital books.",
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy: REQUESTED_BY,
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
