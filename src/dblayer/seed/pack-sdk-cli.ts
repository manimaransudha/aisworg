// Post-MVP Phase 9 Pack SDK CLI (Ch.39) — the standalone tooling FR-39.2/39.6
// ask for: validate a Pack JSON file's schema/dependencies before publishing
// it, or publish it through the real Pack SDK pipeline (core/packs.ts),
// instead of hand-editing the packs table.
//
// Usage:
//   pnpm pack:validate <file.json>
//   pnpm pack:publish <file.json> [--activate] [--actor=<role>]
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { validatePackSeed, publishPack, type PackSeedInput } from "../../routes/seu/core/packs.js";

function loadSeed(filePath: string): PackSeedInput {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as PackSeedInput;
}

function parseFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function run(): Promise<void> {
  const [command, filePath, ...rest] = process.argv.slice(2);

  if (!command || !filePath || !["validate", "publish"].includes(command)) {
    logger.error("[pack-sdk] usage: pack-sdk-cli.ts <validate|publish> <file.json> [--activate] [--actor=<role>]");
    process.exitCode = 1;
    return;
  }

  const seed = loadSeed(filePath);

  if (command === "validate") {
    const result = await validatePackSeed(seed);
    if (!result.ok) {
      logger.error(`[pack-sdk] validation FAILED for ${seed.code}@${seed.packVersion}:`);
      for (const e of result.errors) logger.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }
    logger.info(`[pack-sdk] validation OK: ${seed.code}@${seed.packVersion}`);
    return;
  }

  const actorRole = parseFlag(rest, "actor") ?? "super";
  const activate = rest.includes("--activate");

  const result = await publishPack({ seed, actorRole, actorId: "1", activate });
  if (!result.ok) {
    logger.error(`[pack-sdk] publish FAILED for ${seed.code}@${seed.packVersion}:`);
    for (const e of result.errors ?? []) logger.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  const verb = result.alreadyPublished ? "already published (no-op)" : "published";
  logger.info(`[pack-sdk] ${verb}: ${result.pack!.code}@${result.pack!.pack_version} -> ${result.pack!.status}`);
  if (result.supersededPack) {
    logger.info(`[pack-sdk] superseded previous Active version: ${result.supersededPack.code}@${result.supersededPack.pack_version} -> ${result.supersededPack.status}`);
  }
}

run()
  .catch((err) => {
    logger.error("[pack-sdk] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
