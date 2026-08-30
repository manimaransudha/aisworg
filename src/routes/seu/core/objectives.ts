import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { triggerEngine } from "../../../domain/engine/triggerEngine.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { userDB } from "../../../dblayer/userDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { findCandidateTemplates } from "./templates.js";
import { listRealProfilesForTemplate } from "./profiles.js";
import type { CapabilityRow, ObjectiveCommentRow, ObjectiveRow, ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";

// Ch.1 §7: Strategic decomposes into Operational decomposes into Engineering.
// A child's tier must not be "more strategic" than its parent's.
const TIER_RANK: Record<ObjectiveTier, number> = { Strategic: 0, Operational: 1, Engineering: 2 };

// CR-079 bug fix — capabilitiesDB.findByCodes has no Pack scoping, and a
// capability code is now a genuinely shared Ontology term (capability-name)
// that multiple Packs can each independently contribute (e.g. "development"
// from openup-development AND every Technology pack) — so a bare code can
// legitimately match more than one row. An Objective requires the
// COMPETENCY once, not once per Pack that happens to offer it; de-dupe by
// code, same treatment templates.ts's own materialisePackSelectionsAndCapabilities
// got for the identical reason. Used by both createObjective and the
// requiredCapabilityCodes edit path below.
function dedupeByCode(capabilities: CapabilityRow[]): CapabilityRow[] {
  const byCode = new Map<string, CapabilityRow>();
  for (const capability of capabilities) {
    if (!byCode.has(capability.code)) byCode.set(capability.code, capability);
  }
  return [...byCode.values()];
}

export async function createObjective(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  tier?: ObjectiveTier;
  status?: ObjectiveStatus;
  parentObjectiveId?: string | null;
  requestedBy?: number | null;
  // ensureOneShotContainer's Strategic root is a single sentinel-matched
  // container REUSED ACROSS EVERY TENANT (commissionFromForm), not minted per
  // tenant, permanently Active, its own sponsoring_authority fixed to
  // whichever tenant happened to create it first — so it can never pass the
  // parent tenant-reach check, nor the "parent must be Proposed" edit-scope
  // check, below. Set only by that one caller.
  skipParentValidation?: boolean;
}): Promise<{ objective: ObjectiveRow; requiredCapabilities: CapabilityRow[] }> {
  const tier = input.tier ?? "Engineering";

  // CR-009: only Strategic may be parentless (the root). Operational/Engineering
  // must decompose from some parent — a clear, correctable error, and the DB
  // CHECK (migration 037) is the race-free backstop.
  if (tier !== "Strategic" && !input.parentObjectiveId) {
    throw new Error(`a ${tier} Objective requires a parent Objective (only Strategic may be a root)`);
  }

  // CR-068: every Objective is attributed to a real proposing user, no
  // exceptions — even a system-triggered one (e.g. ensureOneShotContainer's
  // one-shot commissioning root) is really an action taken by a real actor
  // (root, if nothing else). Enforced here, app-level, not as a DB NOT NULL
  // constraint (owner: "the schema does not need the constraint"). Checked
  // ahead of the parent block below, which also needs requestedBy resolved
  // to a real tenant for its own reach check.
  if (input.requestedBy == null) {
    throw new Error("an Objective must be attributed to a real requesting user (requestedBy) — this can never be null");
  }

  if (input.parentObjectiveId) {
    const { data: parent } = await objectivesDB.findById(input.parentObjectiveId);
    if (!parent) throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
    if (TIER_RANK[tier] < TIER_RANK[parent.tier]) {
      throw new Error(`child Objective tier (${tier}) cannot be more strategic than its parent's tier (${parent.tier})`);
    }

    // CR-075 (owner: "Only propose can edit every field... adding moving is
    // all editing") — adding a child is an edit of the parent, so it's only
    // allowed while the parent's own status is Proposed, same as statement/
    // Capabilities/Move.
    if (!input.skipParentValidation && parent.status !== "Proposed") {
      throw new Error(`parent Objective is not Proposed (status: ${parent.status}) — adding children is only allowed while Proposed`);
    }

    // A Proposed parent can still be locked via an ANCESTOR further up
    // (isObjectiveEditLocked walks the whole chain, not just this parent's
    // own status) — the check above alone doesn't catch that case.
    if (await isObjectiveEditLocked(input.parentObjectiveId)) {
      throw new Error(`parent Objective has already been submitted for activation — adding children is locked until the activate badge holder acts on it`);
    }

    // Tenant reach — objectivesDB.create copies the parent's sponsoring_authority
    // onto the child verbatim, so decomposing under a parent in another tenant
    // would silently attribute the new child to that OTHER tenant. A non-root
    // requester may only decompose under a parent in their own tenant. Same
    // "not found" message the tier-rank check above uses, not a distinct
    // "wrong tenant" error — never confirms another tenant's Objective exists,
    // same convention as the :id routes' own reach gate (web/objectives.ts,
    // api/objectives.ts). Fails closed on a legacy parent with no
    // sponsoring_authority yet, same "NULL never matches" rule those use too.
    if (!input.skipParentValidation) {
      const { data: grants } = await badgeGrantsDB.findActiveForHolder(String(input.requestedBy));
      const isRoot = (grants ?? []).some((g) => g.status === "Active" && g.badge_type === "root");
      if (!isRoot) {
        const requester = await userDB.findById(input.requestedBy);
        const requesterTenantId = requester?.tenant_id ?? null;
        const parentTenantId = parent.sponsoring_authority?.tenant ?? null;
        if (parentTenantId === null || requesterTenantId === null || parentTenantId !== requesterTenantId) {
          throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
        }
      }
    }
  }

  const { data: objective, error } = await objectivesDB.create({
    statement: input.statement,
    tier,
    status: input.status,
    parentObjectiveId: input.parentObjectiveId,
    requestedBy: input.requestedBy,
  });
  if (error || !objective) throw error ?? new Error("failed to create objective");

  const { data: capabilities, error: capErr } = await capabilitiesDB.findByCodes(input.requiredCapabilityCodes);
  if (capErr) throw capErr;
  const found = dedupeByCode(capabilities ?? []);
  const foundCodes = new Set(found.map((c) => c.code));
  const missing = input.requiredCapabilityCodes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new Error(`unknown capability code(s): ${missing.join(", ")}`);
  }

  await objectivesDB.addCapabilities(objective.id, found.map((c) => c.id));
  return { objective, requiredCapabilities: found };
}

