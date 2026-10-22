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
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { reviewGatesDB } from "../../../dblayer/reviewGatesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { listActiveNouns } from "./authorityVocabulary.js";
import { listTransitionsForEntityType } from "./policyDefinitions.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import { governedTransitionsFor } from "../../../domain/engine/policyChecks.js";
import type { PackCategory, PackClassification, PackContributions, PackRow, PolicyCondition, PolicyDefinitionRow, PolicyScope, ServiceDefinitionRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { getPlatformTenantId, INITIAL_VERSION } from "../../../dblayer/constants.js";
import { compareSemver, nextUnusedPatchVersion, semverError } from "../../../utils/version.js";

 

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

const DEFAULT_CONDITION: PolicyCondition = {
  statement: "", severity: "Medium", applicabilityDeliverables: [],
  requiredEvidence: { title: "", category: "", description: "", collectionMethod: "" }, relatedObligations: [], exceptionRules: [],
};

// A Checklist reference is a name this Pack declares, or the id of a published Checklist owned by a Pack with the same code.
export async function validateChecklistIds(checklistIds: string[] | undefined, declaredNames: string[], packCode: string, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of checklistIds ?? []) {
    const samePackMatch = declaredNames.includes(ref);
    if (samePackMatch) continue;
    const { data: existing } = await checklistsDB.findById(ref);
    if (!existing) {
      errors.push(`${context} references unknown Checklist "${ref}" — must be either this Pack's own declared checklist name, or a real, already-published Checklist's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(existing.originating_pack_id);
    if (!owningPack || owningPack.code !== packCode) {
      errors.push(`${context} references Checklist "${existing.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${packCode}"; a Checklist may only be referenced by Packs sharing the same code`);
    }
  }
  return errors;
}

// A Policy reference is a code this Pack declares, or the id of a published Policy owned by a Pack with the same code.
export async function validatePolicyCodes(policyRefs: string[] | undefined, declaredCodes: string[], packCode: string, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of policyRefs ?? []) {
    const samePackMatch = declaredCodes.includes(ref);
    if (samePackMatch) continue;
    const { data: existing } = await policiesDB.findByIds([ref]);
    const policy = existing?.[0];
    if (!policy) {
      errors.push(`${context} references unknown Policy "${ref}" — must be either this Pack's own declared policy code, or a real, already-published Policy's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(policy.originating_pack_id ?? "");
    if (!owningPack || owningPack.code !== packCode) {
      errors.push(`${context} references Policy "${policy.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${packCode}"; a Policy may only be referenced by Packs sharing the same code`);
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
  const packVersionError = semverError("packVersion", seed.packVersion);
  if (packVersionError) errors.push(packVersionError);
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
        for (const err of await validatePolicyCodes(gate.requiredPolicyCodes, seed.contributions.policies ?? [], seed.code, `quality gate "${gate.name}"`)) errors.push(err);
      }
    }
    if (gate.criteriaType === "requires_accepted_review") {
      if (!gate.deliverableName?.trim()) {
        errors.push(`quality gate "${gate.name}" has criteriaType requires_accepted_review but no deliverableName`);
      } else if (!(seed.contributions.reviewGates ?? []).some((rg) => rg.code === gate.deliverableName)) {
        errors.push(`quality gate "${gate.name}" references unknown Review Gate "${gate.deliverableName}" — the Review Gate must be declared in this same Pack's contributions`);
      }
    }
    for (const err of await validateChecklistIds(gate.checklistIds, (seed.contributions.checklists ?? []).map((cl) => cl.name), seed.code, `quality gate "${gate.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(gate.recommendedChecklistIds, (seed.contributions.checklists ?? []).map((cl) => cl.name), seed.code, `quality gate "${gate.name}"`)) errors.push(err);
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
    for (const err of await validateChecklistIds(rg.checklistIds, (seed.contributions.checklists ?? []).map((cl) => cl.name), seed.code, `review gate "${rg.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(rg.recommendedChecklistIds, (seed.contributions.checklists ?? []).map((cl) => cl.name), seed.code, `review gate "${rg.name}"`)) errors.push(err);
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
                .filter((row) => row.name && !row.transitions.some((t) => t.startsWith("SEU|")) && row.name !== "SEU")
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
  const viewerTenantId = ontologyViewer.tenantId ?? (await getPlatformTenantId());
  for (const svc of seed.contributions.services ?? []) {
    const definition = await resolvePinnedServiceDefinition(svc, viewerTenantId);
    if (typeof definition === "string") {
      errors.push(definition);
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
  supersededPack?: PackRow | null;
  errors?: string[];
}

export async function createPackDraft(seed: PackSeedInput, authorId: string): Promise<{ ok: true; pack: PackRow } | { ok: false; errors: string[] }> {
  const validation = await validatePackSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
  if (!packSchema) return { ok: false, errors: [`no schema_definitions grammar for Pack`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Pack", actorId: authorId });
  const { data: pack, error } = await packsDB.create({ ...seed, metadata: packMetadataFromSeed(seed), schemaDefinitionId: packSchema.id, status: birth.initialState as PackRow["status"], authoredBy: authorId, authorBadge: birth.authorityBadge, tenantId: seed.tenantId ?? (await getPlatformTenantId()) });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create pack")).message] };

  await materializeContributions(pack, seed);

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: authorId,
    authorityBadge: birth.authorityBadge,
    payload: { code: pack.code, packVersion: pack.pack_version },
  });

  return { ok: true, pack };
}

// Moves a Pack to Active and retires the Active version it replaces, both through the generic transition.
export async function activatePackSupersedingPrevious(pack: PackRow, actorId: string): Promise<PublishPackResult> {
  const { data: previousActive } = await packsDB.findActiveByCode(pack.code, pack.tenant_id);
  const activated = await transitionEntity({ entityType: "Pack", entityId: pack.id, targetState: "Active", actorId });
  if (!activated.ok) return { ok: false, pack, errors: [`transition to "Active" failed: ${"detail" in activated ? activated.detail : activated.reason}`] };
  await publishTransition(activated);
  let supersededPack: PackRow | null = null;
  if (previousActive && previousActive.id !== pack.id) {
    const superseded = await transitionEntity({ entityType: "Pack", entityId: previousActive.id, targetState: "Retired", actorId });
    if (superseded.ok) {
      supersededPack = superseded.row as PackRow;
      await publishTransition(superseded);
    }
  }
  return { ok: true, pack: activated.row as PackRow, supersededPack };
}

export async function advancePackLifecycle(pack: PackRow, actorId: string, options?: { activate?: boolean }): Promise<PublishPackResult> {
  let currentPack = pack;

  if (currentPack.status === "Draft") {
    for (const targetState of ["Validated", "Published"]) {
      const result = await transitionEntity({ entityType: "Pack", entityId: currentPack.id, targetState, actorId });
      if (!result.ok) return { ok: false, pack: currentPack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
      await publishTransition(result);
      currentPack = result.row as PackRow;
    }
  }

  if (options?.activate && currentPack.status === "Published") return activatePackSupersedingPrevious(currentPack, actorId);
  return { ok: true, pack: currentPack, supersededPack: null };
}

export async function publishPack(input: { seed: PackSeedInput; actorId: string; activate?: boolean }): Promise<PublishPackResult> {
  const { data: packMaster } = await participantsMasterDB.findById(input.actorId);
  if (!packMaster) return { ok: false, errors: [`No superuser provisioned.`] };

  const draft = await createPackDraft(input.seed, packMaster.id);
  if (!draft.ok) return { ok: false, errors: draft.errors };

  const advanced = await advancePackLifecycle(draft.pack, input.actorId, { activate: input.activate });
  return advanced;
}

// A contributed service names the exact Service Definition version it composes by id. The id must resolve to an
// Active definition visible to the tenant whose code matches the entry's code. Returns the row, or a message.
async function resolvePinnedServiceDefinition(svc: { code: string; serviceDefinitionId: string }, viewerTenantId: string): Promise<ServiceDefinitionRow | string> {
  if (!svc.serviceDefinitionId) return `service "${svc.code}" has no serviceDefinitionId`;
  const { data: definition } = await serviceDefinitionsDB.findById(svc.serviceDefinitionId);
  if (!definition) return `service "${svc.code}" serviceDefinitionId "${svc.serviceDefinitionId}" does not resolve to a Service Definition`;
  if (definition.code !== svc.code) return `service "${svc.code}" serviceDefinitionId "${svc.serviceDefinitionId}" belongs to Service Definition "${definition.code}"`;
  if (definition.status !== "Active") return `service "${svc.code}" Service Definition ${definition.version} is ${definition.status}, not Active`;
  if (definition.tenant_id !== viewerTenantId && definition.tenant_id !== (await getPlatformTenantId())) return `service "${svc.code}" Service Definition is not visible to this tenant`;
  return definition;
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
    const definition = await resolvePinnedServiceDefinition(svc, pack.tenant_id);
    if (typeof definition === "string") throw new Error(definition);
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

export interface PackCodeVersionSummary {
  versions: Array<{ id: string; version: string; status: PackRow["status"] }>;
  nextVersion: string;
}
const BRANCHABLE_STATUSES = new Set<PackRow["status"]>(["Published", "Active", "Retired", "Archived"]);

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
      const nextVersion = nextUnusedPatchVersion(highest, new Set(ownRows.map((r) => r.pack_version)));
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
    result[code] = { versions, nextVersion: INITIAL_VERSION };
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
