import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHourlyIdempotencyKey } from "./scheduled";
import { buildManualReviewDraft, collectGeoCandidates, dedupeCandidates, detectLockedStore, detectProtectedForm, getContactDisposition, isEnglishStorefront, isPriorityNiche, normalizeHost, personalizeMessage, qualifyStore } from "./outreach";

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

  it("marks password-locked storefronts as inaccessible", () => {
    expect(detectLockedStore('<html><title>Opening soon</title><body>Shopify store is password protected <input type="password" /></body></html>')).toBe(true);
    expect(detectLockedStore('<html><title>Shopify Store</title><body>Products and Add to cart</body></html>')).toBe(false);
  });

  it("accepts English storefront signals and rejects clear non-English signals", () => {
    expect(isEnglishStorefront('<html lang="en"><body>Add to cart</body></html>')).toBe(true);
    expect(isEnglishStorefront('<html lang="de"><body>Warenkorb und Versand</body></html>')).toBe(false);
    expect(isEnglishStorefront('<body>Panier et livraison</body>')).toBe(false);
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

  it("prefers a real Contact form route over a homepage mailto link", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url.endsWith("/contact")) return new Response('<html lang="en"><form><textarea name="message"></textarea></form></html>', { status: 200 });
      return new Response('<html lang="en"><title>Contactable Goods</title><body>Shopify products Add to cart <a href="/contact">Contact us</a><a href="mailto:hello@contactable.test">Email</a></body></html>', { status: 200 });
    }));
    const result = await qualifyStore("https://contactable.myshopify.com/");
    expect(result.verificationStatus).toBe("qualified");
    expect(result.contactRouteType).toBe("contact_form");
    expect(result.publicContactRoute).toBe("https://contactable.myshopify.com/contact");
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

  it("classifies a password-locked storefront as inactive", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response('<html><title>Opening soon</title><body>Shopify store is password protected <input type="password" /></body></html>', { status: 200 });
    }));
    const result = await qualifyStore("https://locked.myshopify.com/");
    expect(result.verificationStatus).toBe("inactive");
    expect(result.verificationEvidence).toContain("password-locked");
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

  it("recognizes only the requested physical-product niche labels as priority", () => {
    expect(isPriorityNiche("Skincare & anti-aging")).toBe(true);
    expect(isPriorityNiche("Pet supplies")).toBe(true);
    expect(isPriorityNiche("General e-commerce")).toBe(false);
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
