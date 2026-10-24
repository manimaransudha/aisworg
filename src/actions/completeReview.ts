import { reviewsDB } from "../dblayer/reviewsDB.js";
import type { ReviewOutcome, ReviewRow } from "../dblayer/seuTypes.js";
import type { ActionInput } from "./index.js";

// Completing a Review records its outcome (CR-133). The outcome is immutable, so a Review that already has one is refused.
// It runs inside the transition's transaction, before the status changes, and refuses by throwing.
export async function completeReview(input: ActionInput): Promise<void> {
  const review = input.context.row as ReviewRow;
  const outcome = input.context.outcome as ReviewOutcome | undefined;
  if (!outcome) throw new Error("completing a Review requires an outcome (Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred)");
  if (review.outcome != null) throw new Error(`this Review already has outcome "${review.outcome}" — a Review outcome is immutable`);
  const { error } = await reviewsDB.setOutcome(input.entityId, outcome);
  if (error) throw error;
}
