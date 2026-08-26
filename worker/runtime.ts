import { runDiscoveryCycle } from "../server/outreach";

export type WorkerConfig = {
  intervalMinutes: number;
  targetPerRun: number;
  dryRun: boolean;
};

export function createWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    intervalMinutes: Math.max(1, Number(env.WORKER_INTERVAL_MINUTES ?? 60)),
    targetPerRun: Math.min(84, Math.max(1, Number(env.WORKER_TARGET_PER_RUN ?? 84))),
    dryRun: env.WORKER_DRY_RUN === "true",
  };
}

export function createWorkerRunner(config: WorkerConfig, cycle = runDiscoveryCycle) {
  let running = false;
  const runOnce = async () => {
    if (running) return { skipped: "overlap" as const };
    if (config.dryRun) return { skipped: "dry_run" as const };
    running = true;
    try {
      return await cycle(config.targetPerRun, `worker:${Math.floor(Date.now() / 3600000)}`);
    } finally {
      running = false;
    }
  };
  return { runOnce };
}