// CR-009: bare Engineering Objectives are no longer allowed — they must
// decompose from a parent. The one-shot "commission from a statement" path
// (commissionFromForm) has no natural parent, so it hangs its Engineering
// Objective under a single, reused Strategic container root (owner decision,
// 2026-08-13). Reused by sentinel statement, not minted per SEU.
export const ONE_SHOT_CONTAINER_STATEMENT = "Uncategorised — directly-commissioned SEUs";

export async function ensureOneShotContainer(requestedBy?: number | null): Promise<ObjectiveRow> {
  const { data: existing } = await objectivesDB.findStrategicByStatement(ONE_SHOT_CONTAINER_STATEMENT);
  if (existing) return existing;
  const { objective } = await createObjective({
    statement: ONE_SHOT_CONTAINER_STATEMENT,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Active",
    requestedBy,
  });
  return objective;
}

export interface ObjectiveListItem {
  id: string;
  // CR-068 — the user-friendly hierarchical id ("1", "1.2", "1.2.3"); null
  // only for a legacy row predating this CR (a full db:clean-slate reseeds
  // those with a real one).
  displayId: string | null;
  statement: string;
  tier: ObjectiveTier;
  status: ObjectiveStatus;
  version: string;
  parentObjectiveId: string | null;
  createdAt: string;
  // CR-009: whether this node has children (drives the tree expand affordance)
  // and whether it is a leaf (no children) — a leaf that is not Strategic is the
  // finest-grained objective an SEU can serve.
  hasChildren: boolean;
  isLeaf: boolean;
  // CR-003/CR-009: whether an SEU is already commissioned against this
  // Objective, and whether it is eligible to commission one now — a non-Strategic
  // leaf, Active, not already assigned (supersedes CR-002's Engineering-only
  // rule). Drives the Objectives "Commission SEU" action.
  commissioned: boolean;
  commissionable: boolean;
  // CR-012: which removal action the node offers. `deletable` — a Proposed leaf
  // with no SEU (hard delete). `retirable` — an Active objective (governed
  // retire of it + its subtree). Mutually exclusive; a node may offer neither.
  deletable: boolean;
  // CR-075 — true if this row is edit-locked, itself or via an ancestor
  // (see isObjectiveEditLocked/computeEditLockedIds). Gates the Edit link
  // list rows now show alongside View.
  editLocked: boolean;
  retirable: boolean;
  // CR-072 — set only when a transition out of this row's own current status
  // has a real Submit step defined (transition_definitions.submit_verb); null
  // means nothing to show here. nextTransitionVerb is what submitting this
  // row unlocks (e.g. "activate"), so a caller can badge-check that specific
  // action once alreadySubmitted is true.
  submitVerb: string | null;
  alreadySubmitted: boolean;
  nextTransitionVerb: string | null;
  nextTransitionToState: string | null;
}

function toListItem(
  o: ObjectiveRow,
  opts: {
    commissioned?: boolean;
    hasChildren?: boolean;
    submitVerb?: string | null;
    alreadySubmitted?: boolean;
    nextTransitionVerb?: string | null;
    nextTransitionToState?: string | null;
    // CR-075 — whether this row is edit-locked, itself OR via an ancestor
    // (owner: "Locked node locks its whole subtree"). Callers pass this from
    // a batched Set (computeEditLockedIds), never a per-row DB call — see its
    // own comment for why a per-row ancestor walk doesn't scale to a list.
    editLocked?: boolean;
  } = {}
): ObjectiveListItem {
  const commissioned = opts.commissioned ?? false;
  const hasChildren = opts.hasChildren ?? false;
  const isLeaf = !hasChildren;
  const editLocked = opts.editLocked ?? (opts.alreadySubmitted ?? false);
  return {
    id: o.id,
    displayId: o.display_id,
    statement: o.statement,
    tier: o.tier,
    status: o.status,
    version: o.version,
    parentObjectiveId: o.parent_objective_id,
    createdAt: o.created_at,
    hasChildren,
    isLeaf,
    commissioned,
    commissionable: !commissioned && o.tier !== "Strategic" && isLeaf && o.status === "Active",
    // CR-075 — not deletable once submitted for activation, itself or via an
    // ancestor (same real check, enforced in deleteObjective).
    deletable: o.status === "Proposed" && isLeaf && !commissioned && !editLocked,
    editLocked,
    retirable: o.status === "Active",
    submitVerb: opts.submitVerb ?? null,
    alreadySubmitted: opts.alreadySubmitted ?? false,
    nextTransitionVerb: opts.nextTransitionVerb ?? null,
    nextTransitionToState: opts.nextTransitionToState ?? null,
  };
}

