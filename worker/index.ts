import { createWorkerConfig, createWorkerRunner } from "./runtime";

const config = createWorkerConfig();
const runner = createWorkerRunner(config);

async function runOnce() {
  const startedAt = Date.now();
  try {
    const result = await runner.runOnce();
    console.log(JSON.stringify({ event: "cycle_complete", durationMs: Date.now() - startedAt, ...result }));
  } catch (error) {
    console.error(JSON.stringify({ event: "cycle_failed", durationMs: Date.now() - startedAt, error: String(error) }));
    process.exitCode = 1;
  }
}

async function main() {
  console.log(JSON.stringify({ event: "worker_started", ...config }));
  if (config.once) {
    await runOnce();
    return;
  }

  void runOnce();
  setInterval(() => void runOnce(), config.intervalMinutes * 60 * 1000);
}

void main().catch(error => {
  console.error(JSON.stringify({ event: "worker_boot_failed", error: String(error) }));
  process.exitCode = 1;
});
