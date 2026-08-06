// SDK / Authoring UI Layer (design/mvp-build-plan/SDK UI Layer Plan.md) — the
// glue behind all four authoring surfaces (Pack first; Template/Profile/
// Transition Definition reuse every function here once their own bootstrap
// Template/schema_definitions row is seeded). Per the plan's "Core
// principle": each of the four is authored as an ordinary Deliverable,
// produced by commissioning a small bootstrap SEU, driven through
// Deliverable's own Defined -> In Progress -> Approved -> Baselined lifecycle
// — this module is what wires that together, not a new engine.
//
// Access control resolution (not written into the plan itself — a mechanism
// gap found while wiring this up, see 014_sdk_authoring.sql's header
// comment): transitionDeliverable's badge check and Work Item dispatch are
// both scoped per-SEU, which doesn't fit "grant someone Pack Creator once,
// they author many Packs over time." Two new flat Platform-scoped badges
// (sdk_creator/sdk_approver) gate the routes that call into this module
// (requirePlatformBadge, same as Identity Management); underneath,
// ensureAuthoringBadge lazily auto-provisions the real, correctly-scoped
// Engineering-badge grant (Deliverable + a dedicated authoring Capability +
// the shared sdk-authoring-scope placeholder Pack) the first time a flat-
// badge holder actually acts, covering every bootstrap SEU they touch after
// that — no per-session re-granting.
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { deliverableAuthoringContentDB } from "../../../dblayer/deliverableAuthoringContentDB.js";
import { createObjective } from "./objectives.js";
import { commissionSeu } from "./commissioning.js";
import { transitionDeliverable, type TransitionDeliverableResult } from "./deliverables.js";
import { createEvidence, transitionEvidence } from "./evidence.js";
import { publishPack, validatePackSeed, type PackSeedInput } from "./packs.js";
import { publishTemplate, validateTemplateSeed, type TemplateSeedInput } from "./templates.js";
import { publishProfile, validateProfileSeed, type ProfileSeedInput } from "./profiles.js";
import { publishTransitionDefinition, validateTransitionDefinitionSeed, type TransitionDefinitionSeedInput } from "./transitionDefinitions.js";
import type { DeliverableAuthoringContentRow, DeliverableRow, SchemaDefinitionEntityKind, SchemaDefinitionRow, SeuRow } from "../../../dblayer/seuTypes.js";

import { AUTHORING_SCOPE_PACK_CODE } from "../../../domain/sdk/authoringScope.js";

export { AUTHORING_SCOPE_PACK_CODE };

export const AUTHORING_CAPABILITY_CODE: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "pack-authoring",
  Template: "template-authoring",
  Profile: "profile-authoring",
  TransitionDefinition: "transition-definition-authoring",
};

// The category recorded on the produced Deliverable — what a generated form/
// glue step keys off, not a new TransitionEntityType (Core Principle).
export const AUTHORING_CATEGORY: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "Pack Definition",
  Template: "Template Definition",
  Profile: "Profile Definition",
  TransitionDefinition: "Transition Definition Definition",
};

export const BOOTSTRAP_TEMPLATE_CODE: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "sdk-authoring-pack",
  Template: "sdk-authoring-template",
  Profile: "sdk-authoring-profile",
  TransitionDefinition: "sdk-authoring-transition-definition",
};

export function bootstrapProfileCode(kind: SchemaDefinitionEntityKind): string {
  return `${BOOTSTRAP_TEMPLATE_CODE[kind]}-profile`;
}

// Idempotent — safe to call on every action, not just the first. No unique
// index makes a duplicate grant impossible at the DB level (badge_grants has
// none across these columns), so this checks first rather than relying on a
// conflict to no-op.
async function ensureAuthoringBadge(actorId: string, badgeType: "creator" | "approver", kind: SchemaDefinitionEntityKind): Promise<void> {
  const capabilityCode = AUTHORING_CAPABILITY_CODE[kind];
  const { data: capabilities } = await capabilitiesDB.findByCodes([capabilityCode]);
  const capability = capabilities?.[0];
  if (!capability) throw new Error(`unknown authoring capability: ${capabilityCode} — did migration 014 run?`);

  const { data: grants } = await badgeGrantsDB.findActiveByHolderAndType(actorId, badgeType);
  const alreadyHeld = (grants ?? []).some(
    (g) => g.governed_entity_type === "Deliverable" && g.capability_id === capability.id && g.scope_id === AUTHORING_SCOPE_PACK_CODE
  );
  if (alreadyHeld) return;

  const result = await badgeGrantsDB.create({
    holderId: actorId,
    badgeType,
    governedEntityType: "Deliverable",
    capabilityId: capability.id,
    scopeId: AUTHORING_SCOPE_PACK_CODE,
  });
  if ("error" in result) throw result.error;
}