// CR-075 (owner: "It does not extend to the tree/list rows' Delete button
// visibility - It has to. Why leave this out? It will cause inconsistency")
// — batched, for a page of many Objectives at once, same discipline as
// computeSubmitInfo below: never a per-row DB call. isObjectiveEditLocked's
// own ancestor walk (findAncestorPath, once per row) doesn't scale to a list
// of rows, so this flips the direction — same trick retireObjectiveSubtree
// already established (findDescendantIds, walking down from the acted-on
// node): find the (typically small) set of Proposed-and-submitted nodes
// platform-wide, then walk down from each ONCE via findDescendantIds to
// build the full set of ids their lock reaches. Any row in the current page
// then just needs a Set.has(id) — O(1), no query at all.
async function computeEditLockedIds(): Promise<Set<string>> {
  const { data: proposedRows } = await objectivesDB.findByStatuses(["Proposed"]);
  const proposedIds = (proposedRows ?? []).map((o) => o.id);
  if (proposedIds.length === 0) return new Set();

  const { data: events } = await eventsDB.findByOriginatingObjects("Objective", proposedIds);
  const submittedIds = new Set(
    (events ?? []).filter((e) => e.event_type === "ObjectiveProposed").map((e) => e.originating_object_id)
  );
  if (submittedIds.size === 0) return new Set();

  const locked = new Set(submittedIds);
  const descendantLists = await Promise.all([...submittedIds].map((id) => objectivesDB.findDescendantIds(id)));
  for (const { data: descendantIds } of descendantLists) {
    for (const d of descendantIds ?? []) locked.add(d);
  }
  return locked;
}

// CR-072 — batched, for a page of many Objectives at once (a tree/list view),
// not one query per row. One query for the small, fixed set of transition
// definitions covering whichever statuses are actually present on this page;
// one more (only if any of them have a real submit_verb) for which of these
// specific rows already fired their own submit event.
async function computeSubmitInfo(
  rows: ObjectiveRow[]
): Promise<Map<string, { submitVerb: string | null; alreadySubmitted: boolean; nextTransitionVerb: string | null; nextTransitionToState: string | null }>> {
  const result = new Map<string, { submitVerb: string | null; alreadySubmitted: boolean; nextTransitionVerb: string | null; nextTransitionToState: string | null }>();
  const distinctStatuses = [...new Set(rows.map((o) => o.status))];
  const statusInfo = new Map<string, { submitVerb: string; nextTransitionVerb: string | null; nextTransitionToState: string }>();
  await Promise.all(
    distinctStatuses.map(async (status) => {
      const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", status);
      const withSubmit = (transitions ?? []).find((t) => t.submitVerb);
      if (withSubmit?.submitVerb) statusInfo.set(status, { submitVerb: withSubmit.submitVerb, nextTransitionVerb: withSubmit.verb, nextTransitionToState: withSubmit.toState });
    })
  );

  const idsNeedingSubmitCheck = rows.filter((o) => statusInfo.has(o.status)).map((o) => o.id);
  const { data: events } = idsNeedingSubmitCheck.length > 0 ? await eventsDB.findByOriginatingObjects("Objective", idsNeedingSubmitCheck) : { data: [] };
  // Keyed by (objectId, eventType) — a row's own status determines which
  // exact event type ("Objective" + status) counts as "submitted" for it;
  // an unrelated event on the same object (e.g. ObjectiveTransitioned) must
  // not count.
  const submittedKeys = new Set((events ?? []).map((e) => `${e.originating_object_id}:${e.event_type}`));

  for (const o of rows) {
    const info = statusInfo.get(o.status);
    result.set(o.id, {
      submitVerb: info?.submitVerb ?? null,
      alreadySubmitted: info ? submittedKeys.has(`${o.id}:Objective${o.status}`) : false,
      nextTransitionVerb: info?.nextTransitionVerb ?? null,
      nextTransitionToState: info?.nextTransitionToState ?? null,
    });
  }
  return result;
}

// CR-076 (owner: "GET /objectives should have a requireTenant and include
// tenant filtering") — tenantId omitted means no filter (root sees every
// tenant); a provided value (including null, for a viewer with no resolved
// tenant) filters and fails closed, same convention objectivesDB.findAll
// itself already documents.
export async function listObjectives(tenantId?: string | null): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findAll(tenantId);
  const rows = data ?? [];
  const { data: committedIds } = await seusDB.commissionedObjectiveIds();
  const commissioned = new Set(committedIds ?? []);
  // Leaf detection in-memory: a node has children iff some other row names it as
  // parent. One pass over the full set, no extra query.
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  return rows.map((o) => toListItem(o, { commissioned: commissioned.has(o.id), hasChildren: parentsWithChildren.has(o.id) }));
}

// Parent-picker and "commission from an existing Objective" both need this —
// only Objectives still capable of being decomposed under / commissioned
// against, not ones already Achieved/Superseded/Retired/Archived.
export async function listSelectableObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findByStatuses(["Proposed", "Active"]);
  return (data ?? []).map((o) => toListItem(o));
}

// Ebook Library — Full Demo Walkthrough.md, real finding #3, closed properly
// this time: findOrCreateDefaultProfile's own comment flagged "no UI to
// choose between multiple real Profiles for a Template if that ever
// happens" as a known gap — this is that UI's data. Computed only when the
// Objective is Active (the only state "Commission an SEU" is even offered),
// and only meaningful when a Template actually satisfies every required
// Capability — a null preview means the commission button, if shown at all,
// falls back to the no-choice-available path (0 or 1 real Profile).
export interface CommissioningPreview {
  templateId: string;
  templateCode: string;
  templateName: string;
  candidateProfiles: Array<{ id: string; code: string; name: string; environment: string }>;
}

