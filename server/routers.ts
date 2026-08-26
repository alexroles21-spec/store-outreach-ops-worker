import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addLeadEvent,
  getAutomationSettings,
  getDashboardStats,
  getLeadEvents,
  updateLeadReview,
  getRecentRuns,
  searchLeads,
  updateLeadStatus,
  upsertAutomationSettings,
} from "./db";
import { personalizeMessage, runDiscoveryCycle } from "./outreach";
import { markLeadSentManually } from "./manualSend";

const leadStatus = z.enum(["not_contacted", "queued", "review", "sent", "failed", "do_not_contact"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    stats: adminProcedure.query(() => getDashboardStats()),
    runs: adminProcedure.query(() => getRecentRuns(18)),
  }),
  leads: router({
    search: adminProcedure
      .input(z.object({ query: z.string().max(120).default(""), status: z.union([leadStatus, z.literal("all")]).default("all") }))
      .query(({ input }) => searchLeads(input.query, input.status)),
    setStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: leadStatus, reason: z.string().max(255).optional() }))
      .mutation(async ({ input }) => {
        await updateLeadStatus(input.id, input.status, input.status === "do_not_contact", input.reason);
        await addLeadEvent({ leadId: input.id, eventType: input.status === "do_not_contact" ? "suppression" : "status", outcome: input.status, detail: input.reason ?? "Status updated from dashboard" });
        return { success: true } as const;
      }),
    events: adminProcedure.input(z.object({ leadId: z.number().int().positive() })).query(({ input }) => getLeadEvents(input.leadId)),
    review: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["reviewed", "approved_manual", "dismissed"]), note: z.string().max(500).optional() }))
      .mutation(async ({ input }) => {
        await updateLeadReview(input.id, input.status, input.note);
        return { success: true } as const;
      }),
    markSent: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => markLeadSentManually(input.id)),
  }),
  message: router({
    preview: adminProcedure
      .input(z.object({ storeName: z.string().min(1).max(255), niche: z.string().min(1).max(128), storeUrl: z.string().url() }))
      .query(({ input }) => personalizeMessage(input.storeName, input.niche, input.storeUrl)),
  }),
  automation: router({
    settings: adminProcedure.query(({ ctx }) => getAutomationSettings(ctx.user.id)),
    runNow: adminProcedure.mutation(async ({ ctx }) => {
      const settings = await getAutomationSettings(ctx.user.id);
      return runDiscoveryCycle(settings?.targetPerRun ?? 84);
    }),
    enableHourly: adminProcedure.mutation(async ({ ctx }) => {
      const current = await getAutomationSettings(ctx.user.id);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (current?.scheduleCronTaskUid) {
        await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: true, cron: "0 0 * * * *", path: "/api/scheduled/discoverLeads" }, sessionToken);
        return upsertAutomationSettings(ctx.user.id, { enabled: true, intervalMinutes: 60, targetPerRun: current.targetPerRun });
      }
      const job = await createHeartbeatJob({
        name: `lead-discovery-${ctx.user.id}`,
        cron: "0 0 * * * *",
        path: "/api/scheduled/discoverLeads",
        description: "Hourly public e-commerce lead discovery and qualification",
      }, sessionToken);
      return upsertAutomationSettings(ctx.user.id, { enabled: true, intervalMinutes: 60, targetPerRun: current?.targetPerRun ?? 84, scheduleCronTaskUid: job.taskUid });
    }),
    disableHourly: adminProcedure.mutation(async ({ ctx }) => {
      const current = await getAutomationSettings(ctx.user.id);
      if (!current?.scheduleCronTaskUid) return upsertAutomationSettings(ctx.user.id, { enabled: false });
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: false }, sessionToken);
      return upsertAutomationSettings(ctx.user.id, { enabled: false });
    }),
    saveSettings: adminProcedure
      .input(z.object({ targetPerRun: z.number().int().min(1).max(84), enabled: z.boolean() }))
      .mutation(({ ctx, input }) => upsertAutomationSettings(ctx.user.id, { targetPerRun: input.targetPerRun, enabled: input.enabled })),
  }),
});

export type AppRouter = typeof appRouter;
