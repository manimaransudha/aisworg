import { createRequire } from "node:module";
import { logger } from "../../../utils/logger.js";
import { DEMO_RESET_CRON, DEMO_RESET_TIMEZONE } from "../../constants.js";
import { seedDemo } from "./demoSeed.js";

const require = createRequire(import.meta.url);
const cron = require("node-cron") as { schedule: (expression: string, task: () => void | Promise<void>, options?: { timezone?: string }) => unknown };

let running = false;

// Reseeds the Demo tenant on the schedule in constants.ts. A run still in progress when the next one is due is not started twice.
export function scheduleDemoReset(): void {
  cron.schedule(DEMO_RESET_CRON, async () => {
    if (running) {
      logger.warn("[demo:schedule] previous reset still running; this run is skipped.");
      return;
    }
    running = true;
    logger.info("[demo:schedule] scheduled Demo reset starting.");
    try {
      await seedDemo();
    } catch (err) {
      logger.error("[demo:schedule] scheduled Demo reset failed", err as Error);
    } finally {
      running = false;
    }
  }, { timezone: DEMO_RESET_TIMEZONE });
  logger.info(`[demo:schedule] Demo reset scheduled: "${DEMO_RESET_CRON}" in ${DEMO_RESET_TIMEZONE}.`);
}
