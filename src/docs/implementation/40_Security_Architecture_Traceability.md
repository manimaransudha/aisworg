# Chapter 40 – Security Architecture: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security is pervasive and applies consistently across Runtime Services, Packs, Participants, Engineering Objects, External Interactions<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:77-144<br>src/middleware/gatekeeper.js:24-42</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A global session gate (gatekeeper) and a global route-authority gate are mounted ahead of every router, covering HTTP-reachable Participant interactions. <br>**Gap:** Pack security (publisher identity/signature) and Runtime Service-to-Runtime Service internal communication have no corresponding enforcement point — see rows below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security does not alter engineering behaviour<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:10-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The gate only permits/denies a request before it reaches a route handler; it does not touch transition/composition logic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security determines whether a requesting entity may participate; Governance/Authority determines whether a transition is permitted<br> Ref: §4 Definition, §10 Authorisation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:122-141<br>src/middleware/requireBadge.ts:58-90<br>src/domain/engine/badgeAuthorityEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform authorisation (route_authority badges/roles) and engineering authority (noun_verb badges checked inside transitionEngine via badgeAuthorityEngine) are two distinct, separately enforced checks, matching the spec's separation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-001 Trust is explicit; no entity trusted implicitly<br> Ref: §5 SA-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.js:24-41<br>src/middleware/routeAuthorityGate.ts:94-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every non-public path requires a session; a route with no <code>route_authority</code> row is denied by default ("fails closed"), not implicitly trusted. <br>**Deviation:** a <code>root</code>-badge dev/test bypass (NODE_ENV !== "production") and a superuser role bypass exist by design (documented in routeAuthorityGate.ts:17-20), which is an explicit, narrow exception rather than implicit trust.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-002 Identity precedes authority; every entity possesses a verifiable identity before participating<br> Ref: §5 SA-002, §8 Identity Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js:24-168<br>src/middleware/auth.js:56-95</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Human Participants get an identity via Google OAuth or local (bcrypt) credential, and a <code>participants_master</code> row is provisioned before any badge/authority check can occur. <br>**Gap:** AI Participants, External Systems, Connectors and Pack Publishers (also listed in §8) have no corresponding identity-issuance path in the repository — only Human Participants (via <code>users</code>/<code>participants_master</code>) are modelled. Runtime Services have no distinct service identity (FR-40.2) at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-003 Least privilege — every entity has only the permissions needed for its current responsibilities<br> Ref: §5 SA-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireBadge.ts:58-90<br>src/domain/engine/badgeAuthorityEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Badge-based authority is scoped per noun_verb and per route; nothing resembles a blanket all-permissions grant other than the explicit <code>root</code> bypass.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-004 Security is layered; no single mechanism relied on exclusively<br> Ref: §5 SA-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.js<br>src/middleware/routeAuthorityGate.ts<br>src/middleware/requireTenantScope.ts<br>src/middleware/requireBadge.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Four independent layers exist in sequence: session authentication, route-authority badge/role gate, tenant-scope check, and (inside transitions) badge-authority check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-005 Security is traceable; every security decision is auditable<br> Ref: §5 SA-005, §13 Auditing, FR-40.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:41-48<br>src/middleware/requestLogger.js:1-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Denials are written to the application logger (<code>logger.warn</code>) with actor email, method, path and reason. <br>**Gap:** this is a log line, not an audit record: it is not persisted as an immutable, queryable record, has no retention guarantee, and authentication success/failure, privilege changes, Pack publication and security-policy changes are not logged at all (searched for <code>AuthenticationSucceeded</code>, <code>AuthenticationFailed</code>, <code>AuthorisationGranted</code>, <code>AuthorisationDenied</code>, <code>SecurityViolationDetected</code>, <code>SecurityPolicyApplied</code> — no matches in the repository).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-006 Security policies are declarative wherever practical<br> Ref: §5 SA-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/route_authority_schema_recovery.sql<br>src/domain/identity/routeAuthorityCache.ts<br>src/dblayer/authorityRulesDB.ts:1-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Route-level authorisation (<code>route_authority</code> table, CR-110) and engineering authority rules (<code>authority_rules</code>, with <code>originating_pack_id</code>) are both data rows, not code literals — matches the declarative principle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.1 Every Participant has a unique identity<br> Ref: §6 FR-40.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts (findByUserId/create)<br>src/middleware/auth.js:56-71</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each non-demo user gets its own <code>participants_master</code> row, found-or-created keyed on <code>user_id</code>; the session's <code>user.id</code> is this participant id, not the raw <code>users.id</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.2 Every Runtime Service has a verifiable service identity<br> Ref: §6 FR-40.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No construct for a Runtime Service's own identity (distinct from a human/API-calling user) was found anywhere in <code>src/domain</code>, <code>src/middleware</code>, or the dblayer. Internal services call each other as plain in-process function calls, not as separately-identified principals.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.3 Every External Interaction is authenticated<br> Ref: §6 FR-40.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js:24-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Google OAuth and local-credential login authenticate the interactive (browser) external interaction. <br>**Gap:** no external system/API-key/service-to-service authentication path exists; the only "external interactions" the repository authenticates are human browser logins. Pack publisher authentication (§7 Pack Security) is absent (see packs.ts:13 below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.4 Every security decision is traceable<br> Ref: §6 FR-40.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:41-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as SA-005: decisions are logged, not persisted as audit records.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.5 Security policies support composition through Packs<br> Ref: §6 FR-40.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts:1-30 (originating_pack_id)<br>src/domain/engine/badgeAuthorityEngine.ts:65-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering authority rules can be contributed by a Pack (<code>originating_pack_id</code> column) and are composed into <code>badgeAuthorityEngine</code>'s resolution. <br>**Gap:** this covers engineering-authority composition only; platform-level security policy (route_authority, confidentiality policy) has no Pack-composition path — <code>route_authority</code> rows are seeded directly, not contributed via Pack installation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.6 Security credentials support rotation without service interruption<br> Ref: §6 FR-40.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Searched the repository for rotation logic (<code>grep -rli "rotat"</code> across <code>src</code>) — the only hits are an unrelated CSS class name and unrelated pack-content keywords. No password-reset, API-key-rotation, or OAuth-token-refresh-without-interruption mechanism exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.7 The platform detects unauthorised access attempts<br> Ref: §6 FR-40.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:41-48, 94-101, 125-141</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A denied request (missing session, missing badge/role, no route_authority row) is logged via <code>logger.warn</code>. <br>**Gap:** "detect" implies a traceable, reviewable signal distinct from best-effort stdout/log-file text; there is no stored record, no threshold-based alerting, and no <code>SecurityViolationDetected</code> event is ever published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant Security — identity and authentication of AI, Human and External Participants<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Human Participants are authenticated (Google OAuth / local). No AI Participant or External Participant identity/authentication path exists in the repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Security — protection of Runtime Services and internal communications<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No internal-communication authentication/authorization layer was found; Runtime Services communicate via direct in-process calls with no identity boundary.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack Security — validation of publisher identity, signatures and provenance<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:1-17, 229</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The module's own header comment states explicitly: "no digital signature/provenance verification (single-trusted-operator platform ... )". <code>publisher</code> is stored as a free-text declaration-only metadata field (packMetadataFromSeed, packs.ts:229,239) with no verification.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Data Security — protection of engineering state and engineering knowledge<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireTenantScope.ts:1-40<br>src/middleware/requireTenant.ts:1-18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tenant-scope middleware enforces that an actor can only reach rows belonging to their own tenant (or root bypass), which is the repository's substantive protection for engineering state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interaction Security — protection of all external communications<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:77-82 (session cookie: httpOnly, secure in prod, sameSite)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Session cookie hardening exists for the browser channel. <br>**Gap:** no TLS/transport enforcement, API-key, or external-system interaction protection exists in-repository (infrastructure-layer concerns are explicitly out of scope per §2, but the spec's "Interaction Security" domain as a platform capability has no corresponding service here beyond cookie flags).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Administrative Security — protection of platform administration functions<br> Ref: §7 Security Domains</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:50-75 (isSelfCrud exception)<br>src/routes/seu/web/routeAuthorityRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Administrative screens (route-authority CRUD, data-migrations) are gated by a literal root-only check as the documented, deliberate exception to the generic gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identity is independent of authority<br> Ref: §8 Identity Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/auth.js:81-95 (buildSessionUser) vs badgeAuthorityEngine badge resolution</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Session identity (<code>id</code>, <code>email</code>, <code>role</code>) is built independently of badge/authority resolution, which happens per-request via a separate query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AI Participants, Connectors, External Systems, Pack Publishers possess a platform identity<br> Ref: §8 Identity Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Human Participants and (nominally) a user <code>role</code>/<code>type</code> of Platform vs Tenant are modelled. No identity record exists for AI Participants, Connectors, External Systems, or Pack Publishers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authentication shall verify identity before platform access is granted<br> Ref: §9 Authentication</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.js:24-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>gatekeeper</code> redirects to login for any non-public path without <code>req.session.user</code>, mounted ahead of the route-authority gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authentication supports interactive Participants, automated services, external integrations, Pack publishers<br> Ref: §9 Authentication</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js:24-168 (Google + Local strategies only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only interactive human login (OAuth/local) is implemented. <br>**Gap:** no automated-service authentication (API key/service token), no external-integration authentication, no Pack-publisher authentication exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authorisation determines permitted platform operations, distinct from engineering authority<br> Ref: §10 Authorisation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:103-141</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>route_authority</code> badges/roles gate platform operations (route access); engineering authority (whether a transition is permitted) is a separate check inside <code>transitionEngine</code>/<code>badgeAuthorityEngine</code>, confirming the spec's separation is implemented, not merely stated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Integrity preserved for engineering state, Events, Packs, Decisions, Evidence, telemetry, traceability records; violations detectable<br> Ref: §11 Integrity</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:69-90 (events persisted before dispatch)<br>src/dblayer/eventsDB.ts:71-82 (only consumption_state is ever updated post-insert)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events are persisted first, dispatched after; the only post-insert mutation touches <code>consumption_state</code>, not the event's substantive payload, which functions as append-mostly integrity for Events specifically. <br>**Gap:** no checksum/signature or tamper-detection mechanism exists for engineering state, Packs, Decisions or Evidence — "violations shall be detectable" has no corresponding detection logic anywhere in the repository (no hash columns, no integrity-check routine found).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confidentiality — protection of confidential engineering information, policies contributed through Packs<br> Ref: §12 Confidentiality</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Searched for confidentiality/classification handling; the only "classification" concept found (<code>installation_classification</code> = Mandatory/Optional on Pack composition, packsDB.ts) is a composition-mandatoriness flag, not an information-confidentiality control. No access-level/confidentiality-tagging mechanism for Deliverables, Knowledge, Evidence, or customer/organisational information exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every security-relevant activity generates an immutable audit record<br> Ref: §13 Auditing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:41-48<br>src/middleware/requestLogger.js:1-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only textual log lines exist (via the application <code>logger</code>), for route-authority denials and generic request timing. <br>**Gap:** authentication (success and failure), privilege changes, Pack publication, administrative actions, and security-policy changes are not captured at all; no persisted, immutable audit table exists (no <code>audit</code> or <code>audit_log</code> table/DB module found in the repository).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security Lifecycle — credentials support Issued → Activated → Rotated → Revoked → Archived; history retained for audit<br> Ref: §14 Security Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js:152-168 (bcrypt hash created on signup)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only "Issued" (account/password creation) exists. <br>**Gap:** no Activated/Rotated/Revoked/Archived states or transitions for any credential (local password or OAuth token) exist; <code>users</code> has no status lifecycle column evidenced in the auth code path, and no historical security-state retention was found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security subsystem publishes AuthenticationSucceeded, AuthenticationFailed, AuthorisationGranted, AuthorisationDenied, CredentialRotated, SecurityViolationDetected, SecurityPolicyApplied<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Searched the event taxonomy (<code>event_registry</code> schema, <code>eventBus.ts</code>, handler registry, and a repository-wide grep for each literal event name) — none of these seven event types exist. The only event-like signal is the plain-text log line on denial.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: zero implicit trust<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:94-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fail-closed default on an unmatched route is the substantive implementation of this NFR.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve engineering integrity<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts (authorisation gate sits before route handlers)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security enforcement runs strictly before any engineering-state mutation handler executes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support horizontal scaling<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:77-82 (express-session, in-memory/store not inspected further)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not independently verifiable from application code alone; scaling depends on the configured session store (e.g. a shared store vs in-memory), which is an infrastructure/deployment concern outside this repository's visible configuration.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain technology-independent<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not verifiable from the codebase; this is an architectural property about future portability, not something a single implementation snapshot can prove or disprove.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support regulatory compliance<br> Ref: §16 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No compliance-specific control (data residency, consent, retention policy enforcement) was found; several Pack seed files model compliance *content* (e.g. <code>compliance-eu-dora-nis2.pack.json</code>) as domain knowledge, but these are not security controls over the platform itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every participating entity possesses a verifiable identity<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/auth.js:56-71</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for Human Participants only; false for AI Participants, Runtime Services, Connectors, External Systems, Pack Publishers (see §8 rows above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: authentication precedes platform access<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.js:24-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed for the one implemented participant type (human session).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: platform authorisation is distinct from engineering authority<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts vs src/domain/engine/badgeAuthorityEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed, same evidence as §10 row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Pack provenance is verifiable<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Explicitly not implemented by design ("no digital signature/provenance verification").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: security events are fully auditable<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:41-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a subset (route denials) is logged as text; not a full audit trail.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: security policies support composition<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts:1-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for engineering-authority rules (Pack-originated); not true for platform-level route authorisation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Identity service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts, src/middleware/auth.js</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists only as an implicit by-product of login (find-or-create participant), not a standalone identity service covering all entity kinds in §8.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authentication service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists for human interactive login (Google OAuth + local/bcrypt).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Platform authorisation service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts, src/domain/identity/routeAuthorityCache.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented as the CR-110 global gate plus cache; this is the most completely realised deliverable in the chapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Credential management service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.js:152-168</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only credential issuance (signup hash) exists; no management (reset, rotation, revocation) surface.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Audit service<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Does not exist as a distinct service; only ad hoc logger calls.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Security policy framework<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/route_authority_schema_recovery.sql, src/dblayer/authorityRulesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A declarative, data-driven policy store exists for both platform-route and engineering-authority policy, consistent with SA-006.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Security APIs<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No API surface was found for managing identity, credentials, or audit records (route_authority's own CRUD is an admin screen, not a general security API).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 40
- Fully met: 13
- Partially met: 15
- Not met: 11
- Not Verifiable: 2