export interface ObjectiveDetailView {
  objective: ObjectiveRow;
  parent: ObjectiveListItem | null;
  children: ObjectiveListItem[];
  // CR-009: a leaf (no children) that is not Strategic is the only thing an SEU
  // can be commissioned against — the detail page gates the action on this.
  isLeaf: boolean;
  // CR-012: same removal-action rule as the tree rows (deletable = Proposed
  // leaf; retirable = Active).
  deletable: boolean;
  retirable: boolean;
  // CR-073 — Active -> Reject requires its own mandatory-comment
  // form, so it's excluded from possibleNextStates (the generic dropdown has
  // no comment field) and gated on this instead, same "Active" condition
  // retirable already uses.
  rejectable: boolean;
  // CR-075 — true once a Proposed Objective has been submitted for
  // activation: editing is locked so it can't be changed out from under the
  // objective_activate holder now reviewing it. See isObjectiveEditLocked.
  editLocked: boolean;
  requiredCapabilities: CapabilityRow[];
  comments: ObjectiveCommentRow[];
  possibleNextStates: string[];
  // CR-071 — toState -> verb, so a caller can check the viewer's own badge for
  // each specific option (transitionEngine's `objective_${verb}` convention) —
  // findPossibleNextStates alone only names the state, not what gates it.
  possibleTransitionVerbs: Record<string, string | null>;
  // CR-072 — set only when a transition out of the CURRENT status has a real
  // Submit step defined (transition_definitions.submit_verb). null means this
  // status has no submit step modeled yet — nothing to show, no gate applied.
  // submitToState is the button's own label (owner: "use the to state as the
  // button name instead of submit") — only one target exists for Proposed
  // today, so only one field, not yet an array; a from_state with genuinely
  // multiple manual targets needing their own independent submit/track state
  // is real, open, undecided design, not assumed here.
  submitVerb: string | null;
  submitToState: string | null;
  // Whether that submit step has already fired for this Objective — only
  // meaningful when submitVerb is non-null. Drives whether Submit or the
  // gated next-transition option is what's actually available.
  alreadySubmitted: boolean;
  commissioningPreview: CommissioningPreview | null;
}

export async function getObjectiveDetail(id: string): Promise<ObjectiveDetailView | null> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return null;

  const [{ data: children }, { data: requiredCapabilities }, { data: possibleTransitions }, { data: comments }, parent] = await Promise.all([
    objectivesDB.findChildren(id),
    objectivesDB.getRequiredCapabilities(id),
    transitionDefinitionsDB.findPossibleNextTransitions("Objective", objective.status),
    objectivesDB.getComments(id),
    objective.parent_objective_id ? objectivesDB.findById(objective.parent_objective_id).then((r) => r.data ?? null) : Promise.resolve(null),
  ]);

  // CR-072 — a transition with a defined submit_verb isn't a real option
  // until its own from_state (the current status) has actually been
  // submitted, regardless of whether the viewer holds its badge — that
  // check happens separately, in web/objectives.ts, on whatever remains here.
  const submitOption = (possibleTransitions ?? []).find((t) => t.submitVerb) ?? null;
  const submitVerb = submitOption?.submitVerb ?? null;
  const submitToState = submitOption?.toState ?? null;
  const alreadySubmitted = submitVerb ? await triggerEngine.hasBeenSubmitted("Objective", id, objective.status) : false;
  // CR-072 (owner: "governed should be the event pub/sub... focus on building
  // the manual now") — a governed transition (e.g. Active -> Achieved) has NO
  // manual path of any kind, regardless of whether the viewer happens to hold
  // its badge. This was previously unenforced here: `trigger` was fetched by
  // findPossibleNextTransitions but never checked, so a governed transition
  // silently appeared in the manual Transition dropdown for anyone holding
  // its badge (confirmed live: TESTER_ALL_ID holds objective_achieve).
  // CR-073 — Reject is excluded here too: it has its own mandatory-comment
  // form (below), not the generic dropdown, which has no comment field.
  const eligibleTransitions = (possibleTransitions ?? []).filter(
    (t) => t.trigger === "manual" && t.toState !== "Reject" && (!t.submitVerb || alreadySubmitted)
  );

  const childRows = children ?? [];
  const isLeaf = childRows.length === 0;
  // How many grandchildren each direct child has — so the detail tree can show
  // an expand affordance and each child's own commissionable state.
  const { data: childChildCounts } = await objectivesDB.childCounts(childRows.map((c) => c.id));

  let commissioningPreview: CommissioningPreview | null = null;
  // CR-009: commissionable only if a non-Strategic leaf (and Active).
  if (objective.status === "Active" && objective.tier !== "Strategic" && isLeaf) {
    // Objectives have no tenant_id column of their own, but requested_by
    // (owner, 2026-08-19: "they are tied to a user that is tied to a
    // tenant") resolves one — the requester's own tenant, same as any other
    // acting-user tenant lookup. Falls back to Platform-only (no tenant) for
    // a null/system-created requested_by, same conservative default
    // findCandidateTemplates itself already applies when given none.
    const requester = objective.requested_by != null ? await userDB.findById(objective.requested_by) : null;
    const candidates = await findCandidateTemplates((requiredCapabilities ?? []).map((c) => c.code), requester?.tenant_id ?? null);
    const template = candidates.find((c) => c.satisfies);
    if (template) {
      const realProfiles = await listRealProfilesForTemplate(template.id);
      commissioningPreview = {
        templateId: template.id,
        templateCode: template.code,
        templateName: template.name,
        candidateProfiles: realProfiles.map((p) => ({ id: p.id, code: p.code, name: p.name, environment: p.environment })),
      };
    }
  }

  // Not just this node's own alreadySubmitted (Proposed -> Active's own
  // submit_verb) — isObjectiveEditLocked also walks the ancestor chain,
  // since a locked ancestor locks its whole subtree too.
  const editLocked = await isObjectiveEditLocked(id);

  return {
    objective,
    parent: parent ? toListItem(parent) : null,
    children: childRows.map((c) => toListItem(c, { hasChildren: (childChildCounts?.get(c.id) ?? 0) > 0 })),
    isLeaf,
    // Proposed implies no SEU (commissioning requires Active), so a Proposed
    // leaf is deletable; an Active Objective is retirable (node + subtree).
    // CR-075 — not deletable once submitted for activation, same reasoning
    // (and same real enforcement, in deleteObjective) as editLocked.
    deletable: objective.status === "Proposed" && isLeaf && !editLocked,
    retirable: objective.status === "Active",
    rejectable: objective.status === "Active",
    editLocked,
    requiredCapabilities: requiredCapabilities ?? [],
    comments: comments ?? [],
    possibleNextStates: eligibleTransitions.map((t) => t.toState),
    possibleTransitionVerbs: Object.fromEntries(eligibleTransitions.map((t) => [t.toState, t.verb])),
    submitVerb,
    submitToState,
    alreadySubmitted,
    commissioningPreview,
  };
}