// A bootstrap SEU's single Deliverable can't reach In Progress at all
// without someone fulfilling its producing Capability (executionEngine's
// dispatch requirement, same as any other Deliverable) — auto-provisioned
// here the same way tests fulfil Capabilities manually, since there's no
// separate human "assign a Participant" step for a one-Deliverable SEU that
// exists only to hold this one document.
async function ensureParticipantFulfilment(seuId: string, capabilityCode: string, actorId: string, actorName: string): Promise<void> {
  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const seuCapability = (seuCapabilities ?? []).find((sc) => sc.capability_code === capabilityCode);
  if (!seuCapability) throw new Error(`SEU ${seuId} was not commissioned with a requirement for capability ${capabilityCode}`);

  const { data: participant, error } = await participantsDB.create({
    seuId,
    type: "Human",
    displayName: actorName,
    userId: Number(actorId),
  });
  if (error || !participant) throw error ?? new Error("failed to create participant for authoring SEU");

  await capabilityFulfilmentsDB.create({ seuCapabilityId: seuCapability.id, participantId: participant.id, fulfilmentStrategy: "Human" });
  await seuCapabilitiesDB.markFulfilled(seuCapability.id);
}

export interface StartAuthoringResult {
  seu: SeuRow;
  deliverable: DeliverableRow;
  authoringContent: DeliverableAuthoringContentRow;
  schema: SchemaDefinitionRow;
}

// "Create/Save" (plan's Core Principle) — commissions a bootstrap SEU
// against the kind's bootstrap Template, via the same commissionSeu every
// real SEU goes through, then advances the produced Deliverable to
// In Progress so authoring can begin.
export async function startAuthoring(input: {
  kind: SchemaDefinitionEntityKind;
  actorId: string;
  actorName: string;
  actorRole: string;
  importedContent?: Record<string, unknown>;
}): Promise<StartAuthoringResult> {
  const templateCode = BOOTSTRAP_TEMPLATE_CODE[input.kind];
  const { data: template } = await templatesDB.findByCode(templateCode);
  if (!template) throw new Error(`no bootstrap Template seeded for ${input.kind} (expected code "${templateCode}")`);

  const { data: profile } = await profilesDB.findByCode(bootstrapProfileCode(input.kind));
  if (!profile) throw new Error(`no bootstrap Profile seeded for ${input.kind}`);

  const { data: schema } = await schemaDefinitionsDB.findLatest(input.kind);
  if (!schema) throw new Error(`no schema_definitions row for ${input.kind}`);

  const { objective } = await createObjective({
    statement: `SDK authoring: ${input.kind} by ${input.actorName}`,
    requiredCapabilityCodes: [],
    requestedBy: Number(input.actorId),
  });

  const commissioned = await commissionSeu({
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    actorRole: input.actorRole,
    requestedBy: Number(input.actorId),
  });
  if (!commissioned.ok) throw new Error(`commissioning the authoring SEU failed at ${commissioned.stage}: ${commissioned.reason}`);

  await ensureParticipantFulfilment(commissioned.seu.id, AUTHORING_CAPABILITY_CODE[input.kind], input.actorId, input.actorName);
  await ensureAuthoringBadge(input.actorId, "creator", input.kind);

  const { data: deliverables } = await deliverablesDB.findBySeuId(commissioned.seu.id);
  const deliverable = (deliverables ?? [])[0];
  if (!deliverable) throw new Error("bootstrap SEU commissioned with no Deliverable — check its Template's Deliverable Catalogue");

  const { data: authoringContent, error: contentErr } = await deliverableAuthoringContentDB.create({
    deliverableId: deliverable.id,
    schemaDefinitionId: schema.id,
    content: input.importedContent ?? {},
  });
  if (contentErr || !authoringContent) throw contentErr ?? new Error("failed to create authoring content row");

  const advanced = await transitionDeliverable({ deliverableId: deliverable.id, targetState: "In Progress", actorId: input.actorId, actorRole: input.actorRole });
  if (!advanced.ok) throw new Error(`could not start authoring: ${describeTransitionFailure(advanced)}`);

  return { seu: commissioned.seu, deliverable: advanced.deliverable, authoringContent, schema };
}

