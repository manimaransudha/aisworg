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
// +Approved" -> "Arch+Defined". A dependencyGraph entry's toCode is the
// catalogue entry being gated; fromCode/fromCapabilityCode is its
// prerequisite.
//
// CR-087 — toCode/fromCode/deliverableCatalogue[].code are real
// deliverable-name Ontology CODES now (validated at validateTemplateSeed),
// not the concept's default_label text CR-038 had them carry. But
// dependency_definitions stays name(label)-keyed exactly as it always has
// (matches deliverables.name at runtime, core/commissioning.ts) — so this is
// where the one resolution step CR-038's own comment said didn't exist gets
// added: every code is resolved to its tenant-aware label (resolveLabels,
// core/ontology.ts — same tenant-alias-aware, fallback-to-code-if-stale
// behaviour CR-086 Step 2 already established for Objective's required
// capabilities) before being written to to_name/from_name.
//
// to_state: gates specifically the first real transition (Defined -> In
// Progress) — Deliverable lifecycles are strictly forward-only, so this is a
// faithful, sufficient equivalent to "gate every transition attempt."
// requiredState (from_state) defaults per fromType when the author didn't
// override it: Approved for a Deliverable prerequisite, Fulfilled for a
// Capability one — the same defaults the old embedded model always used
// unconditionally; here they're pre-filled, not hardcoded, since the widget
// shows them as the default and the author can change them.
// Owner, 2026-09-04: "there is no Capability-type edge... Canonical
// Capabilities do not depend on each other. They are a network of
// capabilities required to accomplish the objective. What has dependency is
// the deliverable... deliverable dependency is what is real. Service
// describes the what/quality of it." Capability-type edge materialisation
// (below, commented out — not deleted) is retired on that basis: a Capability
// is just the Ontology capability-name shell, not an artifact with a
// dependency of its own; the sequencing that actually matters is already
// fully expressed Deliverable-to-Deliverable. Left in place, commented, in
// case this gets revisited rather than ripped out.
// import { capabilitiesDB } from "../../dblayer/capabilitiesDB.js";
// import { servicesDB } from "../../dblayer/servicesDB.js";
import { dependencyDefinitionsDB } from "../../dblayer/dependencyDefinitionsDB.js";
import { resolveLabels } from "../../routes/seu/core/ontology.js";
import type { DbResult, DependencyDefinitionOwnerType, DependencyDefinitionRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../../dblayer/seuTypes.js";

const GATED_TO_STATE = "In Progress";
// Exported — the Ch.15 §12 (CR-049 Phase 2) Inheritance check in
// core/templates.ts needs the same default when comparing an unsaved
// child seed's requiredState against the parent's already-materialised one.
export const DEFAULT_DELIVERABLE_REQUIRED_STATE = "Approved";
// const DEFAULT_CAPABILITY_REQUIRED_STATE = "Fulfilled";

export async function materialiseDependencyGraph(input: {
  owningEntityType: DependencyDefinitionOwnerType;
  owningEntityId: string;
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph: TemplateDependencyGraphEntry[];
  tenantId: string;
}): Promise<DbResult<DependencyDefinitionRow[]>> {
  const validCodes = new Set(input.deliverableCatalogue.map((entry) => entry.code));
  const labelByCode = await resolveLabels(input.tenantId, "deliverable-name");
  const toLabel = (code: string) => labelByCode[code] ?? code;

  // const capabilityCodes = [...new Set(input.dependencyGraph.filter((e) => e.fromType === "Capability" && e.fromCapabilityCode).map((e) => e.fromCapabilityCode!))];
  // const { data: capabilities } = capabilityCodes.length > 0 ? await capabilitiesDB.findByCodes(capabilityCodes) : { data: [] };
  // const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
  // const servicesByCapabilityId = new Map<string, string[]>();
  // for (const capability of capabilities ?? []) {
  //   const { data: services } = await servicesDB.findByCapabilityId(capability.id);
  //   servicesByCapabilityId.set(capability.id, (services ?? []).map((s) => s.code));
  // }

  await dependencyDefinitionsDB.deleteByOwner(input.owningEntityType, input.owningEntityId);

  const created: DependencyDefinitionRow[] = [];
  for (const entry of input.dependencyGraph) {
    if (!validCodes.has(entry.toCode)) continue;

    if (entry.fromType === "Deliverable") {
      if (!entry.fromCode || !validCodes.has(entry.fromCode)) continue;
      const { data } = await dependencyDefinitionsDB.create({
        owningEntityType: input.owningEntityType,
        owningEntityId: input.owningEntityId,
        fromEntityType: "Deliverable",
        fromName: toLabel(entry.fromCode),
        fromState: entry.requiredState ?? DEFAULT_DELIVERABLE_REQUIRED_STATE,
        toEntityType: "Deliverable",
        toName: toLabel(entry.toCode),
        toState: GATED_TO_STATE,
        relationshipKind: entry.relationshipKind ?? "dependency",
      });
      if (data) created.push(data);
      continue;
    }

    // fromType === "Capability" — retired (owner, 2026-09-04: "there is no
    // Capability-type edge... deliverable dependency is what is real").
    // Commented out, not deleted: was "a capability code names every Service
    // it declares (Ch.9 §8/Ch.11 §9); one dependency_definitions row per
    // Service" — relationshipKind was Deliverable-to-Deliverable only
    // (CR-049), a Capability-type edge always defaulted to plain "dependency"
    // regardless of what the entry carried.
    // const capabilityId = entry.fromCapabilityCode ? capabilityIdByCode.get(entry.fromCapabilityCode) : undefined;
    // if (!capabilityId) continue;
    // for (const serviceCode of servicesByCapabilityId.get(capabilityId) ?? []) {
    //   const { data } = await dependencyDefinitionsDB.create({
    //     owningEntityType: input.owningEntityType,
    //     owningEntityId: input.owningEntityId,
    //     fromEntityType: "Capability",
    //     fromName: serviceCode,
    //     fromState: entry.requiredState ?? DEFAULT_CAPABILITY_REQUIRED_STATE,
    //     toEntityType: "Deliverable",
    //     toName: toLabel(entry.toCode),
    //     toState: GATED_TO_STATE,
    //     relationshipKind: "dependency",
    //   });
    //   if (data) created.push(data);
    // }
  }

  return { data: created };
}
