// Admin action: root runs the baseline-data population for tables whose
// rows used to be created only by a raw migration INSERT. Resolves the real
// logged-in root's participants_master row + 'root' badge and threads it
// into each seed function's authored_by/author_badge columns (both NOT
// NULL) -- the seed function itself does the write, this just supplies who.
//
// Only covers the seed functions that exist as standalone, app-callable
// units: authority_noun_verbs (seedAuthorityVocabulary), event_registry/
// event_subscriptions (seedEventSubscriptions), transition_definitions
// (seedTransitionDefinitions), schema_definitions (seedSchemaDefinitions),
// ontology_concepts (seedOntologyConcepts).
// pack_category is NOT here -- confirmed dead
// (packCategoriesDB.ts is never called; Pack.category is actually validated
// against the Ontology category:pack concept type, per packs.ts:637-638).
// The other tables on CR's migration-populated list (authority_rules,
// badge_types, capabilities, deliverable_definitions, metric_definitions,
// packs, tenants) have no reusable app-level seed function yet -- their
// baseline data still only comes from a one-off migration INSERT. Not
// covered here.
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

// authoredBy is a participants_master.id 
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

/** Runs every covered target in dependency order (transitions before the
 *  vocabulary back-fill that depends on their fresh rows). Pass `codes` to
 *  run only a subset (e.g. the UI's per-target selection) -- dependency
 *  order is still respected, just filtered down to the selected codes.
 *
 *  userId is threaded through separately from `actor` -- capability_definitions'
 *  own authored_by/actorId (capabilityDefinitionsDB.createDraft,
 *  transitionCapabilityDefinition) is the raw users.id (bigint column,
 *  no FK), not a resolved participants_master.id like every other seed
 *  function's SeedActor. */
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
