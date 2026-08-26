import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  automationSettings,
  InsertAutomationSettings,
  InsertLead,
  InsertLeadEvent,
  InsertOutreachRun,
  Lead,
  leadEvents,
  leads,
  outreachRuns,
  users,
  User,
  InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function createOutreachRun(input: InsertOutreachRun) {
  const db = await getDb();
  if (!db) return undefined;
  if (input.idempotencyKey) {
    const existing = await db.select({ id: outreachRuns.id }).from(outreachRuns).where(eq(outreachRuns.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing[0]) return existing[0].id;
  }
  const result = await db.insert(outreachRuns).values(input);
  return Number(result[0].insertId);
}

export async function updateOutreachRun(id: number, values: Partial<InsertOutreachRun>) {
  const db = await getDb();
  if (!db) return;
  await db.update(outreachRuns).set(values).where(eq(outreachRuns.id, id));
}

export async function getOutreachRunByIdempotencyKey(idempotencyKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(outreachRuns).where(eq(outreachRuns.idempotencyKey, idempotencyKey)).limit(1);
  return rows[0];
}

export async function getRecentRuns(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outreachRuns).orderBy(desc(outreachRuns.startedAt)).limit(limit);
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      protectedForms: 0,
      queuedOutreach: 0,
      contactedLeads: 0,
      verificationFailures: 0,
      latestRun: undefined,
    };
  }
  const [totals] = await db
    .select({
      totalLeads: sql<number>`count(*)`,
      qualifiedLeads: sql<number>`sum(case when ${leads.verificationStatus} = 'qualified' then 1 else 0 end)`,
      protectedForms: sql<number>`sum(case when ${leads.contactFormProtected} = true then 1 else 0 end)`,
      queuedOutreach: sql<number>`sum(case when ${leads.contactStatus} = 'queued' then 1 else 0 end)`,
      contactedLeads: sql<number>`sum(case when ${leads.contactStatus} = 'sent' then 1 else 0 end)`,
      verificationFailures: sql<number>`sum(case when ${leads.verificationStatus} in ('inactive', 'failed') then 1 else 0 end)`,
    })
    .from(leads);
  const recent = await getRecentRuns(1);
  return {
    totalLeads: Number(totals?.totalLeads ?? 0),
    qualifiedLeads: Number(totals?.qualifiedLeads ?? 0),
    protectedForms: Number(totals?.protectedForms ?? 0),
    queuedOutreach: Number(totals?.queuedOutreach ?? 0),
    contactedLeads: Number(totals?.contactedLeads ?? 0),
    verificationFailures: Number(totals?.verificationFailures ?? 0),
    latestRun: recent[0],
  };
}

export async function searchLeads(query = "", status?: Lead["contactStatus"] | "all") {
  const db = await getDb();
  if (!db) return [];
  const trimmed = query.trim();
  const conditions = [];
  if (trimmed) {
    const term = `%${trimmed}%`;
    conditions.push(or(like(leads.storeName, term), like(leads.niche, term), like(leads.storeUrl, term), like(leads.publicContactRoute, term)));
  }
  if (status && status !== "all") conditions.push(eq(leads.contactStatus, status));
  return db
    .select()
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leads.updatedAt))
    .limit(200);
}

export async function getLeadByHost(normalizedHost: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(leads).where(eq(leads.normalizedHost, normalizedHost)).limit(1);
  return rows[0];
}

export async function upsertLead(input: InsertLead) {
  const db = await getDb();
  if (!db) return { inserted: false, lead: undefined };
  await db.insert(leads).values(input).onDuplicateKeyUpdate({
    set: {
      storeName: input.storeName,
      niche: input.niche,
      storeUrl: input.storeUrl,
      region: input.region,
      regionConfidence: input.regionConfidence,
      publicContactRoute: input.publicContactRoute,
      contactRouteType: input.contactRouteType,
      contactEmail: input.contactEmail,
      contactFormProtected: input.contactFormProtected,
      protectionReason: input.protectionReason,
      verificationStatus: input.verificationStatus,
      verificationEvidence: input.verificationEvidence,
      responseTimeMs: input.responseTimeMs,
      lastVerifiedAt: input.lastVerifiedAt,
    },
  });
  const lead = await getLeadByHost(input.normalizedHost);
  return { inserted: Boolean(lead), lead };
}

export async function updateLeadStatus(id: number, contactStatus: Lead["contactStatus"], doNotContact = false, reason?: string) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.update(leads).set({
    contactStatus,
    doNotContact,
    doNotContactReason: reason,
    doNotContactAt: doNotContact ? now : undefined,
    lastContactedAt: contactStatus === "sent" ? now : undefined,
  }).where(eq(leads.id, id));
}

export async function addLeadEvent(input: InsertLeadEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leadEvents).values(input);
}

export async function getLeadEvents(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(desc(leadEvents.createdAt)).limit(80);
}

export async function updateLeadReview(id: number, reviewStatus: "reviewed" | "approved_manual" | "dismissed", note?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ reviewStatus, reviewNote: note, reviewedAt: new Date(), contactStatus: reviewStatus === "dismissed" ? "do_not_contact" : "review" }).where(eq(leads.id, id));
  await addLeadEvent({ leadId: id, eventType: "review", outcome: reviewStatus, detail: note ?? "Protected form review updated" });
}

export async function getAutomationSettings(ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(automationSettings).where(eq(automationSettings.ownerId, ownerId)).limit(1);
  return rows[0];
}

export async function upsertAutomationSettings(ownerId: number, input: Partial<InsertAutomationSettings>) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await getAutomationSettings(ownerId);
  if (existing) {
    await db.update(automationSettings).set(input).where(eq(automationSettings.ownerId, ownerId));
  } else {
    await db.insert(automationSettings).values({
      ownerId,
      targetPerRun: input.targetPerRun ?? 84,
      intervalMinutes: input.intervalMinutes ?? 60,
      enabled: input.enabled ?? true,
    });
  }
  return getAutomationSettings(ownerId);
}

export async function getAutomationByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(automationSettings).where(eq(automationSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function claimDueRun(targetCount: number, idempotencyKey?: string) {
  const db = await getDb();
  if (!db) return undefined;
  const id = await createOutreachRun({ targetCount, status: "running", idempotencyKey });
  return id;
}
