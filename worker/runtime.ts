import { runDiscoveryCycle } from "../server/outreach";
import { runRepositoryCycle } from "./repository";

export type WorkerConfig = {
  intervalMinutes: number;
  targetPerRun: number;
  dryRun: boolean;
  once: boolean;
  storage: "database" | "repository";
};

export function createWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    intervalMinutes: Math.max(1, Number(env.WORKER_INTERVAL_MINUTES ?? 60)),
    targetPerRun: Math.min(84, Math.max(1, Number(env.WORKER_TARGET_PER_RUN ?? 84))),
    dryRun: env.WORKER_DRY_RUN === "true",
    once: env.WORKER_ONCE === "true",
    storage: env.WORKER_STORAGE === "repository" ? "repository" : "database",
  };
}

export function createWorkerRunner(config: WorkerConfig, cycle = runDiscoveryCycle, repositoryCycle = runRepositoryCycle) {
  let running = false;
  const runOnce = async () => {
    if (running) return { skipped: "overlap" as const };
    if (config.dryRun) return { skipped: "dry_run" as const };
    running = true;
    try {
      if (config.storage === "repository") return await repositoryCycle(config.targetPerRun);
      return await cycle(config.targetPerRun, `worker:${Math.floor(Date.now() / 3600000)}`);
    } finally {
      running = false;
    }
  };
  return { runOnce };
}