export async function saveAuthoringContent(deliverableId: string, content: Record<string, unknown>): Promise<DeliverableAuthoringContentRow> {
  const { data, error } = await deliverableAuthoringContentDB.updateContent(deliverableId, content);
  if (error || !data) throw error ?? new Error("failed to save authoring content");
  return data;
}

// The generated form (and, more likely, a hand-edited JSON import) can omit
// contributions/dependencies entirely, which validatePackSeed's own
// duplicate-code checks assume are at least empty arrays/objects — normalize
// before handing off, rather than making validatePackSeed defensive against
// a shape only a partially-filled authoring document produces.
function toPackSeedInput(content: Record<string, unknown>): PackSeedInput {
  return {
    ...(content as unknown as PackSeedInput),
    contributions: (content.contributions as PackSeedInput["contributions"]) ?? {},
    dependencies: (content.dependencies as PackSeedInput["dependencies"]) ?? [],
  };
}

function toTemplateSeedInput(content: Record<string, unknown>): TemplateSeedInput {
  return {
    ...(content as unknown as TemplateSeedInput),
    requiredCapabilityCodes: (content.requiredCapabilityCodes as string[]) ?? [],
    mandatoryPackCodes: (content.mandatoryPackCodes as string[]) ?? [],
    deliverableCatalogue: (content.deliverableCatalogue as TemplateSeedInput["deliverableCatalogue"]) ?? [],
  };
}

function toProfileSeedInput(content: Record<string, unknown>): ProfileSeedInput {
  return {
    ...(content as unknown as ProfileSeedInput),
    configParameters: (content.configParameters as Record<string, unknown>) ?? {},
    optionalPackCodes: (content.optionalPackCodes as string[]) ?? [],
  };
}

function toTransitionDefinitionSeedInput(content: Record<string, unknown>): TransitionDefinitionSeedInput {
  return {
    ...(content as unknown as TransitionDefinitionSeedInput),
    requiredPolicyCodes: (content.requiredPolicyCodes as string[]) ?? [],
    requiredQualityGateCodes: (content.requiredQualityGateCodes as string[]) ?? [],
  };
}

// Structural + referential validation, per kind — each has its own
// (validatePackSeed etc., same reasoning as createPackDraft calling
// validatePackSeed today).
async function validateAuthoredContent(kind: SchemaDefinitionEntityKind, content: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (kind === "Pack") return validatePackSeed(toPackSeedInput(content));
  if (kind === "Template") return validateTemplateSeed(toTemplateSeedInput(content));
  if (kind === "Profile") return validateProfileSeed(toProfileSeedInput(content));
  if (kind === "TransitionDefinition") return validateTransitionDefinitionSeed(toTransitionDefinitionSeedInput(content));
  return { ok: false, errors: [`no validator wired for kind "${kind}" yet`] };
}

// "Publish" (plan's Core Principle: reaching Baselined calls publishPack —
// or the Template/Profile/Transition-Definition equivalent — as glue on
// that one transition, not a new mechanism).
async function publishAuthoredContentByKind(kind: SchemaDefinitionEntityKind, content: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (kind === "Pack") {
    const result = await publishPack({ seed: toPackSeedInput(content), actorRole: "power", activate: true });
    return result.ok ? { ok: true } : { ok: false, errors: result.errors ?? ["publishPack failed"] };
  }
  if (kind === "Template") {
    const result = await publishTemplate(toTemplateSeedInput(content));
    return result.ok ? { ok: true } : { ok: false, errors: result.errors };
  }
  if (kind === "Profile") {
    const result = await publishProfile(toProfileSeedInput(content));
    return result.ok ? { ok: true } : { ok: false, errors: result.errors };
  }
  if (kind === "TransitionDefinition") {
    const result = await publishTransitionDefinition(toTransitionDefinitionSeedInput(content));
    return result.ok ? { ok: true } : { ok: false, errors: result.errors };
  }
  return { ok: false, errors: [`no publisher wired for kind "${kind}" yet`] };
}

export interface AuthoringActionResult {
  ok: boolean;
  deliverable?: DeliverableRow;
  errors?: string[];
}

