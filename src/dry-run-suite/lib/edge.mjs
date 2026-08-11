// ============================================================================
// THE SWAP POINT (Participant Integration Plan §0.1, Resolution 10).
//
// Everything in THIS file simulates the tenant's own environment — its version
// control system and its participants (human or AI orchestrator). When a real
// adapter is built for a tenant, THIS file is what gets replaced; the platform
// client (platform.mjs) and the scenarios do not change, because the platform's
// core is tenant- and transition-type-invariant. If a future change to the
// platform forces an edit outside this file to keep the suite working, that is a
// core-invariance regression worth investigating.
//
// The platform never sees any of this. It only ever receives an opaque VCS
// reference string and a result-in outcome. The suite deliberately feeds it
// weird, provider-specific reference strings to prove the core stores them
// verbatim and never parses them.
// ============================================================================

// A per-tenant simulated version control system. Different tenants use different
// providers and reference shapes on purpose — the core must not care.
export class SimVCS {
  constructor(provider = "git", org = "tenant") {
    this.provider = provider;
    this.org = org;
    this.repos = new Map(); // ref -> { path, content, message, at }
    this.seq = 0;
  }

  // "Commit" an artifact and return the opaque reference the participant hands
  // back to the platform. The shape is intentionally provider-specific.
  commit({ repo = "app", path = "artifact", content = "", message = "work" } = {}) {
    this.seq += 1;
    const sha = `${(this.seq * 2654435761 % 0xfffffff).toString(16)}${this.seq}`;
    const ref =
      this.provider === "git"
        ? `git+ssh://${this.org}@vcs/${repo}.git#${sha}:${path}`
        : this.provider === "svn"
        ? `svn://${this.org}.example/${repo}/trunk/${path}@r${this.seq}`
        : `${this.provider}://${this.org}/${repo}/${path}?rev=${sha}`;
    this.repos.set(ref, { repo, path, content, message, at: new Date().toISOString() });
    return ref;
  }

  resolve(ref) {
    return this.repos.get(ref) ?? null;
  }
}

// A simulated participant — human or AI orchestrator. It receives an assignment
// (which the platform delivered), "does work" in its own environment (the SimVCS),
// and returns the result-in payload. `behaviour` picks the path so scenarios can
// exercise success and every failure mode:
//   "succeed" — commit an artifact, return { outcome:'done', reference }
//   "empty"   — return done with NO reference (the empty-centre case)
//   "fail"    — return { outcome:'failed' }
//   "blocked" — return { outcome:'blocked' }
export class SimParticipant {
  constructor({ kind = "AI", name = "agent", vcs, behaviour = "succeed" } = {}) {
    this.kind = kind; // "AI" | "Human" | "External" — the platform participant.type
    this.name = name;
    this.vcs = vcs;
    this.behaviour = behaviour;
  }

  // assignment: { workItemId, targetState, deliverableName }
  execute(assignment) {
    switch (this.behaviour) {
      case "fail":
        return { outcome: "failed", reference: null };
      case "blocked":
        return { outcome: "blocked", reference: null };
      case "empty":
        return { outcome: "done", reference: null };
      case "succeed":
      default: {
        const ref = this.vcs.commit({
          repo: slug(assignment.deliverableName || "deliverable"),
          path: `${slug(assignment.targetState)}/output`,
          content: `${this.kind} ${this.name} produced ${assignment.deliverableName} @ ${assignment.targetState}`,
          message: `${assignment.deliverableName} -> ${assignment.targetState}`,
        });
        return { outcome: "done", reference: ref };
      }
    }
  }
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// A simulated tenant orchestrator: a local HTTP endpoint the platform delivers
// assignments to (external-orchestrator mode). It captures every assignment-out
// the platform pushes, so the suite can assert the platform actually reached the
// tenant's environment with the right tenant identity + VCS binding. THIS, too,
// is the swap point — a real tenant's orchestrator (LangGraph, a queue, a bespoke
// service) replaces it, and the platform side does not change.
import http from "node:http";

export class SimOrchestrator {
  constructor() {
    this.received = [];
    this.server = null;
    this.url = null;
  }

  async start() {
    this.server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let assignment = null;
        try { assignment = JSON.parse(raw || "{}"); } catch { assignment = raw; }
        this.received.push({ url: req.url, auth: req.headers["authorization"], assignment });
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise((resolve) => this.server.listen(0, resolve));
    this.url = `http://127.0.0.1:${this.server.address().port}`;
    return this.url;
  }

  async stop() {
    if (this.server) await new Promise((resolve) => this.server.close(resolve));
  }

  // Delivery happens inside the platform's dispatch (awaited), so the assignment
  // is normally present the moment dispatch returns; poll briefly to be robust to
  // any scheduling lag.
  async waitFor(workItemId, timeoutMs = 1500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = this.received.find((r) => r.assignment && r.assignment.workItemId === workItemId);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  }
}
