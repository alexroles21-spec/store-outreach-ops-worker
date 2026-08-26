import { describe, expect, it, vi } from "vitest";
import { createWorkerConfig, createWorkerRunner } from "./runtime";

describe("worker runtime", () => {
  it("clamps the target to 84 and supports safe dry-run configuration", () => {
    expect(createWorkerConfig({ WORKER_INTERVAL_MINUTES: "60", WORKER_TARGET_PER_RUN: "120", WORKER_DRY_RUN: "true", WORKER_ONCE: "true" })).toEqual({ intervalMinutes: 60, targetPerRun: 84, dryRun: true, once: true, storage: "database" });
  });

  it("does not call the discovery cycle in dry-run mode", async () => {
    const cycle = vi.fn();
    const runner = createWorkerRunner({ intervalMinutes: 60, targetPerRun: 84, dryRun: true, once: true }, cycle);
    await expect(runner.runOnce()).resolves.toEqual({ skipped: "dry_run" });
    expect(cycle).not.toHaveBeenCalled();
  });

  it("prevents overlapping cycles", async () => {
    let release!: () => void;
    const cycle = vi.fn(() => new Promise(resolve => { release = () => resolve({ runId: 1 }); }));
    const runner = createWorkerRunner({ intervalMinutes: 60, targetPerRun: 84, dryRun: false, once: true }, cycle);
    const first = runner.runOnce();
    await expect(runner.runOnce()).resolves.toEqual({ skipped: "overlap" });
    release();
    await expect(first).resolves.toEqual({ runId: 1 });
  });
});
