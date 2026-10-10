import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seedTransitionDefinitions } from "../../../dblayer/seed/seedTransitionDefinitions.js";
import { seedAuthorityVocabulary } from "../../../dblayer/seed/seedAuthorityVocabulary.js";
import { seedEventSubscriptions } from "../../../dblayer/seed/seedEventSubscriptions.js";
import { seedSchemaDefinitions } from "../../../dblayer/seed/seedSchemaDefinitions.js";
import { seedCapabilityDefinitions } from "../../../dblayer/seed/seedCapabilityDefinitions.js";
import { seedServiceDefinitions } from "../../../dblayer/seed/seedServiceDefinitions.js";
import { seedRouteAuthority } from "../../../dblayer/seed/seedRouteAuthority.js";
import { seedOntologyConcepts } from "../../../dblayer/seed/seedOntologyConcepts.js";

export interface DataMigrationTarget {
  code: string;
  label: string;
  tables: string[];
}

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

export const DATA_MIGRATION_TARGETS: DataMigrationTarget[] = [
  { code: "transition-definitions", label: "Transition definitions", tables: ["transition_definitions"] },
  { code: "authority-vocabulary", label: "Authority vocabulary", tables: ["authority_noun_verbs"] },
  { code: "event-subscriptions", label: "Event registry + subscriptions", tables: ["event_registry", "event_subscriptions"] },
  { code: "schema-definitions", label: "Schema definitions", tables: ["schema_definitions"] },
  { code: "capability-definitions", label: "Capability definitions", tables: ["capability_definitions"] },
  { code: "service-definitions", label: "Service definitions", tables: ["service_definitions"] },
  { code: "route-authority", label: "Route authority", tables: ["route_authority"] },
  { code: "ontology-concepts", label: "Ontology concepts (baseline)", tables: ["ontology_concepts"] },
];

export async function resolveRootActor(userId: string): Promise<SeedActor> {
  const { data: master } = await participantsMasterDB.findById(userId);
  if (!master) throw new Error(`No superuser provisioned.`);
  return { authoredBy: master.id, authorBadge: "root" };
}

export async function runDataMigrations(actor: SeedActor, userId: string, codes?: string[]): Promise<{ code: string; ok: boolean; error?: string }[]> {
  const steps: Array<[string, () => Promise<void>]> = [
    ["transition-definitions", () => seedTransitionDefinitions(actor)],
    ["authority-vocabulary", () => seedAuthorityVocabulary(actor)],
    ["event-subscriptions", () => seedEventSubscriptions(actor)],
    ["schema-definitions", () => seedSchemaDefinitions(actor)],
    ["capability-definitions", () => seedCapabilityDefinitions(actor)],
    ["service-definitions", () => seedServiceDefinitions(actor)],
    ["route-authority", () => seedRouteAuthority(actor)],
    ["ontology-concepts", () => seedOntologyConcepts(actor)],
  ];
  const selected = codes && codes.length > 0 ? steps.filter(([code]) => codes.includes(code)) : steps;
  const results: { code: string; ok: boolean; error?: string }[] = [];
  for (const [code, run] of selected) {
    try {
      await run();
      results.push({ code, ok: true });
    } catch (err) {
      results.push({ code, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
