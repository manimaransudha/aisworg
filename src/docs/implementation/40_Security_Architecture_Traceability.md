# Implementation Traceability: Chapter 40 – Security Architecture

**Date of report: 23-10-2026**

## Traceability Table

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security protects every platform interaction and applies across Runtime Services, Packs, Participants, Engineering Objects and External Interactions.<br>Ref: §1 Purpose, §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:218-227<br>src/middleware/gatekeeper.ts:24-42<br>src/middleware/routeAuthorityGate.ts:29-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: every HTTP request passes gatekeeper (session required) and routeAuthorityGate (route_authority row required) before any route runs. This covers human web and API interaction.<br>Gap: no layer protects Runtime Service to Runtime Service calls, which are in-process. Outbound External Interaction has only a static bearer reference. Pack publisher identity is a free text field. See the rows below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security does not alter engineering behaviour. Governance decides whether a transition is permitted. Security decides whether the requester may participate.<br>Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:29-88<br>src/domain/identity/heldBadges.ts:12-17<br>src/domain/engine/badgeAuthorityEngine.ts:16-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The gate runs before routes and only allows or denies the request by held badge or role. It writes no engineering state. Transition legality stays in transition_definitions, so the two layers are separate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security is enforced before engineering execution.<br>Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:218-227</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">gatekeeper and routeAuthorityGate are registered with app.use before the web and API routers (seuApiRouter is mounted at line 227). Denial returns before any handler runs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-001: Trust is explicit and no entity is trusted implicitly.<br>Ref: §5 SA-001, §16 zero implicit trust</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:40-47<br>src/middleware/routeAuthorityGate.ts:38,65-66,71<br>src/middleware/routeAuthorityGate.ts:50-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a request with no matching route_authority row is denied. A session is required for any non-public route that has a badge or role.<br>Gap: a root badge bypasses the gate outside production (lines 38, 65, 71). A row with empty badges and roles admits any request that reaches it without a session check (lines 50-53). The public prefix list in gatekeeper.ts:4-16 is a code constant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-002 and FR-40.1: Every Participant has a unique, verifiable identity before participating.<br>Ref: §5 SA-002, §6 FR-40.1, §8, §17 criterion 1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/users_schema_recovery.sql:3-22<br>src/dblayer/recovery/participants_master_schema_recovery.sql:12<br>src/middleware/auth.ts:41-59<br>src/domain/auth/passportConfig.ts:88-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: users.email is UNIQUE. Every signed-in user resolves to a participants_master row (created at first sign-in) and that row id is the session actor id. Sign-in verifies the identity by password hash or Google OAuth.<br>Gap: only Human Participants sign in. users.id is nullable on participants_master (user_id has no NOT NULL), so AI and External Participants carry no authenticated credential. The Demo tenant maps many sign-ins to one shared Demo User participant (auth.ts:44-45), so those identities are not unique per person.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.2: Every Runtime Service has a verifiable service identity.<br>Ref: §6 FR-40.2, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/constants.ts:125-160<br>src/domain/auth/passportConfig.ts:117-119<br>src/domain/engine/badgeAuthorityEngine.ts:34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: one platform system actor row exists and is recorded as actor on system initiated events. It is the only service identity.<br>Gap: Runtime Services are in-process modules with no individual identity or verification. All services share the single system actor.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Connectors, External Systems and Pack Publishers each hold a platform identity.<br>Ref: §8 Identity Model</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Connector, External System or Pack Publisher identity entity exists. users and participants_master are the only identity tables. packs.publisher is a free text attribute (src/routes/seu/core/packs.ts:105) and is not linked to any identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identity is independent of authority.<br>Ref: §8, §10, §17 criterion 3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:12,17,20<br>src/domain/engine/badgeAuthorityEngine.ts:16-23<br>src/domain/identity/heldRoles.ts:14-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The identity row (users, participants_master) is separate from authorised_role and authorised_badges JSONB grants, each with effective_till. Authority is read from the grants per request, never from the user type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.3: Every External Interaction is authenticated.<br>Ref: §6 FR-40.3, §7 Interaction Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/externalOrchestratorAdapter.ts:11-19<br>src/dblayer/executionTargetsDB.ts:13,27<br>src/routes/seu/api/executionTargets.ts:33-52<br>src/app.ts:124</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: outbound delivery to an external orchestrator sends Authorization: Bearer when adapterAuthRef is set. Inbound API calls require a session and a route_authority row.<br>Gap: the bearer header is optional, so an unauthenticated outbound call is allowed. adapterAuthRef is stored as plain text in execution_targets and used as the token itself. No inbound machine credential exists, so an external system cannot authenticate except as a browser session. API paths skip CSRF (app.ts:124), which relies on session cookie alone.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-003: Least privilege. Each entity holds only the permissions its responsibilities need.<br>Ref: §5 SA-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:16-23<br>src/domain/identity/heldRoles.ts:17-24<br>src/middleware/routeAuthorityGate.ts:68-84</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Badges and roles are granted per Participant, filter out expired grants, and roles can be limited to named SEUs (seu_ids). The gate requires the specific badges and roles of each route, with all or any match mode. New participants hold no badges by default (passportConfig.ts:111).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-004: Security is layered. No single mechanism is relied on alone.<br>Ref: §5 SA-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.ts:24-42<br>src/middleware/routeAuthorityGate.ts:29-88<br>src/app.ts:65-70,109-126<br>src/middleware/requireTenantScope.ts:32-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: layers are session cookie (httpOnly, secure in production), CSRF double submit, session gate, route authority gate, tenant scope guard and login rate limit (routes/web/auth.ts:23-30).<br>Gap: there is no layer for service to service calls or for payload integrity. The API surface drops the CSRF layer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-005 and FR-40.4: Every security decision is auditable and traceable.<br>Ref: §5 SA-005, §6 FR-40.4, §17 criterion 5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:15-22<br>src/middleware/requireBadge.ts:37<br>src/middleware/requireTenantScope.ts:43-52<br>src/middleware/requestLogger.ts:4-13<br>src/domain/auth/passportConfig.ts:143-166</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: denials are written with logger.warn including user, method, path and missing badge. Successful transitions record actor and authority badge on the event row.<br>Gap: security decisions go only to the application log. No audit table row is written for authentication success, authentication failure or authorisation grant or denial. The log is not immutable or queryable by the platform.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SA-006 and FR-40.5: Security policies are declarative and compose through Packs.<br>Ref: §5 SA-006, §6 FR-40.5, §17 criterion 6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/routeAuthority.json<br>src/domain/identity/routeAuthorityCache.ts:35-69<br>src/routes/seu/core/policyDefinitions.ts<br>src/dblayer/seed/data/compliance-gdpr.pack.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: route authority is declarative data in route_authority, loaded into a cache and matched by method and path. Policies and compliance Packs are declarative and compose through the Composition Engine.<br>Gap: the route_authority table is platform wide and is not contributed by a Pack, so the access rules do not compose through Packs. No Pack contribution kind is security specific.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authentication verifies identity before platform access for interactive Participants.<br>Ref: §9, §17 criterion 2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.ts:30-39<br>src/domain/auth/passportConfig.ts:137-181<br>src/domain/auth/passportConfig.ts:34-131<br>src/routes/web/auth.ts:50-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: non-public paths redirect to login without a session. Local login checks bcrypt (cost 12) and is_active. Google OAuth is supported. Sessions are created only after success.<br>Gap: in non-production a local user without a hash is activated with whatever password is entered (passportConfig.ts:148-159). An account that Google creates on first sign-in is granted participation in the Demo tenant without approval (lines 58-83).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authentication supports automated services and Pack publishers.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only interactive sign-in (local and Google) exists. No API key, service token or publisher credential flow exists in the repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authorisation follows authentication and is distinct from engineering authority.<br>Ref: §10, §17 criterion 3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/gatekeeper.ts:24-42<br>src/middleware/routeAuthorityGate.ts:29-88<br>src/middleware/requireBadge.ts:8-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The gate runs after the session check and decides route access from route_authority. Transition authority is a separate check by badge in the transition path. The ordering follows the §3 sequence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform access is tenant scoped.<br>Ref: §3 and §7 Participant and Data Security, §16 zero implicit trust</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireTenant.ts:3-9<br>src/middleware/requireTenantScope.ts:25-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every request resolves a tenant scope and row lookups deny with not found when the row tenant differs from the viewer tenant. Only a root badge crosses tenants.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Integrity violations are detectable for engineering state, Events, Packs, Decisions, Evidence, telemetry and traceability records.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/events_schema_recovery.sql:3-20<br>src/dblayer/eventsDB.ts:15-52<br>src/routes/seu/core/traceability.ts:20-47,103-126</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: events are append only through the DB layer API (only consumption_state is updated), carry actor, badge, correlation and sequence. Traceability builds an ordered provenance list.<br>Gap: no hash, checksum, signature or database trigger prevents or detects modification of Events, Packs, Decisions, Evidence or telemetry. A direct SQL update is silent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack publisher identity, signatures and provenance are verified.<br>Ref: §7 Pack Security, §17 criterion 4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:105,115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">publisher is an unvalidated string attribute of a Pack. No signature, digest or publisher identity check exists in any publish or import path. Pack provenance is not verifiable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confidentiality of Deliverables, Knowledge, Evidence and customer and organisational information is supported and may be contributed by Packs.<br>Ref: §12, §7 Data Security</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireTenantScope.ts:25-80<br>src/dblayer/seed/data/compliance-gdpr.pack.json<br>src/dblayer/seed/data/compliance-data-residency-localization.pack.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: tenant isolation protects every tenant scoped object from other tenants. Compliance Packs carry declarative confidentiality related content.<br>Gap: no per object confidentiality classification or access policy is evaluated at read time, and no encryption of stored content is performed by the platform.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every security relevant activity generates an immutable audit record (authentication, failed authentication, privilege changes, Pack publication, administrative actions, policy changes).<br>Ref: §13, §17 criterion 5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/web/auth.ts:62,79,87,209<br>src/dblayer/eventsDB.ts:26-52<br>src/dblayer/seed/data/transitionDefinitions.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Pack publication, policy changes and other lifecycle transitions publish Events with actor and badge, which form a durable record. Grants of badges are stored with effective_till on participants_master.<br>Gap: authentication, failed authentication, logout, password reset, user creation and enabling or disabling users (auth.ts:235-290) write only logger.info lines. Privilege changes overwrite the JSONB grant with no history. No audit record is guaranteed immutable by the database.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security credentials follow the lifecycle Issued, Activated, Rotated, Revoked, Archived, with history kept for audit.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/web/auth.ts:158-160,185-210,235-290<br>src/dblayer/userDB.ts:198-205<br>src/dblayer/recovery/users_schema_recovery.sql:12-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Issued (verification token with expiry), Activated (activateWithPassword on verify), Rotated (password reset by token), Revoked (is_active toggle) exist for user passwords.<br>Gap: Archived is absent and no credential history is kept. The old hash is overwritten on reset. Service, connector and publisher credentials have no lifecycle. Active sessions are not invalidated when a password is reset or a user is disabled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.6: Credentials rotate without service interruption.<br>Ref: §6 FR-40.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/web/auth.ts:185-210</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A password reset replaces the single hash in place. There is no overlap window with two valid credentials. SESSION_SECRET and the CSRF secret are one environment value with no rotation support (src/app.ts:66,110).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-40.7: The platform detects unauthorised access attempts.<br>Ref: §6 FR-40.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/web/auth.ts:23-30<br>src/middleware/routeAuthorityGate.ts:15-22<br>src/middleware/requireTenantScope.ts:48-52</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: failed logins are throttled (3 failures per 4 hours per client) and denied access, tenant mismatches and missing authority are rejected and logged as warnings.<br>Gap: attempts are not recorded as a security event, counted, correlated or surfaced for review. No SecurityViolationDetected condition is evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Security subsystem publishes AuthenticationSucceeded, AuthenticationFailed, AuthorisationGranted, AuthorisationDenied, CredentialRotated, SecurityViolationDetected and SecurityPolicyApplied.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None of the seven event types exists in the event registry, the seed data or any publish call. A search of src for these names returns no code match.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security supports horizontal scaling and technology independence.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:65-70<br>src/domain/identity/routeAuthorityCache.ts:35-46</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Session state uses the express-session default store (no store configured), so sessions are held per process and do not scale across instances. The route authority cache is loaded once per process with no cross instance refresh. Authentication is behind passport strategies, which keeps the provider replaceable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Security supports regulatory compliance and preserves engineering integrity.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/compliance-iso-27001.pack.json<br>src/dblayer/seed/data/compliance-soc2.pack.json<br>src/dblayer/eventsDB.ts:26-52</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: compliance Packs and an event record with actor and badge give a base for evidence. Gap: the audit and integrity gaps above limit compliance use, and no control maps compliance Pack requirements to security mechanisms.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Identity service, Authentication service, Platform authorisation service, Credential management service, Audit service, Security policy framework and Security APIs.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/auth/passportConfig.ts<br>src/domain/identity/heldBadges.ts<br>src/middleware/routeAuthorityGate.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: authentication (passportConfig.ts), identity resolution (auth.ts, heldBadges.ts) and platform authorisation (routeAuthorityGate.ts) exist as modules and middleware, and route_authority is the declarative policy store.<br>Gap: no Credential management service, no Audit service and no Security API exist. The three present parts are not exposed as services with an interface.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 28
- Fully met: 6
- Partially met: 17
- Not met: 5
- Not verifiable: 0
- Major implementation gaps: no security audit record or the seven Security events; no Pack signature or provenance verification; no Connector, External System or Pack Publisher identity; no credential rotation or Archived stage; no automated service authentication; non-production root and password auto-activation bypasses.
