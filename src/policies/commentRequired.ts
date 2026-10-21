import type { PolicyImplementationInput } from "./index.js";

// A comment accompanies the transition (CR-128). The caller puts the comment text in the transition context.
export async function commentRequired(input: PolicyImplementationInput): Promise<boolean> {
  return typeof input.context.comment === "string" && input.context.comment.trim().length > 0;
}