// CR-072 — the Submit half of a manual transition's queue step: records that
// the entity is ready to move on, without performing the transition itself.
// Only unlocks the badge-holder's own next-transition action afterward
// (getObjectiveDetail's own alreadySubmitted check) — this function never
// touches objectives.status. Badge-checked live (badgeAuthorityEngine), same
// as transitionObjective's own real actions — this is a real state-changing
// act (an event, even if not a status change), not just a list-rendering
// visibility hint the way CR-071's platformBadges-avoidance concern was about.
export async function submitObjective(id: string, actorId?: number | null): Promise<void> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) throw new Error(`Objective not found: ${id}`);
  const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", objective.status);
  const submitVerb = (transitions ?? []).find((t) => t.submitVerb)?.submitVerb ?? null;
  if (!submitVerb) throw new Error(`no Submit step is defined for Objective status "${objective.status}"`);

  const alreadySubmitted = await triggerEngine.hasBeenSubmitted("Objective", id, objective.status);
  if (alreadySubmitted) throw new Error(`Objective ${id} has already been submitted from status "${objective.status}"`);

  const requiredBadge = `objective_${submitVerb}`;
  const auth = await badgeAuthorityEngine.authorise({ actorId: actorId != null ? String(actorId) : "", requiredBadge });
  if (!auth.allowed) throw new Error(`requires badge ${requiredBadge}`);

  await triggerEngine.submit({ entityType: "Objective", entityId: id, fromState: objective.status, actorId: actorId != null ? String(actorId) : null });
}

// Edit is not a transition — no tier, no lifecycle-state gating (owner:
// "Edit is not a transition"). Tier is fixed at creation (owner: "Edit
// should not change the tier. This will cause utter confusion to the
// hierarchy"); the caller's badge check is the same one Delete uses
// (objective_propose), applied by the route, not here.
// CR-075 (owner: "Disallow Edit when the Objective has been proposed. it
// should not conflict with what the active badge is seeing") — once a
// Proposed Objective has been submitted (queued for activation), the
// objective_activate holder is now reviewing it as a real candidate; editing
// it out from under them would silently change what they're reviewing.
// Real enforcement here (the shared chokepoint both web and API routes call
// through), not just a hidden button — same discipline as CR-072's own
// not_submitted check.
// A node's own submission locks it; per the owner ("Locked node locks its
// whole subtree"), it also locks every descendant — same "whole subtree"
// pattern retireObjectiveSubtree already established (there via
// findDescendantIds walking down from the acted-on node; here via
// findAncestorPath, its own existing counterpart, walking up from the node
// being checked to see whether any ancestor is the one under review).
async function isProposedAndSubmitted(o: ObjectiveRow): Promise<boolean> {
  return o.status === "Proposed" && (await triggerEngine.hasBeenSubmitted("Objective", o.id, "Proposed"));
}

export async function isObjectiveEditLocked(id: string): Promise<boolean> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return false;
  if (await isProposedAndSubmitted(objective)) return true;

  const { data: ancestors } = await objectivesDB.findAncestorPath(id);
  for (const ancestor of ancestors ?? []) {
    if (await isProposedAndSubmitted(ancestor)) return true;
  }
  return false;
}

export async function updateObjective(
  id: string,
  input: { statement?: string; requiredCapabilityCodes?: string[]; requestedBy?: number | null; bumpVersion?: boolean }
): Promise<ObjectiveRow> {
  // CR-075 (owner: "Only propose can edit every field... All other states
  // can only add comments") — statement/Capabilities are only editable while
  // Proposed; every other status is Comments-only.
  const { data: current } = await objectivesDB.findById(id);
  if (!current) throw new Error(`Objective not found: ${id}`);
  if (current.status !== "Proposed") {
    throw new Error(`Objective is not Proposed (status: ${current.status}) — only Comments can be added once it has left Proposed`);
  }
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — editing is locked until the activate badge holder acts on it");
  }

  if (input.requiredCapabilityCodes) {
    const { data: capabilities, error: capErr } = await capabilitiesDB.findByCodes(input.requiredCapabilityCodes);
    if (capErr) throw capErr;
    const found = dedupeByCode(capabilities ?? []);
    const foundCodes = new Set(found.map((c) => c.code));
    const missing = input.requiredCapabilityCodes.filter((code) => !foundCodes.has(code));
    if (missing.length > 0) throw new Error(`unknown Capability code(s): ${missing.join(", ")}`);
    const { error: setErr } = await objectivesDB.setRequiredCapabilities(id, found.map((c) => c.id));
    if (setErr) throw setErr;
  }

  const { data, error } = await objectivesDB.update(id, {
    statement: input.statement,
    requestedBy: input.requestedBy,
    bumpVersion: input.bumpVersion,
  });
  if (error || !data) throw error ?? new Error("failed to update objective");
  return data;
}

