import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing Manus auth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const automationSettings = mysqlTable("automation_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().unique(),
  targetPerRun: int("targetPerRun").default(84).notNull(),
  intervalMinutes: int("intervalMinutes").default(60).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }).unique(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationSettings = typeof automationSettings.$inferSelect;
export type InsertAutomationSettings = typeof automationSettings.$inferInsert;

export const outreachRuns = mysqlTable("outreach_runs", {
  id: int("id").autoincrement().primaryKey(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).unique(),
  targetCount: int("targetCount").default(84).notNull(),
  discoveredCount: int("discoveredCount").default(0).notNull(),
  qualifiedCount: int("qualifiedCount").default(0).notNull(),
  verificationFailures: int("verificationFailures").default(0).notNull(),
  protectedForms: int("protectedForms").default(0).notNull(),
  queuedOutreach: int("queuedOutreach").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OutreachRun = typeof outreachRuns.$inferSelect;
export type InsertOutreachRun = typeof outreachRuns.$inferInsert;

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  normalizedHost: varchar("normalizedHost", { length: 255 }).notNull().unique(),
  storeName: varchar("storeName", { length: 255 }).notNull(),
  niche: varchar("niche", { length: 128 }).notNull(),
  storeUrl: varchar("storeUrl", { length: 1000 }).notNull(),
  region: varchar("region", { length: 32 }).notNull(),
  regionConfidence: varchar("regionConfidence", { length: 32 }).notNull(),
  publicContactRoute: varchar("publicContactRoute", { length: 1000 }),
  contactRouteType: mysqlEnum("contactRouteType", ["email", "contact_form", "none", "unknown"]).default("unknown").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactFormProtected: boolean("contactFormProtected").default(false).notNull(),
  protectionReason: varchar("protectionReason", { length: 255 }),
  verificationStatus: mysqlEnum("verificationStatus", ["qualified", "inactive", "failed", "duplicate", "pending"]).default("pending").notNull(),
  verificationEvidence: text("verificationEvidence").notNull(),
  responseTimeMs: int("responseTimeMs"),
  reviewStatus: mysqlEnum("reviewStatus", ["unreviewed", "reviewed", "approved_manual", "dismissed"]).default("unreviewed").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: text("reviewNote"),
  contactStatus: mysqlEnum("contactStatus", ["not_contacted", "queued", "review", "sent", "failed", "do_not_contact"]).default("not_contacted").notNull(),
  doNotContact: boolean("doNotContact").default(false).notNull(),
  doNotContactReason: varchar("doNotContactReason", { length: 255 }),
  doNotContactAt: timestamp("doNotContactAt"),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export const leadEvents = mysqlTable("lead_events", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  runId: int("runId"),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  outcome: varchar("outcome", { length: 64 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadEvent = typeof leadEvents.$inferSelect;
export type InsertLeadEvent = typeof leadEvents.$inferInsert;
