import type { Express, Request, Response } from "express";
import { getAutomationByTaskUid, upsertAutomationSettings } from "./db";
import { runDiscoveryCycle } from "./outreach";
import { sdk } from "./_core/sdk";

export function buildHourlyIdempotencyKey(taskUid: string, date = new Date()) {
  return `${taskUid}:${Math.floor(date.getTime() / 3600000)}`;
}

function errorPayload(error: unknown, req: Request, taskUid?: string) {
  return {
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { url: req.originalUrl, taskUid },
    timestamp: new Date().toISOString(),
  };
}

export function registerScheduledRoutes(app: Express) {
  app.post("/api/scheduled/discoverLeads", async (req: Request, res: Response) => {
    let taskUid: string | undefined;
    try {
      const user = await sdk.authenticateRequest(req);
      taskUid = user.taskUid;
      if (!user.isCron || !taskUid) return res.status(403).json({ error: "cron-only" });

      const settings = await getAutomationByTaskUid(taskUid);
      if (!settings) return res.status(200).json({ ok: true, skipped: "orphan" });
      if (!settings.enabled) return res.status(200).json({ ok: true, skipped: "disabled" });

      const now = new Date();
      await upsertAutomationSettings(settings.ownerId, { lastRunAt: now });
      const result = await runDiscoveryCycle(Math.min(settings.targetPerRun, 84), buildHourlyIdempotencyKey(taskUid, now));
      return res.status(200).json({ ok: true, result, taskUid });
    } catch (error) {
      console.error("[Scheduled] discoverLeads failed", errorPayload(error, req, taskUid));
      return res.status(500).json(errorPayload(error, req, taskUid));
    }
  });
}