// CR-009 re-parenting — move a node (and, implicitly, its whole subtree, which
// already points at it) under a new parent. Guards: no cycles (can't move under
// self or a descendant), the rank rule (new parent not more strategic than the
// moved node), and parent-required for non-Strategic tiers.
export async function reParentObjective(id: string, newParentId: string | null): Promise<ObjectiveRow> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);

  // CR-075 (owner: "Only propose can edit every field... adding moving is
  // all editing") — re-parenting is an edit of this Objective, only allowed
  // while it's Proposed, same as statement/Capabilities/Add child.
  if (node.status !== "Proposed") {
    throw new Error(`Objective is not Proposed (status: ${node.status}) — only Comments can be added once it has left Proposed`);
  }
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — editing is locked until the activate badge holder acts on it");
  }

  if (node.tier !== "Strategic" && !newParentId) {
    throw new Error(`a ${node.tier} Objective requires a parent (only Strategic may be a root)`);
  }
  if (node.tier === "Strategic" && newParentId) {
    throw new Error(`a Strategic Objective is a root and cannot be given a parent`);
  }

  if (newParentId) {
    if (newParentId === id) throw new Error("an Objective cannot be its own parent");
    const { data: parent } = await objectivesDB.findById(newParentId);
    if (!parent) throw new Error(`parent Objective not found: ${newParentId}`);
    if (TIER_RANK[node.tier] < TIER_RANK[parent.tier]) {
      throw new Error(`Objective tier (${node.tier}) cannot be more strategic than its new parent's tier (${parent.tier})`);
    }

    // Tenant reach (owner: "It should not move beyond the tenant scope") —
    // objectivesDB.updateParent only ever changes parent_objective_id, never
    // sponsoring_authority, so a move across a tenant boundary would leave
    // the moved subtree structurally under the new parent while still
    // attributed to its OLD tenant forever. Blocked outright, no root
    // exemption (unlike createObjective's own reach check) — moving is
    // never a legitimate cross-tenant operation, so there's no case to carve
    // out. Fails closed on a legacy null, same "NULL never matches" rule
    // used throughout (findAll/findRootsPage/createObjective).
    const nodeTenantId = node.sponsoring_authority?.tenant ?? null;
    const newParentTenantId = parent.sponsoring_authority?.tenant ?? null;
    if (nodeTenantId === null || newParentTenantId === null || nodeTenantId !== newParentTenantId) {
      throw new Error(`cannot move: the new parent belongs to a different tenant`);
    }

    const { data: descendantIds } = await objectivesDB.findDescendantIds(id);
    if ((descendantIds ?? []).includes(newParentId)) {
      throw new Error("cannot move an Objective under one of its own descendants (would create a cycle)");
    }
  }

  const { data, error } = await objectivesDB.updateParent(id, newParentId ?? null);
  if (error || !data) throw error ?? new Error("failed to move objective");
  return data;
}

// CR-012 — hard delete, allowed only for a **Proposed leaf**. A parent (has
// children) is never deletable; an Active/terminal Objective is retired, not
// deleted. A Proposed Objective structurally has no SEU (commissioning needs
// Active), but we assert it anyway. Removes the row + its Capability links only.
export async function deleteObjective(id: string): Promise<void> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);
  if (node.status !== "Proposed") {
    throw new Error(`only a Proposed Objective can be deleted (status: ${node.status}) — retire it instead`);
  }
  // CR-075 (owner: "Same with Delete. Once it is queued with the active
  // badge, it cannot be deleted") — same reasoning as isObjectiveEditLocked:
  // the objective_activate holder is now reviewing this exact Objective as a
  // candidate to activate, so deleting it out from under them is disallowed.
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — deletion is locked until the activate badge holder acts on it");
  }
  const { data: children } = await objectivesDB.findChildren(id);
  if ((children ?? []).length > 0) {
    throw new Error(`cannot delete an Objective that has children — delete its children first`);
  }
  const { data: existingSeu } = await seusDB.findByObjectiveId(id);
  if (existingSeu) {
    throw new Error(`cannot delete an Objective with a commissioned SEU (${existingSeu.id})`);
  }
  const { error } = await objectivesDB.delete(id);
  if (error) throw error;
}

