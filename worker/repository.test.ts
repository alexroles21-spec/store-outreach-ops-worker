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
});
