import { demoStepsDB, type DemoStepRow } from "../../../dblayer/demoStepsDB.js";
import { demoScenariosDB } from "../../../dblayer/demoScenariosDB.js";
import { demoAreasDB, type DemoAreaRow } from "../../../dblayer/demoAreasDB.js";
import { getDemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { DEMO_AREAS } from "../../../dblayer/constants.js";
import { listStepKinds, listObjectiveKeys } from "./demoSimulator.js";

// Create and update of the demo catalogue from the Demo root page. Every function validates its input and
// throws an Error whose message the route shows to the user. Delete is a disable, so no row is removed.

export interface CatalogueAuthor {
  actorId: string;
  authorBadge: string;
}

type Form = Record<string, unknown>;

const text = (form: Form, field: string): string => String(form[field] ?? "").trim();
const optional = (form: Form, field: string): string | null => text(form, field) || null;

function area(form: Form): string {
  const value = text(form, "category");
  if (!(DEMO_AREAS as readonly string[]).includes(value)) throw new Error(`"${value}" is not a demo tab.`);
  return value;
}

function code(form: Form, field = "code"): string {
  const value = text(form, field);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) throw new Error(`Code "${value}" must be lower case words joined by hyphens.`);
  return value;
}

function required(form: Form, field: string, label: string): string {
  const value = text(form, field);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function sortOrder(form: Form, fallback: number): number {
  const raw = text(form, "sortOrder");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error("Order must be a whole number of zero or more.");
  return value;
}

function jsonObject(form: Form, field: string, label: string): Record<string, unknown> {
  const raw = text(form, field);
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function lines(form: Form, field: string): string[] {
  return text(form, field).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export async function listAreaContent(tenantId: string): Promise<DemoAreaRow[]> {
  const { data, error } = await demoAreasDB.findByTenant(tenantId);
  if (error) throw error;
  const rows = data ?? [];
  const missing = DEMO_AREAS.filter((a) => !rows.some((r) => r.area === a));
  if (missing.length > 0) throw new Error(`No tab text for ${missing.join(", ")}. Reset the demo data to load it.`);
  return DEMO_AREAS.map((a) => rows.find((r) => r.area === a) as DemoAreaRow);
}

export async function saveAreaContent(form: Form): Promise<string> {
  const { tenantId } = await getDemoActor();
  const tab = area(form);
  const howToSteps = lines(form, "howToSteps").map((t) => ({ text: t }));
  const { data, error } = await demoAreasDB.update(tenantId, tab, {
    stageTitle: required(form, "stageTitle", "Stage title"),
    howToLead: required(form, "howToLead", "How To lead"),
    howToSteps,
  });
  if (error) throw error;
  if (!data) throw new Error(`No tab text for ${tab}. Reset the demo data to load it.`);
  return `Saved the ${tab} tab text.`;
}

async function validateStepForm(form: Form): Promise<{
  kind: string; title: string; description: string | null; annotation: string | null; target: Record<string, unknown>; payload: Record<string, unknown>;
}> {
  const kind = required(form, "kind", "Kind");
  if (!listStepKinds().includes(kind)) throw new Error(`Kind "${kind}" has no handler. Choose one of: ${listStepKinds().join(", ")}.`);
  const target = jsonObject(form, "target", "Target");
  if (target.objectiveKey !== undefined && !listObjectiveKeys().includes(String(target.objectiveKey))) {
    throw new Error(`Target objectiveKey "${String(target.objectiveKey)}" is not an Objective key.`);
  }
  return {
    kind,
    title: required(form, "title", "Title"),
    description: optional(form, "description"),
    annotation: optional(form, "annotation"),
    target,
    payload: jsonObject(form, "payload", "Payload"),
  };
}

export async function createStep(form: Form, author: CatalogueAuthor): Promise<string> {
  const { tenantId } = await getDemoActor();
  const stepCode = code(form);
  const tab = area(form);
  const existing = await demoStepsDB.findByCode(tenantId, stepCode);
  if (existing.error) throw existing.error;
  if (existing.data) throw new Error(`Step "${stepCode}" already exists.`);
  const fields = await validateStepForm(form);
  const { error } = await demoStepsDB.insert({ tenantId, code: stepCode, area: tab, ...fields, authorId: author.actorId, authorBadge: author.authorBadge });
  if (error) throw error;
  return `Created step "${stepCode}".`;
}

export async function updateStep(stepCode: string, form: Form): Promise<string> {
  const { tenantId } = await getDemoActor();
  const current = await demoStepsDB.findByCode(tenantId, stepCode);
  if (current.error) throw current.error;
  if (!current.data) throw new Error(`No step "${stepCode}".`);
  const fields = await validateStepForm(form);
  const newCode = text(form, "newCode") ? code(form, "newCode") : stepCode;
  if (newCode !== stepCode) {
    const taken = await demoStepsDB.findByCode(tenantId, newCode);
    if (taken.error) throw taken.error;
    if (taken.data) throw new Error(`Step "${newCode}" already exists.`);
  }
  const { error } = await demoStepsDB.update(tenantId, stepCode, { ...fields, code: newCode });
  if (error) throw error;
  if (newCode === stepCode) return `Saved step "${stepCode}".`;
  // Playbooks refer to steps by code, so the scenarios that use the old code follow the rename.
  const scenarios = await demoScenariosDB.findByTenant(tenantId);
  if (scenarios.error) throw scenarios.error;
  const affected = (scenarios.data ?? []).filter((s) => s.playbook.includes(stepCode));
  for (const s of affected) {
    const renamed = await demoScenariosDB.update(tenantId, s.code, { title: s.title, playbook: s.playbook.map((c) => (c === stepCode ? newCode : c)), sortOrder: s.sort_order });
    if (renamed.error) throw renamed.error;
  }
  return `Saved step "${newCode}", renamed from "${stepCode}". ${affected.length} scenario(s) updated.`;
}

// A scenario takes the latest stage its steps reach, so no step may belong to a later tab than the scenario.
async function validatePlaybook(playbook: string[], tab: string, tenantId: string): Promise<void> {
  if (playbook.length === 0) throw new Error("The playbook needs at least one step.");
  const { data, error } = await demoStepsDB.findByTenant(tenantId);
  if (error) throw error;
  const steps = new Map((data ?? []).map((s: DemoStepRow) => [s.code, s]));
  const tabIndex = (DEMO_AREAS as readonly string[]).indexOf(tab);
  const problems: string[] = [];
  for (const stepCode of playbook) {
    const step = steps.get(stepCode);
    if (!step) problems.push(`"${stepCode}" is not a step`);
    else if ((DEMO_AREAS as readonly string[]).indexOf(step.area) > tabIndex) problems.push(`"${stepCode}" belongs to the later tab ${step.area}`);
  }
  if (problems.length > 0) throw new Error(`Playbook is invalid: ${problems.join("; ")}.`);
}

export async function createScenario(form: Form, author: CatalogueAuthor): Promise<string> {
  const { tenantId } = await getDemoActor();
  const scenarioCode = code(form);
  const tab = area(form);
  const all = await demoScenariosDB.findByTenant(tenantId);
  if (all.error) throw all.error;
  if ((all.data ?? []).some((s) => s.code === scenarioCode)) throw new Error(`Scenario "${scenarioCode}" already exists.`);
  const playbook = lines(form, "playbook");
  await validatePlaybook(playbook, tab, tenantId);
  const next = Math.max(0, ...(all.data ?? []).filter((s) => s.area === tab).map((s) => s.sort_order)) + 1;
  const { error } = await demoScenariosDB.insert({ tenantId, code: scenarioCode, area: tab, title: required(form, "title", "Title"), playbook, sortOrder: sortOrder(form, next), authorId: author.actorId, authorBadge: author.authorBadge });
  if (error) throw error;
  return `Created scenario "${scenarioCode}".`;
}

export async function updateScenario(scenarioCode: string, form: Form): Promise<string> {
  const { tenantId } = await getDemoActor();
  const current = await demoScenariosDB.findByCode(tenantId, scenarioCode);
  if (current.error) throw current.error;
  if (!current.data) throw new Error(`No scenario "${scenarioCode}".`);
  const playbook = lines(form, "playbook");
  await validatePlaybook(playbook, current.data.area, tenantId);
  // The stored progress is an index into the playbook, so a changed playbook starts again from its first step.
  const changed = JSON.stringify(playbook) !== JSON.stringify(current.data.playbook);
  const { error } = await demoScenariosDB.update(tenantId, scenarioCode, { title: required(form, "title", "Title"), playbook, sortOrder: sortOrder(form, current.data.sort_order) });
  if (error) throw error;
  if (changed) {
    const { error: progressError } = await demoScenariosDB.setProgress(tenantId, scenarioCode, 0);
    if (progressError) throw progressError;
  }
  return changed ? `Saved scenario "${scenarioCode}". Its playbook changed, so it starts again from the first step.` : `Saved scenario "${scenarioCode}".`;
}

export async function setScenarioEnabled(scenarioCode: string, enabled: boolean): Promise<string> {
  const { tenantId } = await getDemoActor();
  const { data, error } = await demoScenariosDB.setEnabled(tenantId, scenarioCode, enabled);
  if (error) throw error;
  if (!data) throw new Error(`No scenario "${scenarioCode}".`);
  return `Scenario "${scenarioCode}" ${enabled ? "enabled" : "disabled"}.`;
}