// CR-012 — governed retire of an Active Objective **and its subtree**. Each
// currently-Active node (the target + every Active descendant) transitions
// Active→Retired via transitionObjective (the `objective_retire` badge; history
// + SEUs preserved). Descendants that are not Active have no →Retired edge and
// are skipped and reported, not force-changed. A denial on the target itself
// (e.g. missing badge) is thrown so the caller can surface it.
export async function retireObjectiveSubtree(input: { objectiveId: string; actorRole: string; actorId?: string }): Promise<{ retired: string[]; skipped: Array<{ id: string; status: ObjectiveStatus }> }> {
  const { data: node } = await objectivesDB.findById(input.objectiveId);
  if (!node) throw new Error(`Objective not found: ${input.objectiveId}`);
  if (node.status !== "Active") {
    throw new Error(`only an Active Objective can be retired (status: ${node.status})`);
  }

  const rootResult = await transitionObjective({ objectiveId: node.id, targetState: "Retired", actorRole: input.actorRole, actorId: input.actorId });
  if (!rootResult.ok) {
    const detail = "detail" in rootResult ? rootResult.detail : rootResult.reason;
    throw new Error(`retire blocked: ${detail}`);
  }

  const retired: string[] = [node.id];
  const skipped: Array<{ id: string; status: ObjectiveStatus }> = [];
  const { data: descendantIds } = await objectivesDB.findDescendantIds(input.objectiveId);
  for (const descId of descendantIds ?? []) {
    const { data: desc } = await objectivesDB.findById(descId);
    if (!desc) continue;
    if (desc.status !== "Active") {
      skipped.push({ id: descId, status: desc.status });
      continue;
    }
    const res = await transitionObjective({ objectiveId: descId, targetState: "Retired", actorRole: input.actorRole, actorId: input.actorId });
    if (res.ok) retired.push(descId);
    else skipped.push({ id: descId, status: desc.status });
  }
  return { retired, skipped };
}

// CR-009 re-parenting — valid new parents for `movingId`: any Objective that
// is not the node itself, not a descendant, and not more strategic than it
// (Proposed/Active only). Feeds the move parent-picker.
export async function listReParentCandidates(movingId: string): Promise<ObjectiveListItem[]> {
  const { data: node } = await objectivesDB.findById(movingId);
  if (!node) return [];
  if (node.tier === "Strategic") return []; // a root has no parent to pick
  const [{ data: selectable }, { data: descendantIds }] = await Promise.all([
    objectivesDB.findByStatuses(["Proposed", "Active"]),
    objectivesDB.findDescendantIds(movingId),
  ]);
  const blocked = new Set([movingId, ...(descendantIds ?? [])]);
  // Tenant reach (owner: "It should not move beyond the tenant scope") — the
  // real check lives in reParentObjective, but offering another tenant's
  // Objective as a pickable option here would leak its existence/statement
  // even though selecting it would just fail. Fails closed on a legacy null,
  // same "NULL never matches" rule used throughout.
  const nodeTenantId = node.sponsoring_authority?.tenant ?? null;
  return (selectable ?? [])
    .filter(
      (o) =>
        !blocked.has(o.id) &&
        TIER_RANK[node.tier] >= TIER_RANK[o.tier] &&
        nodeTenantId !== null &&
        (o.sponsoring_authority?.tenant ?? null) === nodeTenantId
    )
    .map((o) => toListItem(o));
}

// CR-009 tree — one server-side page of Strategic roots, each annotated with
// whether it has children (the expand affordance) and its commissioned state.
export async function getObjectiveRootsPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: ObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRootsPage(opts);
  const rows = data?.items ?? [];
  const [{ data: counts }, { data: committedIds }, submitInfo, lockedIds] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    seusDB.commissionedObjectiveIds(),
    computeSubmitInfo(rows),
    computeEditLockedIds(),
  ]);
  const commissioned = new Set(committedIds ?? []);
  return {
    items: rows.map((o) =>
      toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissioned: commissioned.has(o.id), editLocked: lockedIds.has(o.id), ...submitInfo.get(o.id) })
    ),
    total: data?.total ?? 0,
  };
}

// CR-073 — the proposer's "was rejected" filter/section (owner: "not a
// standalone page"), a third mode on the same Objectives list route. Each
// item carries its most recent comment as the rejection reason preview
// (owner: "use this to highlight the reject on the proposer's page").
export interface RejectedObjectiveListItem extends ObjectiveListItem {
  lastComment: ObjectiveCommentRow | null;
}

export async function getRejectedObjectivesPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: RejectedObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRejectedPage(opts);
  const rows = data?.items ?? [];
  const [comments, lockedIds] = await Promise.all([
    Promise.all(rows.map((o) => objectivesDB.getComments(o.id))),
    // CR-075 — a Reject-status row is never self-locked (isObjectiveEditLocked
    // only fires for Proposed), but it can still have a currently-submitted
    // ancestor, which locks it too — same rule as every other list here.
    computeEditLockedIds(),
  ]);
  return {
    items: rows.map((o, i) => {
      const objComments = comments[i]?.data ?? [];
      return { ...toListItem(o, { editLocked: lockedIds.has(o.id) }), lastComment: objComments[objComments.length - 1] ?? null };
    }),
    total: data?.total ?? 0,
  };
}

// CR-009 tree — the direct children of a node (lazy-loaded on expand), each
// annotated the same way so the row renders its own expand/commission state.
export async function getObjectiveChildren(parentId: string): Promise<ObjectiveListItem[]> {
  const { data: children } = await objectivesDB.findChildren(parentId);
  const rows = children ?? [];
  const [{ data: counts }, { data: committedIds }, submitInfo, lockedIds] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    seusDB.commissionedObjectiveIds(),
    computeSubmitInfo(rows),
    computeEditLockedIds(),
  ]);
  const commissioned = new Set(committedIds ?? []);
  return rows.map((o) =>
    toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissioned: commissioned.has(o.id), editLocked: lockedIds.has(o.id), ...submitInfo.get(o.id) })
  );
}

export interface ObjectiveSearchHit extends ObjectiveListItem {
  // root→node breadcrumb (statements), so a flat hit is legible in the tree's
  // absence. Empty for a root.
  path: Array<{ id: string; displayId: string | null; statement: string; tier: ObjectiveTier }>;
}