### Major implementation gaps

- No identity, authentication, or service-identity construct exists for AI Participants, Runtime Services, Connectors, External Systems, or Pack Publishers — only Human Participants (via OAuth/local login) are modelled (§8, §9, FR-40.2, FR-40.3).
- Pack provenance/signature verification is explicitly out of scope by a documented design decision (src/routes/seu/core/packs.ts:1-17), contradicting §7 Pack Security and the §17 acceptance criterion "Pack provenance is verifiable."
- No audit service exists. Security-relevant activity is recorded only as transient application-log text (`logger.warn`/`logger.info`), not as an immutable, queryable audit record (§13, FR-40.4, FR-40.5 acceptance criterion).
- None of the seven security domain events in §15 (AuthenticationSucceeded, AuthenticationFailed, AuthorisationGranted, AuthorisationDenied, CredentialRotated, SecurityViolationDetected, SecurityPolicyApplied) exist in the event taxonomy.
- No credential lifecycle (Issued → Activated → Rotated → Revoked → Archived) exists beyond initial issuance; FR-40.6 (rotation without interruption) is unimplemented.
- No confidentiality/classification mechanism exists for Deliverables, Knowledge, Evidence, or customer/organisational information (§12); the only "classification" field found is Pack installation-mandatoriness, an unrelated concept.
- Platform-level security policy (route_authority) is not Pack-composable; only engineering-authority rules (authority_rules) carry an `originating_pack_id`, so FR-40.5 is only partially satisfied.
