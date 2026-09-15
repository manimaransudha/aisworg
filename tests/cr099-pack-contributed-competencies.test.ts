// CR-099 — Pack-contributed Competencies (`contributionCompetencies[]`,
// PackContributions.competencies in seuTypes.ts), validated by
// validatePackSeed (core/packs.ts): `dimension` must be a real category:pack
// code, `value` must be a real concept under `dimension`'s own lower-cased
// child concept type, and a Technology/Domain-category Pack must declare at
// least one entry. Real DB throughout, no mocking, real already-seeded
// Ontology values (category:pack — migration 049; technology/domain child
// concept types — migrations 195/196/200) — same discipline
// tests/pack-sdk.test.ts's own freshPackSeed pattern already establishes.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { validatePackSeed, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { uniqueTestPackVersion } from "./testFixtures.js";

function freshPackSeed(overrides: Partial<PackSeedInput> = {}): PackSeedInput {
  return {
    code: `test-cr099-pack-${randomUUID()}`,
    name: "CR-099 fixture Pack",
    category: "Engineering",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {},
    ...overrides,
  } as PackSeedInput;
}

test("validatePackSeed: a Technology-category Pack with no contributionCompetencies is rejected", async () => {
  const seed = freshPackSeed({ category: "Technology", contributions: {} });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("must declare at least one Competency")), `expected a mandatory-Competency error, got: ${JSON.stringify(result.errors)}`);
});

test("validatePackSeed: a Domain-category Pack with no contributionCompetencies is rejected", async () => {
  const seed = freshPackSeed({ category: "Domain", contributions: {} });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("must declare at least one Competency")));
});

test("validatePackSeed: an Engineering-category Pack with no contributionCompetencies is NOT required to declare one", async () => {
  const seed = freshPackSeed({ category: "Engineering", contributions: {} });
  const result = await validatePackSeed(seed);
  if (!result.ok) {
    assert.ok(!result.errors.some((e) => e.includes("must declare at least one Competency")), `Competency should only be mandatory for Technology/Domain, got: ${JSON.stringify(result.errors)}`);
  }
});

test("validatePackSeed: a Technology Pack declaring {dimension: \"Technology\", value: \"nodejs\"} passes the Competency checks", async () => {
  const seed = freshPackSeed({ category: "Technology", contributions: { competencies: [{ dimension: "Technology", value: "nodejs" }] } });
  const result = await validatePackSeed(seed);
  if (!result.ok) {
    assert.ok(!result.errors.some((e) => e.toLowerCase().includes("competenc")), `expected no Competency-related error, got: ${JSON.stringify(result.errors)}`);
  }
});

test("validatePackSeed: a Domain Pack declaring a real {Domain, value} pair passes the Competency checks", async () => {
  const seed = freshPackSeed({ category: "Domain", contributions: { competencies: [{ dimension: "Domain", value: "customer-service" }] } });
  const result = await validatePackSeed(seed);
  if (!result.ok) {
    assert.ok(!result.errors.some((e) => e.toLowerCase().includes("competenc")), `expected no Competency-related error, got: ${JSON.stringify(result.errors)}`);
  }
});

test("validatePackSeed: an unknown competency dimension (not a real category:pack code) is rejected", async () => {
  const seed = freshPackSeed({ category: "Technology", contributions: { competencies: [{ dimension: "NotARealCategory", value: "nodejs" }] } });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.toLowerCase().includes("notarealcategory")), `expected the invalid dimension to be reported, got: ${JSON.stringify(result.errors)}`);
});

test("validatePackSeed: an unknown competency value under a valid dimension is rejected", async () => {
  const seed = freshPackSeed({ category: "Technology", contributions: { competencies: [{ dimension: "Technology", value: `not-a-real-technology-${randomUUID()}` }] } });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.length > 0);
});

test("validatePackSeed: dimension is case-sensitive — a lower-cased \"domain\" (not the real category:pack code \"Domain\") is rejected", async () => {
  const seed = freshPackSeed({ category: "Domain", contributions: { competencies: [{ dimension: "domain", value: "customer-service" }] } });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false, "category:pack codes are capitalised (\"Domain\"); a lower-cased dimension must not silently pass");
});

test("validatePackSeed: multiple competency entries are each validated independently — one bad entry does not swallow a valid sibling's own error reporting", async () => {
  const seed = freshPackSeed({
    category: "Technology",
    contributions: {
      competencies: [
        { dimension: "Technology", value: "nodejs" },
        { dimension: "Technology", value: `not-a-real-technology-${randomUUID()}` },
      ],
    },
  });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
});
