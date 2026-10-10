import { packsDB } from "../../../dblayer/packsDB.js";
import { assertCanonicalCategory, validateOntologyFieldsAgainstSchema, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { backfillAuthorityRuleCode, backfillPolicyCode } from "../../../dblayer/seed/seedTransitionDefinitions.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { reviewGatesDB } from "../../../dblayer/reviewGatesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { listActiveNouns } from "./authorityVocabulary.js";
import { listTransitionsForEntityType } from "./policyDefinitions.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import type { PackCategory, PackClassification, PackContributions, PackRow, PolicyCondition, PolicyDefinitionRow, PolicyScope, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 

function parseGovernedTransition(value: string | undefined): { entityType: TransitionEntityType; fromState: string; toState: string } | null {
  const parts = (value ?? "").split("|");
  if (parts.length !== 3 || parts.some((p) => !p.trim())) return null;
  const [entityType, fromState, toState] = parts;
  return { entityType: entityType as TransitionEntityType, fromState, toState };
}

async function deliverableNamesFromCapabilityCodes(capabilityCodes: string[], viewerTenantId: string): Promise<Set<string>> {
  const { data: definitions } = await serviceDefinitionsDB.findAllVisibleTo(viewerTenantId);
  const names = new Set<string>();
  const capSet = new Set(capabilityCodes);
  for (const def of definitions ?? []) {
    if (def.status !== "Active" || !capSet.has(def.capability_code)) continue;
    for (const code of (def.outputs as unknown as string[] | null) ?? []) names.add(code);
  }
  return names;
}

function governedTransitionsFor(scope: PolicyScope, applicabilityDeliverables: PolicyCondition["applicabilityDeliverables"]): Array<{ governedTransition: string | null; deliverableNames: string[]; governingCondition: Record<string, unknown> | null }> {
  if (scope === "Eligibility") {
    if (!applicabilityDeliverables.length) return [{ governedTransition: null, deliverableNames: [], governingCondition: null }];
    return applicabilityDeliverables.map((row) => ({ governedTransition: null, deliverableNames: [row.name], governingCondition: row.governingCondition }));
  }
  if (!applicabilityDeliverables.length) return [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames: [], governingCondition: null }];
  return applicabilityDeliverables.flatMap((row) =>
    row.transitions.length
      ? row.transitions.map((t) => ({ governedTransition: t, deliverableNames: [row.name], governingCondition: row.governingCondition }))
      : [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames: [row.name], governingCondition: row.governingCondition }]
  );
}

const DEFAULT_CONDITION: PolicyCondition = {
  statement: "", severity: "Medium", applicabilityDeliverables: [],
  requiredEvidence: { title: "", category: "", description: "", collectionMethod: "" }, relatedObligations: [], exceptionRules: [],
};

async function validateChecklistIds(checklistIds: string[] | undefined, seed: PackSeedInput, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of checklistIds ?? []) {
    const samePackMatch = (seed.contributions.checklists ?? []).some((cl) => cl.name === ref);
    if (samePackMatch) continue;
    const { data: existing } = await checklistsDB.findById(ref);
    if (!existing) {
      errors.push(`${context} references unknown Checklist "${ref}" — must be either this Pack's own declared checklist name, or a real, already-published Checklist's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(existing.originating_pack_id);
    if (!owningPack || owningPack.code !== seed.code) {
      errors.push(`${context} references Checklist "${existing.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${seed.code}"; a Checklist may only be referenced by Packs sharing the same code`);
    }
  }
  return errors;
}

async function validatePolicyCodes(policyRefs: string[] | undefined, seed: PackSeedInput, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of policyRefs ?? []) {
    const samePackMatch = (seed.contributions.policies ?? []).includes(ref);
    if (samePackMatch) continue;
    const { data: existing } = await policiesDB.findByIds([ref]);
    const policy = existing?.[0];
    if (!policy) {
      errors.push(`${context} references unknown Policy "${ref}" — must be either this Pack's own declared policy code, or a real, already-published Policy's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(policy.originating_pack_id ?? "");
    if (!owningPack || owningPack.code !== seed.code) {
      errors.push(`${context} references Policy "${policy.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${seed.code}"; a Policy may only be referenced by Packs sharing the same code`);
    }
  }
  return errors;
}

export type PackDependencyType = "required" | "optional" | "conditional" | "incompatible";
export interface PackSeedInput {
  code: string;
  name: string;
  category: PackCategory;
  packVersion: string;
  installationClassification: PackClassification;
  contributions: PackContributions;
  dependencies?: Array<{ packCode: string; version: string; type: PackDependencyType }>;
  compositionSources?: Array<{ packCode: string }>;
  tenantId: string;
  description?: string;
  owner?: string;
  publisher?: string;
  compositionStrategy?: string;
  supportedPlatformVersion?: string;
  minSupportedPlatformVersion?: string;
  maxSupportedPlatformVersion?: string;
  incompatiblePackVersions?: string;
  migrationGuidance?: string;
}

const PACK_METADATA_KEYS = [
  "description", "owner", "publisher", "compositionStrategy", "supportedPlatformVersion",
  "minSupportedPlatformVersion", "maxSupportedPlatformVersion", "incompatiblePackVersions", "migrationGuidance",
] as const;

export function packMetadataFromSeed(seed: PackSeedInput): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const key of PACK_METADATA_KEYS) {
    const v = seed[key];
    if (typeof v === "string" && v.trim()) meta[key] = v.trim();
  }
  return meta;
}

