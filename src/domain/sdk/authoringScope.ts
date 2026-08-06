// SDK UI Layer Plan — the shared badge-scope anchor (014_sdk_authoring.sql's
// header comment). A tiny, dependency-free module so both
// routes/seu/core/sdkAuthoring.ts and routes/seu/core/deliverables.ts
// (resolveAutoActingBadge) can reference the same constant without a
// circular import between them.
export const AUTHORING_SCOPE_PACK_CODE = "sdk-authoring-scope";
