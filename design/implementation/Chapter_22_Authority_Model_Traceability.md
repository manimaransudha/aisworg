# Chapter 22 – Authority Model: Implementation Traceability

**Date of report: 4-10-2026**

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is permission to perform a governed action, not a Participant attribute<br> Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:1-5<br>src/domain/engine/transitionEngine.ts:8-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorise({actorId, requiredBadge})</code> is a relationship between an action's required <code>noun_verb</code> badge and an actor's held badges, not a field on the Participant record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is contextual (depends on EBM, Deliverable state, Governance Model, Policies, Obligations, Authority Packs)<br> Ref: §4 Definition, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:83-99<br>src/domain/engine/badgeAuthorityEngine.ts:55-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEngine.evaluate()</code> derives which badge is required from the matched <code>transition_definitions</code> row (so context selects *which* badge), but <code>badgeAuthorityEngine.authorise()</code> itself takes only <code>actorId</code> and <code>requiredBadge</code>. Policy and Quality Gate are separate sequential checks after authority, not inputs to the authority decision itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-001 Authority governs engineering state transitions<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:83-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The badge check runs before any state write in <code>evaluate()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-002 Authority is contextual<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:90-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as the §4/§9 row above: contextual only via badge selection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-003 Authority is composable (multiple Packs)<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts<br>src/domain/engine/compositionEngine.ts:498-515</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The live enforcement vocabulary (<code>authority_nouns</code>/<code>authority_verbs</code>/<code>authority_noun_verbs</code>, read via badge codes in <code>authorised_badges</code>) carries no Pack-linkage column. A real <code>detectGovernanceConflicts()</code> exists and reads <code>pack.contributions?.authorityRules</code>, but this operates on the separate <code>authority_rules</code> table, which <code>transitionEngine.ts:8-12</code>'s own header comment documents as retired from the enforcement path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-004 Authority remains independently traceable<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/041_events_actor_accountability.sql (events.actor_id, events.authority_badge)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorityBadge</code> is resolved and returned by <code>transitionEngine.evaluate()</code> (transitionEngine.ts:95-108) for the caller to record on its own transition event. Captures badge + actor on the event, no originating Pack, Governance Model, or rationale field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-005 Authority may be delegated<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>grep -rniE "delegat" src --include="*.ts"</code> returns no occurrence referring to an authority-delegation feature (only unrelated uses of the English word "delegate(s)" in comments about function call delegation). No delegating/receiving-authority relationship, scope, duration, or conditions construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-006 Authority independent of organisational titles<br> Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:16-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Badges are verb-shaped (<code>entityType_verb</code>, e.g. <code>pack_define</code>), not role/title-shaped; <code>authorise()</code> takes a bare <code>actorId</code>, never a role or title.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.1 Every governed engineering action requires explicit authority<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:90-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate()</code> requires the badge whenever <code>definition.verb</code> is set; a transition row with <code>verb === null</code> skips the check entirely (an explicitly ungoverned step by the row's own definition, not a bypass of a governed one).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.2 Authority evaluated before execution<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:90-99 (authority) vs. :125+ (policy, quality gate)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The badge check runs first in <code>evaluate()</code>, before the policy loop and before quality-gate checks, and before any caller proceeds to its own state write.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.3 Authority rules contributed through Packs<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts<br>src/domain/engine/compositionEngine.ts:498-515</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same structural disconnect as AM-003: the composition/conflict-detection path exists but targets the retired <code>authority_rules</code> table; the live <code>noun_verb</code> badge vocabulary that <code>badgeAuthorityEngine</code> actually checks has no Pack dimension.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.4 Authority assignments remain fully traceable<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/041_events_actor_accountability.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as AM-004 — partial field coverage (badge + actor on event), no originating Pack / Governance Model / rationale.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.5 Authority supports delegation<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as AM-005.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.6 Authority supports multiple participating organisations<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:5,20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants_master</code> carries <code>tenant_id NOT NULL</code> and <code>authorised_badges</code> on the same row, so held badges are inherently tenant-scoped per actor. But the badge *vocabulary itself* (<code>authority_nouns</code>/<code>verbs</code>/<code>noun_verbs</code>) and the <code>transition_definitions</code> rows that declare required badges carry no <code>tenant_id</code> — there is one global required-badge-per-transition, not an organisation-composed one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-22.7 Authority conflicts detected during governance evaluation<br> Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:442,498-515</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>detectGovernanceConflicts()</code> is real and is called once, at SEU commissioning (core/commissioning.ts), operating on Pack-contributed <code>authorityRules</code> — but it never runs inside <code>transitionEngine.evaluate()</code> per transition attempt, and never touches the live <code>noun_verb</code> badge tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Components: Authority/Delegation/Escalation/Approval/Exception/SoD Rules<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only "Authority Rules" exists as a named construct (and only in the disconnected <code>authority_rules</code> table). Delegation, Escalation, Exception Rules: no matching construct in <code>src/</code>. Approval is not distinct — <code>_approve</code> is one verb among many in the flat vocabulary. Separation of Duties is not a declared rule table (see §13 row below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Sources: Platform/Organisation/Domain/Compliance/Customer Packs composed into one effective model<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts<br>(no tenant/Pack column on authority_nouns/verbs/noun_verbs)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One flat, global <code>noun_verb</code> vocabulary, seeded once, shared by every tenant/SEU; no per-Pack or per-source contribution feeds the live enforcement tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Evaluation considers requested action, Deliverable state, Participant identity, fulfilled Capabilities, Governance Model, Policies, Obligations, engineering stage<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:55-73<br>src/domain/engine/transitionEngine.ts:83-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorise()</code> consults exactly <code>actorId</code> (Participant identity) and <code>requiredBadge</code> (action, indirectly, via the resolved transition row). Deliverable state is used only to select the transition row, not passed into the authority check. Capabilities, Governance Model, Obligations, and engineering stage are not read by the authority check; Policies are a separate, sequential check after authority, not folded into the authority decision.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Evaluation produces one deterministic outcome<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:63-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Single code path, single lookup against <code>authorised_badges</code>/root — deterministic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Outcomes: Authorised / Authorised with Conditions / Not Authorised / Escalation Required / Delegation Required / Waiver Required, each with rationale<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:63-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorise()</code> returns exactly <code>{allowed:true, via, matchedBadge?}</code> or <code>{allowed:false, reason:"missing_badge"}</code>. Multi-badge support exists (<code>requiredBadge</code> may be an array, with <code>matchedBadge</code> reported — e.g. Pack's Draft→Validated reachable by <code>pack_validate</code> OR <code>pack_define</code> OR <code>pack_reject</code>), but this is still a binary allowed/denied outcome, not the chapter's multi-tier outcome set. No free-text rationale field; the closest is the required badge code plus the fixed string <code>"missing_badge"</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Delegation: explicit delegating/receiving authority, scope, duration, conditions, never implicit, traceable<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation construct anywhere in <code>src/</code> (confirmed by grep for "delegat" restricted to authority-relevant hits — none found).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Composition: multiple organisations' Packs resolve deterministically into one Effective Authority Model<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:33-87,442</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compose()</code> is real — merges Template-mandatory + Profile-optional Packs with a deterministic "later composition wins" rule — but it runs once at commissioning, on the retired <code>authority_rules</code>/Pack-contribution shape. The live <code>noun_verb</code> badge vocabulary actually checked by <code>badgeAuthorityEngine</code> has no Pack dimension to compose, so no "Effective Authority Model" artifact is ever produced from it.</td>
    </tr>
| Separation of Duties: declarative constraints contributed through Packs (e.g. implementer cannot approve own Deliverable) | §13 | — | No `separation_of_duties` table or declared-rule construct found (`grep -rn "mustDifferFromActorOf\|separation_of_duties" src` returns nothing). Any such constraint today is purely emergent from which badges happen to be granted to which actor in `authorised_badges` — nothing in the authority check itself enforces it as a rule. | Not met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Traceability: governing rule, originating Pack, requesting Participant, authorised Participant, affected Deliverable, Governance Model, timestamp, rationale — immutable<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/041_events_actor_accountability.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>events.actor_id</code> + <code>events.authority_badge</code> capture authorised Participant and governing-rule-as-badge-code, plus <code>events.occurred_at</code> for timestamp and <code>events.originating_object_id</code> for affected Deliverable. No originating Pack, no Governance Model reference, no requester-vs-authoriser distinction (no delegation exists to create one), no rationale field. 4 of 8 required fields present.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: AuthorityRequested/Granted/Denied/Delegated/Escalated/Expired/Revoked published<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>grep -rno 'eventType: "Authority[A-Za-z]*"' src --include="*.ts"</code> returns zero matches. An authority denial is a synchronous return value from <code>transitionEngine.evaluate()</code>, consumed directly by the calling route; never published to the Event Bus.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: deterministic evaluation<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:63-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One lookup, one outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: composition from multiple organisations<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants_master.tenant_id</code> scopes which badges an actor holds per tenant, but <code>transition_definitions</code> (the table declaring which badge a transition requires) carries no <code>tenant_id</code> — there is one global required-badge-per-transition, not a composed multi-organisation requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve complete traceability<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/041_events_actor_accountability.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as §14 row — partial field coverage.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support dynamic delegation<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of Participant implementations<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:55,63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorise()</code>/<code>getHeldBadges()</code> take a bare <code>actorId: string</code> and resolve via <code>participantsMasterDB.findById</code>, with no Participant-type-specific branching.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: every governed action requires explicit authority<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:90-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as FR-22.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: authority evaluated contextually<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:83-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same gap as §4/§9/AM-002 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: authority rules from multiple organisations composed<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:498-515</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as AM-003/FR-22.3 — composition exists but is structurally disconnected from live enforcement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: delegation explicit and traceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: separation-of-duties enforced<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as §13 — emergent, not enforced as a declared rule.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AC: authority decisions explainable and reproducible<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:63-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reproducible (deterministic). Explainable only to "which badge(s), held or not, via root/badge, matchedBadge" — no broader rationale.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority domain model<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:5,20<br>src/dblayer/authorityRulesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>authorised_badges</code> JSONB on <code>participants_master</code>, plus the flat <code>authority_nouns</code>/<code>verbs</code>/<code>noun_verbs</code> tables, exist — no delegation/escalation/SoD sub-model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority evaluation service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts<br>src/domain/engine/transitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists, narrower than spec (binary outcome, two-input check).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Delegation service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority registry<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists for the flat vocabulary.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority APIs<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/identity.ts:389</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>setAuthorisedBadges</code> path exists, admin-gated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority events<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist; confirmed by grep above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Authority traceability service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations/041_events_actor_accountability.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No dedicated service; passive partial capture via <code>events.actor_id</code>/<code>authority_badge</code>.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 33
- Fully met: 9
- Partially met: 15
- Not met: 9
- Not verifiable: 0

## Major gaps (unranked, in spec order)

1. The authority check itself (`badgeAuthorityEngine.authorise`) consults only `actorId` + `requiredBadge` — Capabilities, Governance Model, Obligations, and engineering stage are never read; "contextual" holds only in that different transitions require different badges (§4, §9).
2. Delegation does not exist anywhere in `src/` (§5 AM-005, §6 FR-22.5, §11, §16, §17).
3. The live `noun_verb` badge vocabulary has no Pack or tenant dimension; a real Composition Engine and conflict detector exist but operate on the separate, disconnected `authority_rules` table (§5 AM-003, §6 FR-22.3/FR-22.7, §8, §12, §17).
4. No `Authority*` event is ever published; authority denial is a synchronous return value only (§15).
5. Traceability captures badge + actor + timestamp + affected object, but never originating Pack, Governance Model, or rationale (§14, §16, §18).
6. Separation of Duties has no declared-rule construct; it holds today only as an accident of which badges are granted to which actor (§13, §17).
7. Authority outcomes are binary (allowed/denied, with multi-badge "any one of" support) — the chapter's six-outcome set (Authorised with Conditions / Escalation Required / Delegation Required / Waiver Required) has no counterpart (§10).

Note: the chapter's own embedded §19 "Implementation Status & Gaps" section (dated 2026-08-22, updated 2026-09-05) reaches the same conclusions and additionally records an owner decision — confirmed still current in this pass — not to build any of the above extensions until a concrete situation requires one.