// CR-009 search mode — flat statement search across all tiers, each hit carrying
// its ancestor path for context. Filtered/sorted/paged in-memory by the caller.
export async function searchObjectives(tenantId?: string | null): Promise<ObjectiveSearchHit[]> {
  const { data } = await objectivesDB.findAll(tenantId);
  const rows = data ?? [];
  const [{ data: committedIds }, lockedIds] = await Promise.all([seusDB.commissionedObjectiveIds(), computeEditLockedIds()]);
  const commissioned = new Set(committedIds ?? []);
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  const byId = new Map(rows.map((o) => [o.id, o]));
  return rows.map((o) => {
    const path: ObjectiveSearchHit["path"] = [];
    let cursor = o.parent_objective_id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const p = byId.get(cursor);
      if (!p) break;
      path.unshift({ id: p.id, displayId: p.display_id, statement: p.statement, tier: p.tier });
      cursor = p.parent_objective_id;
    }
    return {
      ...toListItem(o, { commissioned: commissioned.has(o.id), hasChildren: parentsWithChildren.has(o.id), editLocked: lockedIds.has(o.id) }),
      path,
    };
  });
}

export type TransitionObjectiveResult =
  | { ok: true; objective: ObjectiveRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  // Structurally unreachable today (Objective has no seu_id — see the doc
  // comment below), but transitionEngine.evaluate's return type now includes
  // this reason unconditionally (SDK UI Layer Plan), so it's handled here
  // for type-correctness even though nothing can currently produce it.
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  // CR-073 — Reject (Active -> Reject) requires feedback every time (owner:
  // "make the comments fields mandatory for a Reject"), and it must actually
  // be new text, not the same value as the most recent comment already on
  // record (owner: "needs a new comment text every time... not just presence
  // of value in the field") — catches a stale/resubmitted value, not just an
  // empty one.
  | { ok: false; reason: "comment_required"; detail: string };

// Post-completion fix (Open Design Questions.md #3): every other SEU-scoped
// entity type now runs its transition through qualityGateEngine.evaluate
// first, same as transitionDeliverable always has. Objective deliberately
// does not — it has no seu_id (an Objective can precede, or outlive, any
// number of SEUs commissioned against it), and quality_gate_evaluations.seu_id
// is NOT NULL, so there is nowhere to record an evaluation against. Logged
// as a real, structural limitation, not silently skipped.
//
// CR-072 (owner: "the event should not be event transitioned... the
// respective events listed in Events Section 14 of chapter 1") — the past-
// tense verb name, not the target state name, for the one case they differ
// (Active -> ObjectiveActivated, not "ObjectiveActive"). CR-073 — Reject is a
// real, distinct status (owner: "It is Active to Reject" — not "Rejected",
// not a reuse of "Proposed"), so this needs no such split for it.
const OBJECTIVE_TRANSITION_EVENT: Partial<Record<ObjectiveStatus, string>> = {
  Active: "ObjectiveActivated",
  Reject: "ObjectiveRejected",
  Achieved: "ObjectiveAchieved",
  Superseded: "ObjectiveSuperseded",
  Retired: "ObjectiveRetired",
  Archived: "ObjectiveArchived",
};

export async function transitionObjective(input: { objectiveId: string; targetState: ObjectiveStatus; actorRole: string; actorId?: string; comment?: string }): Promise<TransitionObjectiveResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, reason: "not_found" };

  const fromState = objective.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { objective },
    entityId: objective.id,
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Objective ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // CR-073 — Reject (Active -> Reject) requires its own, new feedback on
  // every use. Checked after authorisation (so an under-badged actor sees
  // "authority_denied", not a comment-validation error) and before writing
  // anything.
  const trimmedComment = input.comment?.trim() ?? "";
  if (fromState === "Active" && input.targetState === "Reject") {
    if (!trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Rejecting requires feedback — provide a comment explaining what needs to change." };
    }
    const { data: existingComments } = await objectivesDB.getComments(objective.id);
    const mostRecent = existingComments?.[existingComments.length - 1];
    if (mostRecent && mostRecent.comment_text.trim() === trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Provide new feedback — this matches the most recent comment already on record." };
    }
  }

  const { data: updated, error } = await objectivesDB.updateStatus(objective.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update objective status");

  if (trimmedComment) {
    await objectivesDB.addComment(objective.id, input.actorId != null ? Number(input.actorId) : null, trimmedComment);
  }

  await eventBus.publish({
    eventType: OBJECTIVE_TRANSITION_EVENT[input.targetState] ?? "ObjectiveTransitioned",
    originatingObjectType: "Objective",
    originatingObjectId: objective.id,
    seuId: null, // an Objective has no single owning SEU (zero-or-many, not stored on ObjectiveRow)
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, objective: updated, appliedTransition: { fromState, toState: input.targetState } };
}

// Stands in for Book 3's undefined "Capability Pack" derivation mechanism
// (Ch.1 §10 references it, Ch.5's own Pack taxonomy never defines it — a real
// spec gap, not an MVP shortcut of a working one; see Build Plan §5 item 1).
// Deliberately simple and transparent: word-overlap against each Capability's
// name/description, not an opaque model call. Suggestions are a starting
// checkbox state, never the sole mechanism — a human still confirms them.
export async function suggestCapabilityCodes(statement: string): Promise<string[]> {
  const { data: capabilities } = await capabilitiesDB.findAll();
  const text = statement.toLowerCase();
  const matches: string[] = [];
  for (const cap of capabilities ?? []) {
    const haystack = [cap.name, cap.description ?? ""].join(" ").toLowerCase();
    const terms = haystack.split(/\W+/).filter((w) => w.length > 3);
    if (terms.some((term) => text.includes(term))) matches.push(cap.code);
  }
  return matches;
}
