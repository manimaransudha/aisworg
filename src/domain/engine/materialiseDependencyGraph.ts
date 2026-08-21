// CR-041 — writes real dependency_definitions rows directly from an entity's
// own explicitly-authored dependencyGraph (Template seed JSON today; any
// schema that declares the same shape tomorrow — this function is generic
// over the owner, not Template-specific). Replaces
// deriveDependencyDefinitionsFromCatalogue.ts's translate-from-embedded-JSON
// bridge outright (owner, 2026-08-20: "no bridge. templates seed has to be
// corrected") — dependencyGraph is now the real authored source, not
// something derived from a different field's embedded codes.
//
// Direction note (easy to get backwards): to_* is the gated node, from_* is
// the prerequisite — matching CR-039's own worked example, "Req_spec
// +Approved" -> "Arch+Defined". A dependencyGraph entry's toName is the
// catalogue entry being gated; fromName/fromCapabilityCode is its
// prerequisite. Both toName/fromName are catalogue *names*, not codes — bug
// fix, found building CR-038 (see TemplateDependencyGraphEntry's own comment,
// seuTypes.ts): the live widget's self-referential picker was always
// name-based, and dependency_definitions itself is name-keyed throughout, so
// there's no code-to-name resolution step here at all — just membership
// validation against the real catalogue.
//
// to_state: gates specifically the first real transition (Defined -> In
// Progress) — Deliverable lifecycles are strictly forward-only, so this is a
// faithful, sufficient equivalent to "gate every transition attempt."
// requiredState (from_state) defaults per fromType when the author didn't
// override it: Approved for a Deliverable prerequisite, Fulfilled for a
// Capability one — the same defaults the old embedded model always used
// unconditionally; here they're pre-filled, not hardcoded, since the widget
// shows them as the default and the author can change them.
import { capabilitiesDB } from "../../dblayer/capabilitiesDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { dependencyDefinitionsDB } from "../../dblayer/dependencyDefinitionsDB.js";
import type { DbResult, DependencyDefinitionOwnerType, DependencyDefinitionRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../../dblayer/seuTypes.js";

const GATED_TO_STATE = "In Progress";
// Exported — the Ch.15 §12 (CR-049 Phase 2) Inheritance check in
// core/templates.ts needs the same default when comparing an unsaved
// child seed's requiredState against the parent's already-materialised one.
export const DEFAULT_DELIVERABLE_REQUIRED_STATE = "Approved";
const DEFAULT_CAPABILITY_REQUIRED_STATE = "Fulfilled";

export async function materialiseDependencyGraph(input: {
  owningEntityType: DependencyDefinitionOwnerType;
  owningEntityId: string;
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph: TemplateDependencyGraphEntry[];
}): Promise<DbResult<DependencyDefinitionRow[]>> {
  const validNames = new Set(input.deliverableCatalogue.map((entry) => entry.name));

  const capabilityCodes = [...new Set(input.dependencyGraph.filter((e) => e.fromType === "Capability" && e.fromCapabilityCode).map((e) => e.fromCapabilityCode!))];
  const { data: capabilities } = capabilityCodes.length > 0 ? await capabilitiesDB.findByCodes(capabilityCodes) : { data: [] };
  const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
  const servicesByCapabilityId = new Map<string, string[]>();
  for (const capability of capabilities ?? []) {
    const { data: services } = await servicesDB.findByCapabilityId(capability.id);
    servicesByCapabilityId.set(capability.id, (services ?? []).map((s) => s.code));
  }

  await dependencyDefinitionsDB.deleteByOwner(input.owningEntityType, input.owningEntityId);

  const created: DependencyDefinitionRow[] = [];
  for (const entry of input.dependencyGraph) {
    if (!validNames.has(entry.toName)) continue;

    if (entry.fromType === "Deliverable") {
      if (!entry.fromName || !validNames.has(entry.fromName)) continue;
      const { data } = await dependencyDefinitionsDB.create({
        owningEntityType: input.owningEntityType,
        owningEntityId: input.owningEntityId,
        fromEntityType: "Deliverable",
        fromName: entry.fromName,
        fromState: entry.requiredState ?? DEFAULT_DELIVERABLE_REQUIRED_STATE,
        toEntityType: "Deliverable",
        toName: entry.toName,
        toState: GATED_TO_STATE,
        relationshipKind: entry.relationshipKind ?? "dependency",
      });
      if (data) created.push(data);
      continue;
    }

    // fromType === "Capability" — a capability code names every Service it
    // declares (Ch.9 §8/Ch.11 §9); one dependency_definitions row per Service.
    // relationshipKind is Deliverable-to-Deliverable only (CR-049) — a
    // Capability-type edge always defaults to plain "dependency" regardless
    // of what the entry carries (the widget never offers the picker for this
    // fromType); threaded through only for structural consistency.
    const capabilityId = entry.fromCapabilityCode ? capabilityIdByCode.get(entry.fromCapabilityCode) : undefined;
    if (!capabilityId) continue;
    for (const serviceCode of servicesByCapabilityId.get(capabilityId) ?? []) {
      const { data } = await dependencyDefinitionsDB.create({
        owningEntityType: input.owningEntityType,
        owningEntityId: input.owningEntityId,
        fromEntityType: "Capability",
        fromName: serviceCode,
        fromState: entry.requiredState ?? DEFAULT_CAPABILITY_REQUIRED_STATE,
        toEntityType: "Deliverable",
        toName: entry.toName,
        toState: GATED_TO_STATE,
        relationshipKind: "dependency",
      });
      if (data) created.push(data);
    }
  }

  return { data: created };
}
