import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHourlyIdempotencyKey } from "./scheduled";
import { buildManualReviewDraft, collectGeoCandidates, dedupeCandidates, detectProtectedForm, getContactDisposition, normalizeHost, personalizeMessage, qualifyStore } from "./outreach";

describe("outreach utilities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes www hosts and strips paths", () => {
    expect(normalizeHost("https://www.ExampleStore.com/contact?x=1")).toBe("examplestore.com");
  });

  it("deduplicates candidates by normalized hostname", () => {
    expect(dedupeCandidates(["https://www.alpha.myshopify.com/", "https://alpha.myshopify.com/contact", "https://beta.myshopify.com/"])).toEqual([
      "https://www.alpha.myshopify.com/",
      "https://beta.myshopify.com/",
    ]);
  });

  it("marks common CAPTCHA signals as review-only protection", () => {
    expect(detectProtectedForm('<form><div class="g-recaptcha" data-sitekey="x"></div></form>')).toEqual({ protected: true, reason: "reCAPTCHA" });
    expect(detectProtectedForm('<form><input name="message" /></form>')).toEqual({ protected: false });
  });

  it("continues backfill after a page with no allowed geo candidates", async () => {
    const pages = [
      { urls: [], exhausted: false },
      { urls: ["https://shop.ca/"], exhausted: true },
    ];
    const result = await collectGeoCandidates(1, async page => pages[page] ?? { urls: [], exhausted: true });
    expect(result).toEqual(["https://shop.ca/"]);
  });

  it("continues after a partial page until the geo target is reached", async () => {
    const pages = [
      { urls: ["https://first.com/"], exhausted: false },
      { urls: ["https://second.ca/"], exhausted: false },
    ];
    const result = await collectGeoCandidates(2, async page => pages[page] ?? { urls: [], exhausted: true });
    expect(result).toEqual(["https://first.com/", "https://second.ca/"]);
  });

  it("classifies a live e-commerce page as qualified and records timing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("<html><title>North Star Goods</title><body>Shopify beauty products Add to cart</body></html>", { status: 200, headers: { "content-type": "text/html" } });
    }));
    const result = await qualifyStore("https://northstar.myshopify.com/");
    expect(result.verificationStatus).toBe("qualified");
    expect(result.storeName).toBe("North Star Goods");
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("classifies non-commerce content as failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("<html><title>Editorial Journal</title><body>Stories and essays</body></html>", { status: 200 });
    }));
    const result = await qualifyStore("https://journal.myshopify.com/");
    expect(result.verificationStatus).toBe("failed");
  });

  it("classifies an unavailable page as inactive", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("", { status: 503 });
    }));
    const result = await qualifyStore("https://offline.myshopify.com/");
    expect(result.verificationStatus).toBe("inactive");
  });

  it("preserves the supplied message structure while personalizing variables", () => {
    const message = personalizeMessage("North Star Goods", "Beauty", "https://northstar.example");
    expect(message.subject).toBe("Quick question about North Star Goods’s scaling");
    expect(message.body).toContain("North Star Goods team");
    expect(message.body).toContain("Beauty space");
    expect(message.body).toContain("https://ugc-gen-ai.carrd.co");
    expect(message.body).toContain("Growth Team");
    expect(message.body).not.toContain("[store_name]");
    expect(message.body).not.toContain("[niche]");
    expect(message.senderEmail).toBe("Alex.roles21@gmail.com");
    expect(message.storeUrl).toBe("https://northstar.example");
  });

  it("routes CAPTCHA forms to review and open email routes to queue", () => {
    expect(getContactDisposition({ verificationStatus: "qualified", publicContactRoute: "https://store.example/contact", contactFormProtected: true })).toBe("review");
    expect(getContactDisposition({ verificationStatus: "qualified", publicContactRoute: "mailto:hello@store.example", contactFormProtected: false })).toBe("queued");
  });

  it("builds a protected-form review draft with the sender and contact route", () => {
    const draft = buildManualReviewDraft("North Star Goods", "Beauty", "https://northstar.example", "https://northstar.example/contact");
    expect(draft.senderEmail).toBe("Alex.roles21@gmail.com");
    expect(draft.subject).toContain("North Star Goods");
    expect(draft.body).toContain("Growth Team");
    expect(draft.contactRoute).toBe("https://northstar.example/contact");
  });

  it("uses the same idempotency key for retries in one UTC hour", () => {
    const first = new Date("2026-08-26T10:05:00.000Z");
    const retry = new Date("2026-08-26T10:55:00.000Z");
    const nextHour = new Date("2026-08-26T11:00:00.000Z");
    expect(buildHourlyIdempotencyKey("cron_task", first)).toBe(buildHourlyIdempotencyKey("cron_task", retry));
    expect(buildHourlyIdempotencyKey("cron_task", first)).not.toBe(buildHourlyIdempotencyKey("cron_task", nextHour));
  });
});
