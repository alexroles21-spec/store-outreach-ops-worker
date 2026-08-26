import { runDiscoveryCycle } from "../server/outreach";

const intervalMinutes = Math.max(1, Number(process.env.WORKER_INTERVAL_MINUTES ?? 60));
const targetPerRun = Math.min(84, Math.max(1, Number(process.env.WORKER_TARGET_PER_RUN ?? 84)));
const intervalMs = intervalMinutes * 60 * 1000;
let running = false;

function hourlyKey() {
  return `worker:${Math.floor(Date.now() / 3600000)}`;
}

async function runOnce() {
  if (running) {
    console.warn("[Worker] Previous cycle is still running; skipping overlap.");
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    const result = await runDiscoveryCycle(targetPerRun, hourlyKey());
    console.log(JSON.stringify({ event: "cycle_complete", durationMs: Date.now() - startedAt, ...result }));
  } catch (error) {
    console.error(JSON.stringify({ event: "cycle_failed", durationMs: Date.now() - startedAt, error: String(error) }));
  } finally {
    running = false;
  }
}

console.log(JSON.stringify({ event: "worker_started", intervalMinutes, targetPerRun }));
void runOnce();
setInterval(() => void runOnce(), intervalMs);
