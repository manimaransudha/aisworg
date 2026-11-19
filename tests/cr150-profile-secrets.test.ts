// CR-150: the AI provider key of a Profile is write-only on screen. Content shown to a user carries a masked key,
// and a save that returns the mask unchanged keeps the stored key. No database is used.
import { test } from "node:test";
import assert from "node:assert/strict";

import { maskApiKey, redactProfileSecrets, restoreProfileSecrets } from "../src/routes/seu/core/profileSecrets.js";

const STORED = { name: "Profile", aiProviderCredentials: [{ provider: "anthropic", apiKey: "sk-ant-api03-abcdefghijklmnop-WXYZ" }, { provider: "google", apiKey: "short" }] };

test("a key is masked to its first characters and last four, and a short key is masked whole", () => {
  assert.equal(maskApiKey("sk-ant-api03-abcdefghijklmnop-WXYZ"), "sk-ant-…WXYZ");
  assert.equal(maskApiKey("short"), "••••••••");
});

test("content shown to a user holds no key", () => {
  const shown = redactProfileSecrets(STORED);
  assert.ok(!JSON.stringify(shown).includes("abcdefghijklmnop"), "the key is not in the shown content");
  assert.equal((shown.aiProviderCredentials as Array<{ apiKey: string }>)[0]!.apiKey, "sk-ant-…WXYZ");
  assert.equal(shown.name, "Profile");
});

test("a masked key returned by a save is the stored key, and a typed key replaces it", () => {
  const shown = redactProfileSecrets(STORED);
  const unchanged = restoreProfileSecrets(shown, STORED);
  assert.deepEqual(unchanged.aiProviderCredentials, STORED.aiProviderCredentials);

  const replaced = restoreProfileSecrets({ ...shown, aiProviderCredentials: [{ provider: "anthropic", apiKey: "sk-ant-new-key-0123456789" }, { provider: "google", apiKey: "••••••••" }] }, STORED);
  assert.deepEqual(replaced.aiProviderCredentials, [{ provider: "anthropic", apiKey: "sk-ant-new-key-0123456789" }, { provider: "google", apiKey: "short" }]);
});

test("a provider that was not stored keeps what was typed, and content with no credentials is untouched", () => {
  const added = restoreProfileSecrets({ aiProviderCredentials: [{ provider: "openai", apiKey: "sk-openai-typed-key" }] }, STORED);
  assert.deepEqual(added.aiProviderCredentials, [{ provider: "openai", apiKey: "sk-openai-typed-key" }]);
  const plain = { name: "Profile" };
  assert.equal(redactProfileSecrets(plain), plain);
  assert.equal(restoreProfileSecrets(plain, STORED), plain);
});

test("the other fields of a row, such as the endpoint, are kept through redaction and restore", () => {
  const stored = { aiProviderCredentials: [{ provider: "anthropic", endpoint: "Anthropic", apiKey: "sk-ant-api03-abcdefghijklmnop-WXYZ" }] };
  const shown = redactProfileSecrets(stored);
  assert.deepEqual(shown.aiProviderCredentials, [{ provider: "anthropic", endpoint: "Anthropic", apiKey: "sk-ant-…WXYZ" }]);
  assert.deepEqual(restoreProfileSecrets(shown, stored).aiProviderCredentials, stored.aiProviderCredentials);
});
