import { templatesDB } from "../../../dblayer/templatesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { TemplateDeliverableSeed, TemplateRow } from "../../../dblayer/seuTypes.js";

export interface TemplateCandidate {
  id: string;
  code: string;
  name: string;
  satisfies: boolean;
  missingCapabilities: string[];
  requiredCapabilityCount: number;
}

// Ch.6 §11 — a Template is a candidate only if it supports every Capability
// the Objective requires (its required-Capability set is a superset of the
// requested codes) — a Template offering more than requested is a valid,
// intentional match, not a mismatch.
//
// Bug fix: with only one Template ever seeded, the first satisfying
// candidate was always the only correct one, so picking .find(c =>
// c.satisfies) off an alphabetically-ordered list never mattered. Once a
// second, legitimately-satisfying Template existed (one requiring more
// Capabilities than asked for), alphabetical order could pick the loosest
// match over the tightest one. The superset filter above is correct and
// unchanged — the fix is choosing among multiple satisfying candidates by
// ascending required-Capability count (tightest fit first), not by code.
export async function findCandidateTemplates(capabilityCodes: string[]): Promise<TemplateCandidate[]> {
  const { data: templates, error } = await templatesDB.findAllActive();
  if (error) throw error;

  const candidates: TemplateCandidate[] = [];
  for (const template of templates ?? []) {
    const { data: required } = await templatesDB.getRequiredCapabilities(template.id);
    const templateCodes = new Set((required ?? []).map((c) => c.code));
    const missingCapabilities = capabilityCodes.filter((code) => !templateCodes.has(code));
    candidates.push({
      id: template.id,
      code: template.code,
      name: template.name,
      satisfies: missingCapabilities.length === 0,
      missingCapabilities,
      requiredCapabilityCount: templateCodes.size,
    });
  }
  return candidates.sort((a, b) => a.requiredCapabilityCount - b.requiredCapabilityCount);
}

// SDK UI Layer Plan — the SDK's own "structural + referential" check for
// Template, same reasoning as validatePackSeed (core/packs.ts). Ch.6
// grounding: requiredCapabilityCodes/mandatoryPackCodes/deliverableCatalogue
// are the grammar implemented now (see the plan's Template section).
export interface TemplateSeedInput {
  code: string;
  name: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
}

export type TemplateValidationResult = { ok: true } | { ok: false; errors: string[] };

export async function validateTemplateSeed(seed: TemplateSeedInput): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");

  for (const code of seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (!data?.[0]) errors.push(`requiredCapabilityCodes references unknown Capability "${code}"`);
  }
  for (const code of seed.mandatoryPackCodes ?? []) {
    const { data } = await packsDB.findByCode(code);
    if (!data) errors.push(`mandatoryPackCodes references unknown Pack code "${code}"`);
  }

  const seenDeliverableCodes = new Set<string>();
  for (const entry of seed.deliverableCatalogue ?? []) {
    if (!entry.code?.trim()) errors.push("deliverableCatalogue entry is missing a code");
    if (!entry.name?.trim()) errors.push(`deliverableCatalogue entry "${entry.code}" is missing a name`);
    if (!entry.category?.trim()) errors.push(`deliverableCatalogue entry "${entry.code}" is missing a category`);
    if (entry.producingCapabilityCode && !(seed.requiredCapabilityCodes ?? []).includes(entry.producingCapabilityCode)) {
      errors.push(`deliverableCatalogue entry "${entry.code}" producingCapabilityCode "${entry.producingCapabilityCode}" is not in requiredCapabilityCodes`);
    }
    // Referential check the schema itself can't express (SDK UI Layer Plan):
    // dependsOnDeliverableCodes must reference an entry earlier in this same
    // catalogue, checked live, not as a grammar constraint.
    for (const dep of entry.dependsOnDeliverableCodes ?? []) {
      if (!seenDeliverableCodes.has(dep)) {
        errors.push(`deliverableCatalogue entry "${entry.code}" dependsOnDeliverableCodes references "${dep}", which must appear earlier in the catalogue`);
      }
    }
    if (entry.code) seenDeliverableCodes.add(entry.code);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PublishTemplateResult = { ok: true; templateId: string } | { ok: false; errors: string[] };

// Not immutably versioned the way Pack is (Ch.41 VM-002) — templates.upsert
// still overwrites the same code's row in place. Retrofitting Template with
// real (code, version) immutability, matching Pack, is real, separate scope
// this pass doesn't take on; logged in Open Design Questions.md.
export async function publishTemplate(seed: TemplateSeedInput): Promise<PublishTemplateResult> {
  const validation = await validateTemplateSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: template, error } = await templatesDB.upsert({ code: seed.code, name: seed.name, deliverableCatalogue: seed.deliverableCatalogue });
  if (error || !template) return { ok: false, errors: [(error ?? new Error("failed to upsert template")).message] };

  const capabilityIds: string[] = [];
  for (const code of seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (data?.[0]) capabilityIds.push(data[0].id);
  }
  await templatesDB.setRequiredCapabilities(template.id, capabilityIds);
  await templatesDB.setMandatoryPacks(template.id, seed.mandatoryPackCodes ?? []);

  return { ok: true, templateId: template.id };
}

// Entity-direct authoring (bug fix correcting CR-014): a governed status
// transition on a Template, authorised on its own noun × verb (Draft -> Active
// is verb `publish` → template_publish) under the REAL actor, with the actor +
// badge captured on the event. Mirrors transitionPack — no Deliverable
// indirection, no system actor.
export type TransitionTemplateResult = { ok: true; template: TemplateRow } | { ok: false; reason: string; detail?: string };

export async function transitionTemplate(input: { templateId: string; targetState: TemplateRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionTemplateResult> {
  const { data: template } = await templatesDB.findById(input.templateId);
  if (!template) return { ok: false, reason: "not_found" };
  const fromState = template.status;
  const gate = await transitionEngine.evaluate({ entityType: "Template", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { template } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Template ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }
  const { data: updated, error } = await templatesDB.updateStatus(template.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update template status");
  await eventBus.publish({
    eventType: "TemplateTransitioned",
    originatingObjectType: "Template",
    originatingObjectId: template.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: template.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, template: updated };
}

// Publish a Draft Template authored entity-direct: validate the authored seed,
// materialise it onto the Draft row + join tables, then run the governed
// Draft -> Active transition under the real actor.
export async function publishTemplateDraft(input: { templateId: string; seed: TemplateSeedInput; actorRole: string; actorId?: string }): Promise<PublishTemplateResult> {
  const validation = await validateTemplateSeed(input.seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const capabilityIds: string[] = [];
  for (const code of input.seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (data?.[0]) capabilityIds.push(data[0].id);
  }
  await templatesDB.setDeliverableCatalogue(input.templateId, input.seed.deliverableCatalogue ?? []);
  await templatesDB.setRequiredCapabilities(input.templateId, capabilityIds);
  await templatesDB.setMandatoryPacks(input.templateId, input.seed.mandatoryPackCodes ?? []);

  const transitioned = await transitionTemplate({ templateId: input.templateId, targetState: "Active", actorRole: input.actorRole, actorId: input.actorId });
  if (!transitioned.ok) return { ok: false, errors: [`${transitioned.reason}${transitioned.detail ? `: ${transitioned.detail}` : ""}`] };

  return { ok: true, templateId: input.templateId };
}
