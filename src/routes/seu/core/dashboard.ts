// Drives the SEU platform's landing page — a direct reflection of the layered
// architecture from design/foundations/03_Book 3 (Refined)/Introduction.md
// ("## The architecture becomes"): User Experience Layer / SEU Runtime Layer /
// Extension Framework / Runtime Kernel. Every component in that diagram is
// listed here with an honest status against what this MVP actually built —
// see design/mvp-build-plan/MVP Build Plan.md §1 and §5 for why each one is
// live, partial, or deferred. This is data the view renders, not something
// the view decides for itself.
import { seusDB } from "../../../dblayer/seusDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

export type ComponentStatus = "live" | "partial" | "deferred";

export interface ArchitectureComponent {
  name: string;
  status: ComponentStatus;
  note: string;
  href?: string;
}

export interface ArchitectureLayer {
  name: string;
  components: ArchitectureComponent[];
}

export function getArchitectureLayers(): ArchitectureLayer[] {
  return [
    {
      name: "User Experience Layer",
      components: [{ name: "Admin UI", status: "live", note: "This dashboard and the SEU/Pack pages beneath it.", href: "/aisworg/seu" }],
    },
    {
      name: "SEU Runtime Layer",
      components: [
        { name: "SEU Runtime", status: "live", note: "Commissioning pipeline + Ch.37 lifecycle (Pending → Operational).", href: "/aisworg/seu/seus" },
        { name: "Capability Runtime", status: "live", note: "Capability requirements + Capability Fulfilment; the Dispatch Engine consumes it (see Work Item Runtime).", href: "/aisworg/seu/seus" },
        { name: "Governance Runtime", status: "partial", note: "Authority + Policy (with real Constraint Type: Policy blocks, Standard doesn't) + Obligation + Quality Gate are real (Ch.22-24, 26); Review and Compliance Packs remain deferred." },
        { name: "Work Item Runtime", status: "partial", note: "Command / Work Item Generator / Dispatch Engine pipeline is real (Ch.31-33); dispatch strategy is trivial 'whoever's assigned' — no cost/load/locality strategies yet." },
        { name: "Knowledge Runtime", status: "partial", note: "Evidence, Knowledge and Decision are real (Ch.16-17, 19), each with their own governed lifecycle; a Deliverable transition can require accepted Evidence or an approved Decision. Acquisition Scope promotion is governed (Ch.16 §12) and raises an Organisational Learning Obligation (Ch.23 §7); Engineering Capital has a real platform-wide screen (Ch.16 §13). No Ontology (Ch.18) — categories stay free text.", href: "/aisworg/seu/knowledge/capital" },
        { name: "Workflow Runtime", status: "partial", note: "Dependency Engine sequences Deliverables; no separate Workflow abstraction." },
        { name: "Traceability Runtime", status: "partial", note: "Event log gives structural traceability; no Ontology/Traceability Model." },
      ],
    },
    {
      name: "Extension Framework",
      components: [
        { name: "Pack Manager", status: "live", note: "Hand-authored Pack JSON, loaded by a seed script.", href: "/aisworg/seu/packs" },
        { name: "Extension Registry", status: "deferred", note: "No dynamic Pack discovery — seeded at deploy time." },
        { name: "Dependency Manager", status: "partial", note: "Packs declare dependencies; nothing resolves them yet (no Pack SDK)." },
        { name: "Lifecycle Manager", status: "deferred", note: "Packs carry a lifecycle status column but nothing drives transitions between them." },
      ],
    },
    {
      name: "Runtime Kernel",
      components: [
        { name: "Event Bus", status: "live", note: "In-process publish, Postgres-backed event log (Ch.30 minimal instance)." },
        { name: "Observability", status: "partial", note: "Engineering Telemetry (Ch.35) is real: Flow (Deliverable cycle time) and Governance (Quality Gate latency) metrics, derived from real activity; sustained Quality Gate blocking raises an Organisational Learning Obligation automatically. No Runtime/Knowledge/Quality/Collaboration Telemetry categories yet, no Predictive or Cross-SEU comparison views.", href: "/aisworg/seu/telemetry" },
        { name: "Scheduling", status: "deferred", note: "Dependency-driven, not time-driven — by design (AP-004)." },
        { name: "Identity", status: "live", note: "Reuses the existing app's session/passport auth." },
        { name: "Security", status: "partial", note: "Session auth + one Authority Rule type; Dual Authority Model deferred." },
        { name: "Storage", status: "live", note: "PostgreSQL — the same database as the rest of this app." },
        { name: "Configuration", status: "live", note: "Environment variables, same convention as the rest of this app." },
        { name: "Messaging", status: "deferred", note: "No broker — Event Bus is in-process only." },
      ],
    },
  ];
}

export interface DashboardCounts {
  seuCount: number;
  packCount: number;
  eventCount: number;
  recentEvents: EventRow[];
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [{ data: seuCount }, { data: packCount }, { data: eventCount }, { data: recentEvents }] = await Promise.all([
    seusDB.count(),
    packsDB.count(),
    eventsDB.count(),
    eventsDB.findRecent(10),
  ]);
  return {
    seuCount: seuCount ?? 0,
    packCount: packCount ?? 0,
    eventCount: eventCount ?? 0,
    recentEvents: recentEvents ?? [],
  };
}