// "Review" (plan's Core Principle: In Progress -> Approved, Quality-Gate-
// checked "same machinery as everything else"). validatePackSeed runs first,
// same structural checks createPackDraft already applies, so the actor gets
// real errors before the acting-badge/dispatch machinery even runs — not
// wired as a new Quality Gate criteria type (no quality_gates row exists for
// generic Deliverable In Progress -> Approved, and per the plan's decision,
// none should fork by category), so this validation happens directly here,
// the same place validatePackSeed is already called from today.
export async function submitForReview(input: { deliverableId: string; kind: SchemaDefinitionEntityKind; actorId: string; actorRole: string }): Promise<AuthoringActionResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, errors: ["Deliverable not found"] };

  const { data: content } = await deliverableAuthoringContentDB.findByDeliverableId(input.deliverableId);
  if (!content) return { ok: false, errors: ["no authoring content found for this Deliverable"] };

  const validation = await validateAuthoredContent(input.kind, content.content);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  await ensureAuthoringBadge(input.actorId, "approver", input.kind);

  const result = await transitionDeliverable({ deliverableId: input.deliverableId, targetState: "Approved", actorId: input.actorId, actorRole: input.actorRole });
  if (!result.ok) return { ok: false, errors: [describeTransitionFailure(result)] };
  return { ok: true, deliverable: result.deliverable };
}

// "Publish" (plan's Core Principle: reaching Baselined calls publishPack —
// or the Template/Profile/Transition-Definition equivalent once those are
// wired — as glue on that one transition, not a new mechanism). Validated
// once more before the Deliverable is allowed to reach Baselined, so a
// Baselined authoring Deliverable with no real Pack behind it (publishPack
// failing after the fact) stays a rare, surfaced failure rather than the
// common case.
//
// Approved -> Baselined already carries a real, generic Quality Gate since
// Phase 5 ("requires_accepted_evidence_or_approved_decision") that applies
// to every Deliverable reaching Baselined, authoring ones included — the
// SDK UI Layer Plan's own "no per-category Quality Gate overrides" decision
// (Transition Definition section) means an authoring Deliverable does not
// get to skip it, it has to actually satisfy it. The structural + referential
// validation that just ran above *is* the evidence that this content is fit
// to publish, so it's recorded as real Evidence and walked to Accepted here
// — the same mechanism (and the same Collected -> Validated -> Accepted
// walk) tests/trust-pipeline.test.ts and tests/quality-telemetry.test.ts
// already use for any other Deliverable reaching Baselined, not a bypass.
export async function publishAuthoredContent(input: { deliverableId: string; kind: SchemaDefinitionEntityKind; actorId: string; actorRole: string }): Promise<AuthoringActionResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, errors: ["Deliverable not found"] };

  const { data: content } = await deliverableAuthoringContentDB.findByDeliverableId(input.deliverableId);
  if (!content) return { ok: false, errors: ["no authoring content found for this Deliverable"] };

  const validation = await validateAuthoredContent(input.kind, content.content);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const evidence = await createEvidence({
    seuId: deliverable.seu_id,
    relatedObjectType: "Deliverable",
    relatedObjectId: deliverable.id,
    category: "Validation",
    title: `${AUTHORING_CATEGORY[input.kind]} structural + referential validation passed`,
    source: "sdkAuthoring.publishAuthoredContent",
  });
  const toValidated = await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: input.actorRole });
  if (!toValidated.ok) return { ok: false, errors: [`could not record validation evidence: ${toValidated.reason}`] };
  const toAccepted = await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: input.actorRole });
  if (!toAccepted.ok) return { ok: false, errors: [`could not accept validation evidence: ${toAccepted.reason}`] };

  const result = await transitionDeliverable({ deliverableId: input.deliverableId, targetState: "Baselined", actorId: input.actorId, actorRole: input.actorRole });
  if (!result.ok) return { ok: false, errors: [describeTransitionFailure(result)] };

  const published = await publishAuthoredContentByKind(input.kind, content.content);
  if (!published.ok) return { ok: false, errors: published.errors };

  return { ok: true, deliverable: result.deliverable };
}

function describeTransitionFailure(result: TransitionDeliverableResult): string {
  if (result.ok) return "";
  if (result.reason === "quality_gate_blocked" || result.reason === "authority_denied" || result.reason === "policy_blocked" || result.reason === "no_transition_definition" || result.reason === "dispatch_deferred") {
    return `${result.reason}: ${result.detail}`;
  }
  return result.reason;
}
