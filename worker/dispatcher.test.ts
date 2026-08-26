import { describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dispatchQueuedLeads, type DispatchLead } from "./dispatcher";

function lead(id: number, changes: Partial<DispatchLead> = {}): DispatchLead {
  return { id, storeName: `Store ${id}`, niche: "Electronics", storeUrl: `https://store-${id}.test`, normalizedHost: `store-${id}.test`, contactFormProtected: false, contactStatus: "queued", optedIn: true, senderEmail: "owner@example.test", subject: "Subject", body: "Body", ...changes };
}

describe("sequential webhook dispatcher", () => {
  it("sends only opted-in non-CAPTCHA queued leads and records sent state", async () => {
    const received: Array<{ authorization: string | undefined; body: string }> = [];
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => { received.push({ authorization: request.headers.authorization, body }); response.statusCode = 202; response.end("accepted"); });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const allowed = [lead(1), lead(2, { optedIn: false }), lead(3, { contactFormProtected: true }), lead(4, { contactStatus: "sent", deliveryStatus: "sent" })];
    const result = await dispatchQueuedLeads(allowed, { endpoint: `http://127.0.0.1:${address.port}/dispatch`, token: "test-token", allowedHost: "127.0.0.1", intervalMs: 0, maxPerRun: 84, timeoutMs: 2000 }, () => undefined);
    await new Promise<void>(resolve => server.close(() => resolve()));
    expect(result).toMatchObject({ attempted: 1, sent: 1, failed: 0, skipped: 3 });
    expect(received).toHaveLength(1);
    expect(received[0].authorization).toBe("Bearer test-token");
    expect(JSON.parse(received[0].body).leadId).toBe(1);
    expect(allowed[0].contactStatus).toBe("sent");
    expect(allowed[0].deliveryStatus).toBe("sent");
  });

  it("rejects an endpoint whose host is not allowlisted", async () => {
    await expect(dispatchQueuedLeads([lead(1)], { endpoint: "https://example.com/dispatch", token: "x", allowedHost: "127.0.0.1", intervalMs: 0, maxPerRun: 1, timeoutMs: 1000 }, () => undefined)).rejects.toThrow("not allowlisted");
  });
});
