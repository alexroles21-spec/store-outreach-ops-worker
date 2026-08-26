import { beforeEach, describe, expect, it, vi } from "vitest";

const records: Array<Record<string, unknown>> = [];
const events: Array<Record<string, unknown>> = [];

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => records.slice(0, 1),
        }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        if (value.leadId) events.push(value);
        return {
          onDuplicateKeyUpdate: async ({ set }: { set: Record<string, unknown> }) => {
            const existing = records.find(record => record.normalizedHost === value.normalizedHost);
            if (existing) Object.assign(existing, set);
            else records.push({ ...value, id: records.length + 1 });
          },
        };
      },
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          Object.assign(records[0], value);
        },
      }),
    }),
  }),
}));

describe("lead persistence", () => {
  beforeEach(() => {
    records.length = 0;
    events.length = 0;
    process.env.DATABASE_URL = "mysql://test";
  });

  it("upserts a duplicate normalized host instead of creating a second record", async () => {
    const { upsertLead } = await import("./db");
    const base = {
      normalizedHost: "northstar.myshopify.com",
      storeName: "North Star Goods",
      niche: "Beauty",
      storeUrl: "https://northstar.myshopify.com/",
      region: "US",
      regionConfidence: "high",
      publicContactRoute: "mailto:hello@northstar.example",
      contactRouteType: "email" as const,
      contactEmail: "hello@northstar.example",
      contactFormProtected: false,
      verificationStatus: "qualified" as const,
      verificationEvidence: "HTTP 200; response time 120ms",
      responseTimeMs: 120,
      contactStatus: "queued" as const,
      doNotContact: false,
      lastVerifiedAt: new Date(),
    };
    await upsertLead(base);
    await upsertLead({ ...base, storeName: "North Star Goods Updated", responseTimeMs: 180 });
    expect(records).toHaveLength(1);
    expect(records[0]?.storeName).toBe("North Star Goods Updated");
    expect(records[0]?.responseTimeMs).toBe(180);
  });

  it("persists manual sent status and its audit event", async () => {
    const { upsertLead, updateLeadStatus, addLeadEvent } = await import("./db");
    await upsertLead({
      normalizedHost: "protected.myshopify.com",
      storeName: "Protected Goods",
      niche: "Beauty",
      storeUrl: "https://protected.myshopify.com/",
      region: "US",
      regionConfidence: "medium",
      publicContactRoute: "https://protected.myshopify.com/contact",
      contactRouteType: "contact_form",
      contactFormProtected: true,
      protectionReason: "reCAPTCHA",
      verificationStatus: "qualified",
      verificationEvidence: "HTTP 200; protected contact form",
      responseTimeMs: 100,
      contactStatus: "review",
      doNotContact: false,
      lastVerifiedAt: new Date(),
    });
    await updateLeadStatus(1, "sent", false, "Manually submitted after CAPTCHA review");
    await addLeadEvent({ leadId: 1, eventType: "status", outcome: "sent", detail: "Manually submitted after CAPTCHA review" });
    expect(records[0]?.contactStatus).toBe("sent");
    expect(records[0]?.lastContactedAt).toBeInstanceOf(Date);
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe("sent");
  });
});