export async function findActiveCompositionSource(code: string, tenantId: string): Promise<PackRow | null> {
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { data: ownTenant } = await packsDB.findActiveByCode(code, tenantId);
  if (ownTenant) return ownTenant;
  if (tenantId === PLATFORM_TENANT_ID) return null;
  const { data: platform } = await packsDB.findActiveByCode(code, PLATFORM_TENANT_ID);
  return platform ?? null;
}

const PACK_DEPENDENCY_TYPES: PackDependencyType[] = ["required", "optional", "conditional", "incompatible"];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export type PackValidationResult = { ok: true } | { ok: false; errors: string[] };

export async function validatePackSeed(seed: PackSeedInput, options?: { skipComposableChecks?: boolean }): Promise<PackValidationResult> {
  const errors: string[] = [];

  if (!seed.name?.trim()) errors.push("name is required");
  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? (await getPlatformTenantId()) };
  const { data: packSchemaRow } = await schemaDefinitionsDB.findLatest("Pack");
  if (packSchemaRow) {
    const packSchema = packSchemaRow.schema as JsonSchemaDocument;
    const ontologyContent = {
      code: seed.code, category: seed.category,
      contributionObligationDefinitions: seed.contributions.obligationDefinitions,
      contributionEngineeringCapital: seed.contributions.engineeringCapital,
      contributionQualityGates: seed.contributions.qualityGates,
    };
    errors.push(...(await validateOntologyFieldsAgainstSchema(packSchema, ontologyContent, ontologyViewer)));
    if (!options?.skipComposableChecks) {
      errors.push(...(await validateComposableFieldsAgainstSchema(packSchema, ontologyContent, ontologyViewer)));
    }
  }
  if (!SEMVER_RE.test(seed.packVersion ?? "")) errors.push(`packVersion must be semver (x.y.z), got: "${seed.packVersion}"`);
  try {
    await assertCanonicalCategory("installation-classification", seed.installationClassification ?? "", ontologyViewer);
  } catch (err) {
    errors.push((err as Error).message);
  }
  if (seed.compositionStrategy?.trim()) {
    try {
      await assertCanonicalCategory("composition-strategy", seed.compositionStrategy, ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
    if (seed.compositionStrategy === "conflict-detection") {
      errors.push(`"Conflict Detection" is not an independent Composition Strategy — it activates automatically inside Merge/Union. Choose one of the other strategies.`);
    } else {
      const req = compositionEngine.strategyRequirements(seed.compositionStrategy);
      const sourceCodes = (seed.compositionSources ?? []).map((s) => s.packCode).filter((c) => c?.trim());
      if (sourceCodes.length < req.minSources || (req.maxSources != null && sourceCodes.length > req.maxSources)) {
        const arity = req.maxSources == null ? `at least ${req.minSources}` : req.minSources === req.maxSources ? `exactly ${req.minSources}` : `${req.minSources}-${req.maxSources}`;
        errors.push(`Composition Strategy "${seed.compositionStrategy}" requires ${arity} composition source(s), got ${sourceCodes.length}.`);
      }
      if (req.sameCodeRequired && new Set(sourceCodes).size > 1) {
        errors.push(`Composition Strategy "${seed.compositionStrategy}" requires every composition source to share the same code — got: ${[...new Set(sourceCodes)].join(", ")}.`);
      }
      for (const code of sourceCodes) {
        const sourcePack = await findActiveCompositionSource(code, seed.tenantId ?? (await getPlatformTenantId()));
        if (!sourcePack) errors.push(`composition source Pack "${code}" has no Active Version visible to this tenant.`);
      }
    }
  }

  function checkDuplicates(label: string, items: Array<{ code: string }> | undefined): void {
    const seen = new Set<string>();
    for (const item of items ?? []) {
      if (seen.has(item.code)) errors.push(`duplicate ${label} code within Pack: "${item.code}"`);
      seen.add(item.code);
    }
  }
  checkDuplicates("capability", seed.contributions.capabilities);
  for (const cap of seed.contributions.capabilities ?? []) {
    try {
      await assertCanonicalCategory("capability-name", cap.code ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  checkDuplicates("service", seed.contributions.services);
  checkDuplicates("authority rule", seed.contributions.authorityRules);
  {
    const seenPolicyCodes = new Set<string>();
    for (const code of seed.contributions.policies ?? []) {
      if (seenPolicyCodes.has(code)) errors.push(`duplicate policy code within Pack: "${code}"`);
      seenPolicyCodes.add(code);
    }
  }

  const seenGateSlots = new Set<string>();
  for (const gate of seed.contributions.qualityGates ?? []) {
    const slotKey = `${gate.governedTransition ?? ""}::${gate.category ?? ""}`;
    if (seenGateSlots.has(slotKey)) errors.push(`duplicate quality gate within Pack: "${gate.governedTransition}" [${gate.category}] is targeted by more than one contribution`);
    seenGateSlots.add(slotKey);
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    const scope = parseGovernedTransition(gate.governedTransition);
    if (!scope) {
      errors.push(`quality gate "${gate.name}" has an invalid governedTransition — expected "EntityType|fromState|toState"`);
    } else {
      const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
      if (!definition) {
        errors.push(`quality gate "${gate.name}" references a transition that doesn't exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
      }
    }
    if (gate.criteriaType === "requires_active_policy") {
      if (!gate.requiredPolicyCodes?.length) {
        errors.push(`quality gate "${gate.name}" has criteriaType requires_active_policy but no requiredPolicyCodes`);
      } else {
        for (const err of await validatePolicyCodes(gate.requiredPolicyCodes, seed, `quality gate "${gate.name}"`)) errors.push(err);
      }
    }
    if (gate.criteriaType === "requires_accepted_review") {
      if (!gate.deliverableName?.trim()) {
        errors.push(`quality gate "${gate.name}" has criteriaType requires_accepted_review but no deliverableName`);
      } else if (!(seed.contributions.reviewGates ?? []).some((rg) => rg.code === gate.deliverableName)) {
        errors.push(`quality gate "${gate.name}" references unknown Review Gate "${gate.deliverableName}" — the Review Gate must be declared in this same Pack's contributions`);
      }
    }
    for (const err of await validateChecklistIds(gate.checklistIds, seed, `quality gate "${gate.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(gate.recommendedChecklistIds, seed, `quality gate "${gate.name}"`)) errors.push(err);
  }

  const seenReviewGateSlots = new Set<string>();
  for (const rg of seed.contributions.reviewGates ?? []) {
    if (!rg.code?.trim()) errors.push("review gate is missing a code (deliverable type)");
    if (!rg.name?.trim()) errors.push(`review gate "${rg.code}" is missing a name`);
    const scope = parseGovernedTransition(rg.governedTransition);
    if (!scope) {
      errors.push(`review gate "${rg.name}" has an invalid governedTransition — expected "EntityType|fromState|toState"`);
    } else {
      const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
      if (!definition) errors.push(`review gate "${rg.name}" references a transition that doesn't exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
    }
    const slotKey = `${rg.governedTransition ?? ""}::${rg.code ?? ""}`;
    if (seenReviewGateSlots.has(slotKey)) errors.push(`duplicate review gate within Pack: "${rg.governedTransition}" [${rg.code}] is targeted by more than one contribution`);
    seenReviewGateSlots.add(slotKey);
    for (const err of await validateChecklistIds(rg.checklistIds, seed, `review gate "${rg.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(rg.recommendedChecklistIds, seed, `review gate "${rg.name}"`)) errors.push(err);
  }

  const seenChecklistNames = new Set<string>();
  for (const cl of seed.contributions.checklists ?? []) {
    if (!cl.name?.trim()) errors.push("checklist is missing a name");
    else if (seenChecklistNames.has(cl.name)) errors.push(`duplicate checklist name within Pack: "${cl.name}"`);
    else seenChecklistNames.add(cl.name);
    if (!cl.items?.length) {
      errors.push(`checklist "${cl.name}" has no items`);
    } else {
      cl.items.forEach((item, i) => {
        if (!item.statement?.trim()) errors.push(`checklist "${cl.name}" item ${i + 1} is missing a statement`);
        if (!!item.configurableKey?.trim() !== !!item.configurableValue?.trim()) {
          errors.push(`checklist "${cl.name}" item ${i + 1} has ${item.configurableKey?.trim() ? "a Configurable Dimension but no Configurable Value" : "a Configurable Value but no Configurable Dimension"}`);
        }
      });
    }
  }

  const packCapabilityCodes = (seed.contributions.capabilities ?? []).map((c) => c.code);
  const packDeliverableNames = await deliverableNamesFromCapabilityCodes(packCapabilityCodes, ontologyViewer.tenantId ?? (await getPlatformTenantId()));
  for (const policyCode of seed.contributions.policies ?? []) {
    if (!policyCode?.trim()) {
      errors.push("policy is missing a code");
      continue;
    }
    const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyCode, ontologyViewer.tenantId ?? (await getPlatformTenantId()));
    if (!definition) {
      errors.push(`policy "${policyCode}" does not resolve to an Active Policy Definition visible to this tenant`);
      continue;
    }
    const definitionDeliverableNames =
      definition.scope === "Eligibility"
        ? new Set<string>()
        : new Set(
            definition.conditions.flatMap((c) =>
              (c.applicabilityDeliverables ?? [])
                .filter((row) => !row.transitions.some((t) => t.startsWith("SEU|")) && row.name !== "SEU")
                .map((row) => row.name)
            )
          );
    if (definitionDeliverableNames.size > 0 && ![...definitionDeliverableNames].some((d) => packDeliverableNames.has(d))) {
      errors.push(`policy "${policyCode}" does not govern any deliverable-name produced by this Pack's own declared Capabilities`);
    }
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    for (const name of gate.applicabilityDeliverableNames ?? []) {
      try {
        await assertCanonicalCategory("deliverable-name", name, ontologyViewer);
      } catch (err) {
        errors.push(`quality gate "${gate.name}"'s applicabilityDeliverableNames: ${(err as Error).message}`);
      }
    }
  }

  const seenObligationCodes = new Set<string>();
  const validNouns = new Set((await listActiveNouns()).map((n) => n.code));
  for (const ob of seed.contributions.obligationDefinitions ?? []) {
    if (!ob.code?.trim()) errors.push("obligation definition is missing a code");
    else if (seenObligationCodes.has(ob.code)) errors.push(`duplicate obligation definition code within Pack: "${ob.code}"`);
    else seenObligationCodes.add(ob.code);
    if (ob.origin) {
      try {
        await assertCanonicalCategory("category:obligation-origin", ob.origin, ontologyViewer);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
    for (const [d, row] of (ob.applicabilityDeliverables ?? []).entries()) {
      const dLabel = `obligation definition "${ob.code ?? "?"}" applicabilityDeliverables ${d + 1}`;
      if (!row.name?.trim()) {
        errors.push(`${dLabel}: name is required`);
        continue;
      }
      if (!validNouns.has(row.name)) {
        errors.push(`${dLabel}: name "${row.name}" is not one of this platform's real active Authority Vocabulary nouns (${[...validNouns].join(", ")})`);
      }
      if (row.transitions.length) {
        const validTransitions = new Set(await listTransitionsForEntityType(row.name));
        for (const transition of row.transitions) {
          if (!validTransitions.has(transition)) errors.push(`${dLabel}: transition "${transition}" is not one of ${row.name}'s real transitions (${[...validTransitions].join(", ")})`);
        }
      }
    }
  }

  for (const ec of seed.contributions.engineeringCapital ?? []) {
    if (!ec.url?.trim()) errors.push("engineering capital entry is missing a url");
  }

  for (const comp of seed.contributions.competencies ?? []) {
    try {
      await assertCanonicalCategory("category:pack", comp.dimension ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
      continue;
    }
    try {
      await assertCanonicalCategory((comp.dimension ?? "").toLowerCase(), comp.value ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  if ((seed.category === "Technology" || seed.category === "Domain") && (seed.contributions.competencies ?? []).length === 0) {
    errors.push(`a ${seed.category} Pack must declare at least one Competency (contributionCompetencies)`);
  }

  const capabilityCodes = new Set((seed.contributions.capabilities ?? []).map((c) => c.code));
  for (const svc of seed.contributions.services ?? []) {
    const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(svc.code ?? "", ontologyViewer.tenantId ?? (await getPlatformTenantId()));
    if (!definition) {
      errors.push(`service "${svc.code}" does not resolve to an Active Service Definition visible to this tenant`);
      continue;
    }
    if (!capabilityCodes.has(definition.capability_code)) {
      errors.push(`service "${svc.code}" is aligned to capability "${definition.capability_code}", which is not declared in this same Pack's own Capabilities`);
    }
    const definitionLevelCodes = new Set(definition.service_level.map((sl) => sl.code));
    for (const override of svc.serviceLevel ?? []) {
      if (!definitionLevelCodes.has(override.code)) {
        errors.push(`service "${svc.code}" overrides service level "${override.code}", which the Service Definition does not declare`);
      }
      if (typeof override.target !== "number" || Number.isNaN(override.target)) {
        errors.push(`service "${svc.code}" service level "${override.code}" target must be a number`);
      }
    }
  }

  for (const dep of seed.dependencies ?? []) {
    if (!PACK_DEPENDENCY_TYPES.includes(dep.type)) errors.push(`dependency "${dep.packCode}" has invalid type "${dep.type}" (${PACK_DEPENDENCY_TYPES.join(", ")})`);
    if (dep.type === "required") {
      const { data: depPack } = await packsDB.findByCode(dep.packCode);
      if (!depPack) errors.push(`required dependency not resolved: Pack "${dep.packCode}" not found in the Registry`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export interface PublishPackResult {
  ok: boolean;
  pack?: PackRow;
  alreadyPublished?: boolean;
  supersededPack?: PackRow | null;
  errors?: string[];
}

export async function createPackDraft(seed: PackSeedInput, authorId: string, authorBadge: string): Promise<{ ok: true; pack: PackRow; alreadyExists: boolean } | { ok: false; errors: string[] }> {
  const validation = await validatePackSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: existing } = await packsDB.findByCodeAndVersion(seed.code, seed.packVersion, seed.tenantId ?? (await getPlatformTenantId()));
  if (existing) {
    await materializeContributions(existing, seed);
    return { ok: true, pack: existing, alreadyExists: true };
  }

  const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
  if (!packSchema) return { ok: false, errors: [`no schema_definitions grammar for Pack`] };
  const { data: pack, error } = await packsDB.create({ ...seed, metadata: packMetadataFromSeed(seed), schemaDefinitionId: packSchema.id, authoredBy: authorId, authorBadge, tenantId: seed.tenantId ?? (await getPlatformTenantId()) });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create pack")).message] };

  await materializeContributions(pack, seed);

  await eventBus.publish({
    eventType: "PackRegistered",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: authorId,
    authorityBadge: authorBadge,
    payload: { code: pack.code, packVersion: pack.pack_version },
  });

  return { ok: true, pack, alreadyExists: false };
}

export async function advancePackLifecycle(pack: PackRow, actorRole: string, actorId: string, options?: { activate?: boolean }): Promise<PublishPackResult> {
  let currentPack = pack;

  if (currentPack.status === "Draft") {
    for (const targetState of ["Validated", "Published"]) {
      const result = await transitionPack({ packId: currentPack.id, targetState, actorRole, actorId });
      if (!result.ok) return { ok: false, pack: currentPack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
      currentPack = result.pack;
    }
  }

  let supersededPack: PackRow | null = null;
  if (options?.activate && currentPack.status === "Published") {
    const { data: previousActive } = await packsDB.findActiveByCode(currentPack.code, currentPack.tenant_id);
    const activateResult = await transitionPack({ packId: currentPack.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return { ok: false, pack: currentPack, errors: [`transition to "Active" failed: ${"detail" in activateResult ? activateResult.detail : activateResult.reason}`] };
    currentPack = activateResult.pack;

    if (previousActive && previousActive.id !== currentPack.id) {
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Retired", actorRole, actorId });
      if (supersedeResult.ok) supersededPack = supersedeResult.pack;
    }
  }

  return { ok: true, pack: currentPack, supersededPack };
}

const AUTHORING_NEXT_STATE: Partial<Record<PackRow["status"], PackRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
};

export async function advancePackOneStep(pack: PackRow, actorRole: string, actorId: string): Promise<PublishPackResult> {
  const targetState = AUTHORING_NEXT_STATE[pack.status];
  if (!targetState) return { ok: false, pack, errors: [`Pack is already ${pack.status} — no further authoring step`] };

  if (targetState === "Active") {
    const { data: previousActive } = await packsDB.findActiveByCode(pack.code, pack.tenant_id);
    const activateResult = await transitionPack({ packId: pack.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return { ok: false, pack, errors: [`transition to "Active" failed: ${"detail" in activateResult ? activateResult.detail : activateResult.reason}`] };
    let supersededPack: PackRow | null = null;
    if (previousActive && previousActive.id !== activateResult.pack.id) {
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Retired", actorRole, actorId });
      if (supersedeResult.ok) supersededPack = supersedeResult.pack;
    }
    return { ok: true, pack: activateResult.pack, supersededPack };
  }

  const result = await transitionPack({ packId: pack.id, targetState, actorRole, actorId });
  if (!result.ok) return { ok: false, pack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
  return { ok: true, pack: result.pack };
}

export async function publishPack(input: { seed: PackSeedInput; actorRole: string; actorId: string; activate?: boolean }): Promise<PublishPackResult> {
  const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId, requiredBadge: "pack_define" });
  if (!auth.allowed) return { ok: false, errors: [`actor "${input.actorId}" does not hold pack_define`] };
  const { data: packMaster } = await participantsMasterDB.findById(input.actorId);
  if (!packMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const authorBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? "pack_define");

  const draft = await createPackDraft(input.seed, packMaster.id, authorBadge);
  if (!draft.ok) return { ok: false, errors: draft.errors };

  const advanced = await advancePackLifecycle(draft.pack, input.actorRole, input.actorId, { activate: input.activate });
  return { ...advanced, alreadyPublished: draft.alreadyExists };
}

async function materializeContributions(pack: PackRow, seed: PackSeedInput): Promise<void> {
  const capabilityIdByCode = new Map<string, string>();
  for (const cap of seed.contributions.capabilities ?? []) {
    const { data: concept } = await ontologyDB.findConcept("capability-name", cap.code, { isRoot: false, tenantId: pack.tenant_id });
    const { data: capability, error } = await capabilitiesDB.upsertFromPack({
      code: cap.code,
      name: concept?.default_label ?? cap.code,
      description: concept?.description ?? null,
      version: pack.pack_version,
      originatingPackId: pack.id,
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error || !capability) throw error ?? new Error(`capability upsert failed: ${cap.code}`);
    capabilityIdByCode.set(cap.code, capability.id);
  }

  for (const svc of seed.contributions.services ?? []) {
    const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(svc.code, pack.tenant_id);
    if (!definition) throw new Error(`service ${svc.code} does not resolve to an Active Service Definition`);
    const capabilityId = capabilityIdByCode.get(definition.capability_code);
    if (!capabilityId) throw new Error(`service ${svc.code} references unknown capability ${definition.capability_code}`);
    const overrideByCode = new Map<string, number>();
    for (const ov of svc.serviceLevel ?? []) overrideByCode.set(ov.code, ov.target);
    const mergedServiceLevel = definition.service_level.map((base) => ({
      ...base,
      target: overrideByCode.has(base.code) ? overrideByCode.get(base.code)! : base.target,
    }));
    const { error } = await servicesDB.upsertFromPack({
      code: svc.code,
      providingCapabilityId: capabilityId,
      name: definition.name,
      contractDescription: definition.purpose ?? "",
      serviceLevel: mergedServiceLevel,
      originatingPackId: pack.id,
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error) throw error;
  }

  for (const rule of seed.contributions.authorityRules ?? []) {
    const { data: createdRule, error } = await authorityRulesDB.upsert({
      code: rule.code,
      governedTransition: rule.governedTransition,
      authorisedRole: rule.authorisedRole,
      originatingPackId: pack.id,
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error || !createdRule) throw error ?? new Error(`authority rule upsert failed: ${rule.code}`);
    await backfillAuthorityRuleCode(rule.code, createdRule.id);
  }

  const policyIdByCode = new Map<string, string[]>();
  for (const policyCode of seed.contributions.policies ?? []) {
    const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyCode, pack.tenant_id);
    if (!definition) throw new Error(`policy ${policyCode} does not resolve to an Active Policy Definition`);
    const scope: PolicyScope = definition.scope ?? "Transition";
    const conditions = definition.conditions.length ? definition.conditions : [DEFAULT_CONDITION];
    const createdIds: string[] = [];
    for (const [condIndex, cond] of conditions.entries()) {
      const materializedRows = governedTransitionsFor(scope, cond.applicabilityDeliverables ?? []);
      const fansOut = conditions.length > 1 || materializedRows.length > 1;
      for (const { governedTransition, deliverableNames, governingCondition } of materializedRows) {
        const code = fansOut ? `${policyCode}::${condIndex}::${governedTransition ?? "none"}::${deliverableNames[0] ?? ""}` : policyCode;
        const { data: created, error } = await policiesDB.upsert({
          code,
          name: definition.name,
          category: definition.category,
          constraintType: definition.constraint_type,
          scope,
          governedTransition,
          condition: governingCondition ?? { type: "always_true" },
          severity: cond.severity || "Medium",
          originatingPackId: pack.id,
          applicabilityDeliverableNames: deliverableNames,
          authorId: pack.authored_by,
          authorBadge: pack.author_badge,
        });
        if (error || !created) throw error ?? new Error(`policy upsert failed: ${code}`);
        createdIds.push(created.id);
        await backfillPolicyCode(policyCode, created.id);
      }
    }
    policyIdByCode.set(policyCode, createdIds);
  }
  const resolvePolicyCodes = (refs: string[] | undefined): string[] => (refs ?? []).flatMap((ref) => policyIdByCode.get(ref) ?? [ref]);

  const checklistIdByName = new Map<string, string>();
  for (const cl of seed.contributions.checklists ?? []) {
    const { data: checklist, error } = await checklistsDB.upsert({
      name: cl.name,
      description: cl.description,
      items: cl.items,
      originatingPackId: pack.id,
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error || !checklist) throw error ?? new Error(`checklist upsert failed: ${cl.name}`);
    checklistIdByName.set(cl.name, checklist.id);
  }
  const resolveChecklistIds = (ids: string[] | undefined): string[] => (ids ?? []).map((ref) => checklistIdByName.get(ref) ?? ref);

  const reviewGateIdByCode = new Map<string, string>();
  for (const rg of seed.contributions.reviewGates ?? []) {
    const scope = parseGovernedTransition(rg.governedTransition);
    if (!scope) throw new Error(`review gate "${rg.name}" has an invalid governedTransition (validatePackSeed should have caught this)`);
    const { data: reviewGate, error } = await reviewGatesDB.upsert({
      code: rg.code,
      name: rg.name,
      entityType: scope.entityType,
      fromState: scope.fromState,
      toState: scope.toState,
      originatingPackId: pack.id,
      checklistIds: resolveChecklistIds(rg.checklistIds),
      recommendedChecklistIds: resolveChecklistIds(rg.recommendedChecklistIds),
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error || !reviewGate) throw error ?? new Error(`review gate upsert failed: ${rg.code}`);
    reviewGateIdByCode.set(rg.code, reviewGate.id);
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    const scope = parseGovernedTransition(gate.governedTransition);
    if (!scope) throw new Error(`quality gate "${gate.name}" has an invalid governedTransition (validatePackSeed should have caught this)`);
    const criteria: Record<string, unknown> =
      gate.criteriaType === "requires_active_policy"
        ? { type: gate.criteriaType, policyIds: resolvePolicyCodes(gate.requiredPolicyCodes) }
        : gate.criteriaType === "requires_accepted_review"
          ? { type: gate.criteriaType, reviewGateId: gate.deliverableName ? reviewGateIdByCode.get(gate.deliverableName) : undefined }
          : { type: gate.criteriaType ?? "no_unresolved_obligations" };
    const { error } = await qualityGatesDB.upsert({
      name: gate.name,
      category: gate.category,
      entityType: scope.entityType,
      fromState: scope.fromState,
      toState: scope.toState,
      criteria,
      originatingPackId: pack.id,
      checklistIds: resolveChecklistIds(gate.checklistIds),
      recommendedChecklistIds: resolveChecklistIds(gate.recommendedChecklistIds),
      applicabilityDeliverableNames: gate.applicabilityDeliverableNames ?? [],
      authorId: pack.authored_by,
      authorBadge: pack.author_badge,
    });
    if (error) throw error;
  }

}

export type TransitionPackResult =
  | { ok: true; pack: PackRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "comment_required"; detail: string };

export function alternateBadgesForPackTransition(fromState: string, toState: string): string[] | undefined {
  const ALTERNATE_BADGES: Record<string, string[]> = {
    "Draft->Validated": ["pack_define", "pack_reject"],
    "Validated->Draft": ["pack_validate"],
  };
  return ALTERNATE_BADGES[`${fromState}->${toState}`];
}

export async function transitionPack(input: { packId: string; targetState: string; actorRole: string; actorId: string; comment?: string }): Promise<TransitionPackResult> {
  const { data: pack } = await packsDB.findById(input.packId);
  if (!pack) return { ok: false, reason: "not_found" };

  const fromState = pack.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Pack",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { pack },
    entityId: pack.id,
    alternateBadges: alternateBadgesForPackTransition(fromState, input.targetState),
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Pack ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const trimmedComment = input.comment?.trim() ?? "";
  if (fromState === "Validated" && input.targetState === "Draft") {
    if (!trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Rejecting requires feedback — provide a comment explaining what needs to change." };
    }
    const { data: existingComments } = await packsDB.getComments(pack.id);
    const mostRecent = existingComments?.[existingComments.length - 1];
    if (mostRecent && mostRecent.comment_text.trim() === trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Provide new feedback — this matches the most recent comment already on record." };
    }
  }

  const { data: updated, error } = await packsDB.updateStatus(pack.id, input.targetState as PackRow["status"]);
  if (error || !updated) throw error ?? new Error("failed to update pack status");

  if (trimmedComment) {
    await packsDB.addComment(pack.id, input.actorId, trimmedComment);
  }

  await eventBus.publish({
    eventType: gate.eventType ?? "PackTransitioned",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: pack.code, packVersion: pack.pack_version },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
    tenantId: pack.tenant_id,
  });

  return { ok: true, pack: updated, appliedTransition: { fromState, toState: input.targetState } };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface PackCodeVersionSummary {
  versions: Array<{ id: string; version: string; status: PackRow["status"] }>;
  nextVersion: string;
}
const BRANCHABLE_STATUSES = new Set<PackRow["status"]>(["Published", "Active", "Retired", "Archived"]);

function nextAvailablePatchVersionInMemory(fromVersion: string, takenVersions: ReadonlySet<string>): string {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    if (!takenVersions.has(candidate)) return candidate;
  }
  throw new Error(`could not find an unused version after bumping from ${fromVersion}`);
}

function groupByCode(rows: PackRow[]): Map<string, PackRow[]> {
  const byCode = new Map<string, PackRow[]>();
  for (const pack of rows) {
    const list = byCode.get(pack.code) ?? [];
    list.push(pack);
    byCode.set(pack.code, list);
  }
  return byCode;
}

export async function packCodeVersionSummaries(tenantId: string): Promise<Record<string, PackCodeVersionSummary>> {
  const { data: ownPacks } = await packsDB.findAllForTenant(tenantId);
  const byCode = groupByCode(ownPacks ?? []);

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const platformByCode = tenantId === PLATFORM_TENANT_ID ? null : groupByCode((await packsDB.findAllForTenant(PLATFORM_TENANT_ID)).data ?? []);

  const result: Record<string, PackCodeVersionSummary> = {};
  const allCodes = new Set([...byCode.keys(), ...(platformByCode?.keys() ?? [])]);
  for (const code of allCodes) {
    const ownRows = byCode.get(code) ?? [];
    if (ownRows.length > 0) {
      const highest = ownRows.reduce((max, r) => (compareSemver(r.pack_version, max) > 0 ? r.pack_version : max), ownRows[0]!.pack_version);
      const nextVersion = nextAvailablePatchVersionInMemory(highest, new Set(ownRows.map((r) => r.pack_version)));
      const versions = ownRows
        .filter((r) => BRANCHABLE_STATUSES.has(r.status))
        .map((r) => ({ id: r.id, version: r.pack_version, status: r.status }))
        .sort((a, b) => compareSemver(b.version, a.version));
      result[code] = { versions, nextVersion };
      continue;
    }
    const platformRows = platformByCode?.get(code) ?? [];
    if (platformRows.length === 0) continue;
    const versions = platformRows
      .filter((r) => BRANCHABLE_STATUSES.has(r.status))
      .map((r) => ({ id: r.id, version: r.pack_version, status: r.status }))
      .sort((a, b) => compareSemver(b.version, a.version));
    result[code] = { versions, nextVersion: "1.0.0" };
  }
  return result;
}

export interface PackWithNextStates {
  pack: PackRow;
  possibleNextStates: string[];
}

export async function listPacksWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<PackWithNextStates[]> {
  const { data: packs } = viewer && !viewer.isRoot ? await packsDB.findAllVisibleTo(viewer.tenantId) : await packsDB.findAll();
  return Promise.all(
    (packs ?? []).map(async (pack) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Pack", pack.status);
      return { pack, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
