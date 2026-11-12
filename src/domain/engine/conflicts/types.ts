import type { ConflictAction } from "../../../dblayer/constants.js";
import type { ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";
import type { ComposedPacks } from "./composedPacks.js";

// A composition conflict found by one per-table detector. The detectors return plain data and know nothing of any screen.
export interface ConflictOption {
  // Where this value comes from, for the user to see.
  sourceKind: "deliverable-service" | "pack" | "template" | "profile" | "definition";
  sourceId: string | null;
  sourceLabel: string;
  value: unknown;
}

export interface EbmConflict {
  // The table the conflict belongs to, one per contribution kind.
  table: "services" | "capabilities" | "policies" | "authorityRules" | "qualityGates" | "reviewGates" | "obligationDefinitions" | "engineeringCapital" | "dependencies";
  // Unique within the composition. A resolution is stored under this key.
  key: string;
  // What kind of disagreement it is within the table.
  kind: string;
  // What the user is shown, in plain language.
  message: string;
  options: ConflictOption[];
  // True when the user may pick in composition. False when it has to be fixed at the definition.
  resolvable: boolean;
  // The user's pick for this conflict, or null while it is open.
  resolution: unknown | null;
  // True for an item shown to the user that needs no pick, such as a Policy that is verified by a person.
  notice?: true;
}

// The user's picks so far, keyed by EbmConflict.key. A conflict whose key is present is not reported again.
export type ConflictResolutions = Record<string, unknown>;

// A conflict with the action that applies to its kind.
export interface ActionedConflict extends EbmConflict {
  action: ConflictAction;
  // The title of the conflict card.
  title: string;
}

// What every detector receives. A detector reads the Templates, Profiles and Packs itself through its own unravel function.
export interface DetectionContext {
  templates: TemplateRow[];
  profiles: ProfileRow[];
  viewerTenantId: string;
  composedPacks: ComposedPacks;
}
