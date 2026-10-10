import { dependencyDefinitionsDB } from "../../dblayer/dependencyDefinitionsDB.js";
import { resolveLabels } from "../../routes/seu/core/ontology.js";
import type { DbResult, DependencyDefinitionOwnerType, DependencyDefinitionRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../../dblayer/seuTypes.js";

const GATED_TO_STATE = "In Progress";
export const DEFAULT_DELIVERABLE_REQUIRED_STATE = "Approved";

export async function materialiseDependencyGraph(input: {
  owningEntityType: DependencyDefinitionOwnerType;
  owningEntityId: string;
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph: TemplateDependencyGraphEntry[];
  tenantId: string;
  authorId: string;
  authorBadge: string;
}): Promise<DbResult<DependencyDefinitionRow[]>> {
  const validCodes = new Set(input.deliverableCatalogue.map((entry) => entry.code));
  const labelByCode = await resolveLabels(input.tenantId, "deliverable-name");
  const toLabel = (code: string) => labelByCode[code] ?? code;

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
        authorId: input.authorId,
        authorBadge: input.authorBadge,
      });
      if (data) created.push(data);
      continue;
    }

  }

  return { data: created };
}
