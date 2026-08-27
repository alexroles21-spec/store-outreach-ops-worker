import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalCwd = process.cwd();
const originalEnv = { ...process.env };

describe("repository dispatcher integration", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("runs at most one completed target batch per UTC hour", async () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-idempotency-"));
    process.chdir(dir);
    mkdirSync(join(dir, "data"), { recursive: true });
    writeFileSync(join(dir, "data", "runs.json"), JSON.stringify([{ startedAt: "2026-08-27T12:02:00.000Z", qualified: 84 }]));
    const { hasCompletedTargetThisUtcHour } = await import("./repository");
    expect(hasCompletedTargetThisUtcHour(JSON.parse(readFileSync(join(dir, "data", "runs.json"), "utf8")), 84, new Date("2026-08-27T12:45:00.000Z"))).toBe(true);
    expect(hasCompletedTargetThisUtcHour([{ startedAt: "2026-08-27T12:02:00.000Z", qualified: 83 }], 84, new Date("2026-08-27T12:45:00.000Z"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("dispatches an opted-in queued lead and persists sent state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-cycle-"));
    const received: string[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => { received.push(body); response.statusCode = 200; response.end("ok"); });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server address unavailable");
    process.chdir(dir);
    mkdirSync(join(dir, "data"), { recursive: true });
    writeFileSync(join(dir, "data", "opt-in-registry.json"), JSON.stringify({ "example-store.test": true }));
    process.env.AUTO_DISPATCH = "true";
    process.env.LOCAL_WEBHOOK_ENDPOINT = `http://127.0.0.1:${address.port}/hook`;
    process.env.LOCAL_WEBHOOK_ALLOWED_HOST = "127.0.0.1";
    process.env.LOCAL_WEBHOOK_TOKEN = "integration-token";
    process.env.WORKER_DRY_RUN = "false";

    vi.doMock("../server/outreach", () => ({
      collectGeoCandidates: vi.fn(async () => ["https://example-store.test"]),
      discoverPublicStoreUrls: vi.fn(async () => ["https://example-store.test"]),
      qualifyStore: vi.fn(async () => ({ storeName: "Example Store", niche: "Electronics", storeUrl: "https://example-store.test", normalizedHost: "example-store.test", region: "US", publicContactRoute: "https://example-store.test/contact", contactEmail: "owner@example-store.test", contactFormProtected: false, verificationStatus: "qualified", verificationEvidence: "HTTP 200", responseTimeMs: 10, protectionReason: undefined })),
      personalizeMessage: vi.fn(() => ({ senderEmail: "sender@example.test", subject: "Subject", body: "Body" })),
      isPriorityNiche: vi.fn((niche: string) => niche !== "General e-commerce"),
      isUsableEmail: vi.fn((email?: string) => Boolean(email && !email.endsWith(".png"))),
    }));
    const { runRepositoryCycle } = await import("./repository");
    const run = await runRepositoryCycle(1);
    await new Promise<void>(resolve => server.close(() => resolve()));
    const leads = JSON.parse(readFileSync(join(dir, "data", "leads.json"), "utf8"));
    rmSync(dir, { recursive: true, force: true });
    expect(run.dispatch).toMatchObject({ attempted: 1, sent: 1, failed: 0 });
    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0]).leadId).toBe(1);
    expect(leads[0].deliveryStatus).toBe("sent");
    expect(leads[0].contactStatus).toBe("sent");
  });

  it("keeps sent leads in stores but removes them from the contact review report", async () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-reports-"));
    process.chdir(dir);
    mkdirSync(join(dir, "data"), { recursive: true });
    const { renderPages } = await import("./repository");
    const base = { id: 1, storeName: "Sent Store", niche: "Beauty", storeUrl: "https://sent-store.test", normalizedHost: "sent-store.test", region: "US", publicContactRoute: "https://sent-store.test/contact", contactEmail: "hello@sent-store.test", contactFormProtected: true, protectionReason: "CAPTCHA", verificationStatus: "qualified", verificationEvidence: "HTTP 200", contactStatus: "sent", deliveryStatus: "sent", discoveredAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(), senderEmail: "sender@example.test", subject: "Subject", body: "Body" };
    renderPages([base as never], []);
    const stores = readFileSync(join(dir, "data", "stores.html"), "utf8");
    const review = readFileSync(join(dir, "data", "contact-review.html"), "utf8");
    rmSync(dir, { recursive: true, force: true });
    expect(stores).toContain("Sent Store");
    expect(review).not.toContain("Sent Store");
  });

  it("keeps email-only records visible without a mailto Contact action", async () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-email-only-"));
    process.chdir(dir);
    mkdirSync(join(dir, "data"), { recursive: true });
    const { renderPages } = await import("./repository");
    const emailOnly = { id: 3, storeName: "Email Only Store", niche: "Beauty", storeUrl: "https://email-only.test", normalizedHost: "email-only.test", region: "US", publicContactRoute: "mailto:hello@email-only.test", contactEmail: "hello@email-only.test", contactFormProtected: false, verificationStatus: "qualified", verificationEvidence: "HTTP 200", contactStatus: "queued", deliveryStatus: "pending", discoveredAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(), senderEmail: "sender@example.test", subject: "Subject", body: "Body" };
    renderPages([emailOnly as never], []);
    const review = readFileSync(join(dir, "data", "contact-review.html"), "utf8");
    rmSync(dir, { recursive: true, force: true });
    expect(review).toContain("Email Only Store");
    expect(review).toContain("Email-only — no Contact page found");
    expect(review).not.toContain('class="send" href="mailto:');
  });

  it("includes queued non-CAPTCHA leads in the contact queue", async () => {
    const dir = mkdtempSync(join(tmpdir(), "repo-ready-contact-"));
    process.chdir(dir);
    mkdirSync(join(dir, "data"), { recursive: true });
    const { renderPages } = await import("./repository");
    const ready = { id: 2, storeName: "Ready Store", niche: "Home decor & lighting", storeUrl: "https://ready-store.test", normalizedHost: "ready-store.test", region: "CA", publicContactRoute: "https://ready-store.test/contact", contactEmail: "hello@ready-store.test", contactFormProtected: false, verificationStatus: "qualified", verificationEvidence: "HTTP 200", contactStatus: "queued", deliveryStatus: "pending", discoveredAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(), senderEmail: "sender@example.test", subject: "Subject", body: "Body" };
    renderPages([ready as never], []);
    const review = readFileSync(join(dir, "data", "contact-review.html"), "utf8");
    rmSync(dir, { recursive: true, force: true });
    expect(review).toContain("Ready Store");
    expect(review).toContain("Contact pages");
    expect(review).toContain("I sent it — remove from queue");
    expect(review).toContain("Copy subject");
    expect(review).toContain("Copy message");
    expect(review).toContain("minmax(0,1fr)");
    expect(review).toContain("overflow-wrap:anywhere");
  });
});
