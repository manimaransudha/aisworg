# Governance & EBM Sharpening — Plan (Phase 16)

*Produced 2026-08-12. Resolves §4.1, §4.2, §4.3 of `Spec Gap Analysis and Remaining Build Plan.md` (Ch.3 EBM, Ch.21 Governance, Ch.26 Quality Gate). Planning document. Chapter references are to `03_Book 3 (Refined)`.*

## ✅ Built 2026-08-12

All four steps built and verified. `ebms.version` (`031`) versions every EBM (FR-3.3/3.10). `compositionEngine` detects **cross-pack** governance conflicts (authority-role clash on the same governedTransition; two Packs' gates on the same triple) from `packs.contributions`, and `commissionSeu` **hard-blocks** on them — the SEU never reaches Operational (FR-3.6/3.7/21.7). `getEffectiveGovernanceModel(seuId)` + `GET /seus/:id/governance-model` give the one effective Governance Model per SEU, derived from its EBM's composed Packs (FR-21.1). `quality_gate_evaluations.seu_id` is nullable with a CHECK enforcing the scope invariant (`032`, §4.3 / Open Q #3). Covered by `tests/governance-ebm-sharpening.test.ts` (146/146 suite green) and the dry-run suite (73/73). **The critical correctness catch:** the conflict detector had to be **cross-pack only** — `platform-core-engineering` legitimately assigns three roles to `knowledgescope.transition`, which is intra-pack design, not a conflict; the first cut flagged it and broke all commissioning until fixed.

## Resolved 2026-08-12

- **A — Hard-block commissioning** on a detected composition conflict (FR-3.7). ✅ building.
- **B — Effective Governance Model computed-on-read** projection (FR-21.1). ✅ building.
- **C — Quality Gates on Pack/Objective: resolved (2026-08-12).** Make `quality_gate_evaluations.seu_id` nullable **and** enforce the scope invariant with a CHECK, so the nullability can't be misused: `CHECK ((entity_type IN ('Pack','Objective') AND seu_id IS NULL) OR (entity_type NOT IN ('Pack','Objective') AND seu_id IS NOT NULL))`. Platform-level entities must have a null SEU; every SEU-scoped entity must have one. (Stronger than the original C1 "just make it nullable" — the invariant is enforced, not merely allowed.) ✅ building.

## 0. What this sharpens

These are partial realisations inside already-"done" phases — not new models. Four concrete FRs are unmet:

- **FR-3.3 / FR-3.10 — the EBM shall be versioned.** `ebms` has `status` (Composed/Active/Superseded) but no version integer.
- **FR-3.6 / FR-3.7 / FR-21.7 — behavioural/governance conflicts detected before commissioning, and conflicts requiring human judgement prevent commissioning.** `compositionEngine` returns `conflicts: []` hardcoded — it never detects, and commissioning never blocks.
- **FR-21.1 — every SEU shall possess one effective Governance Model derived from its EBM.** Governance is evaluated ad hoc per transition; it is never materialised or exposed as *this SEU's* governance model to inspect.
- **§4.3 / Open Design Question #3 — Quality Gates cannot gate Pack or Objective transitions** because `quality_gate_evaluations.seu_id` is `NOT NULL` and neither entity has a `seu_id`.

## 1. Built-state facts that shape the design

- `compositionEngine.compose` resolves Pack rows and applies the **Override** strategy for same-code duplicates (later wins, a *warning*), but `conflicts` is always empty. Commissioning consumes the report but blocks on nothing.
- **`packs.contributions` stores the full declarative payload as JSONB** — so conflict detection can read each composed Pack's `authorityRules`/`qualityGates`/`policies` **unmasked**, before the global upsert-by-code/triple collapses them. This is the key enabler: detect from the composed Packs' contributions, not from post-upsert DB rows.
- Authority rules and quality gates upsert **globally by code / by `(entity_type,from,to)` triple**; multiple *policies* per transition co-apply and are all evaluated (so multiple policies are **not** a conflict).
- Base packs today: `platform-core-engineering` contributes the authority rules + 2 quality gates; `technology-nodejs` contributes only a policy on `deliverable.transition` and **no** authority rules or quality gates. So a conflict detector scoped to authority-role and quality-gate-triple clashes will **not** trip standard commissioning.

## 2. Decisions (proposed — load-bearing ones flagged)

1. **EBM versioning (FR-3.3/3.10).** Add `version` integer to `ebms`, set at composition. The first EBM for an SEU is version 1; a recomposition that supersedes the prior EBM for the same SEU takes `prior.version + 1`. Recomposition itself is not a built flow yet, so in practice version is 1 today — but the field + the "set at composition, increment on supersession" rule satisfy FR-3.3 and make FR-3.10 true when recomposition lands.

2. **[NEEDS DECISION — A] Composition conflict detection + hard block (FR-3.6/3.7/21.7).** `compositionEngine` inspects the composed Packs' `contributions` (from `packs.contributions`) and reports a **conflict** when:
   - two *different* Packs contribute authority rules for the **same `governedTransition` with different `authorisedRole`** (ambiguous: only one role can govern a transition); or
   - two *different* Packs contribute quality gates on the **same `(entityType, fromState, toState)` triple** (only one gate per triple on the single-gate path).
   Same-code duplicates stay **Override** (warning, auto-resolved); multiple policies are **not** a conflict. When `conflicts` is non-empty, **commissioning aborts** (returns `ok:false, stage:"compose"`) — it never reaches Operational, and no partial SEU is left governing (FR-3.7 "prevent commissioning until resolved"). *Recommendation: build this; it does not trip the base packs.* *Confirm: hard-block (recommended) vs. record-and-warn-only.*

3. **[NEEDS DECISION — B] Effective Governance Model per SEU (FR-21.1): computed-on-read projection vs. materialised table.**
   - *B1 (recommended)* — a read-only projection `getEffectiveGovernanceModel(seuId)` derived from the SEU's EBM composed Packs: the applicable authority rules, policies, quality gates, and obligation/evidence/review expectations, assembled on read (always current, like the compliance evaluation). Exposed via API + a web surface. No new stored table.
   - *B2* — materialise the effective model into a table at commissioning. More to keep in sync; only worth it if inspection must be point-in-time frozen.
   - *Recommendation: B1.*

4. **[NEEDS DECISION — C] Quality Gates on Pack/Objective (§4.3, Open Q #3): make `quality_gate_evaluations.seu_id` nullable vs. accept platform entities are Authority+Policy-only.**
   - *C1 (recommended)* — make `seu_id` nullable so Pack and Objective transitions (which have no `seu_id`) can be gated and their evaluations recorded. Small migration; unblocks a real limitation and completes Ch.26's "every governed entity type" intent.
   - *C2* — accept the limitation permanently; document that Pack/Objective are governed by Authority + Policy only.
   - *Recommendation: C1.*

## 3. What is new vs. extension

**Extension:** `compositionEngine` gains real conflict detection (reads `packs.contributions`); `commissioning` gains a conflict gate before it proceeds; `ebms` gains a `version` column set at composition; `quality_gate_evaluations.seu_id` becomes nullable; the governance resolvers already exist and are only *assembled* for the effective-model projection.

**Genuinely new:** the effective-Governance-Model projection (`core/governanceModel.ts`) + its API/web surface; the conflict-detection logic + the commissioning block; the EBM version field.

## 4. Build sequence

**Standing check (every step):** conflict detection is deterministic and reads only declarative Pack contributions; the effective model is read-only (never mutates governance); the base packs still commission cleanly.

1. **EBM version (FR-3.3/3.10).** `ebms.version` column; set at composition (1, or prior+1 on supersession). *Done when:* a commissioned SEU's EBM has version 1 and the field is exposed.
2. **Composition conflict detection + block (FR-3.6/3.7/21.7).** `compositionEngine` detects authority-role and quality-gate-triple conflicts from composed Packs' contributions; `commissionSeu` aborts when conflicts exist. *Done when:* commissioning two Packs with a genuine authority-role conflict is refused with a clear reason and leaves no SEU; the base packs still reach Operational.
3. **Effective Governance Model projection (FR-21.1).** `getEffectiveGovernanceModel(seuId)` assembling the SEU's authority/policy/quality-gate/obligation-expectation set from its composed Packs; API + web surface. *Done when:* an SEU exposes a single inspectable governance model derived from its EBM.
4. **Quality Gates on Pack/Objective (§4.3).** `quality_gate_evaluations.seu_id` made nullable **with a CHECK enforcing the scope invariant** (`(entity_type IN ('Pack','Objective') AND seu_id IS NULL) OR (entity_type NOT IN ('Pack','Objective') AND seu_id IS NOT NULL)`); `qualityGateEngine.recordAndPass/Block` pass a null SEU for Pack/Objective. *Done when:* a Pack or Objective transition can carry a Quality Gate that evaluates and records with a null SEU, and the CHECK rejects a mis-scoped row (e.g. a Deliverable evaluation with null SEU, or a Pack evaluation with a SEU).

## 5. Open decisions (for confirmation before build)

- **A — Composition conflicts hard-block commissioning (recommended) or record-and-warn only?**
- **B — Effective Governance Model computed-on-read (recommended) or materialised?**
- **C — Make `quality_gate_evaluations.seu_id` nullable to gate Pack/Objective (recommended), or accept the limitation?**
