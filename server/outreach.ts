import {
  addLeadEvent,
  createOutreachRun,
  getOutreachRunByIdempotencyKey,
  getLeadByHost,
  updateOutreachRun,
  upsertLead,
} from "./db";

const COMMON_CRAWL_COLLECTIONS = "https://index.commoncrawl.org/collinfo.json";
const USER_AGENT = "StoreOutreachResearch/1.0 (+public-lead-review)";
const REGIONS = ["US", "CA", "EU", "AU"] as const;
const NICHE_RULES: Array<[string, string[]]> = [
  ["Skincare & anti-aging", ["skincare", "skin care", "anti-aging", "antiaging", "serum", "moisturizer", "retinol"]],
  ["Hair care", ["hair growth", "hair oil", "haircare", "hair care", "styler", "hair brush", "brushes"]],
  ["Oral care", ["teeth whitening", "tooth whitening", "oral care", "toothbrush", "dental"]],
  ["Supplements & vitamins", ["supplement", "vitamin", "probiotic", "collagen", "protein powder"]],
  ["Makeup & cosmetics", ["beauty", "cosmetic", "cosmetics", "makeup", "foundation", "lipstick"]],
  ["Nail & eyelash care", ["nail", "eyelash", "lash", "manicure", "pedicure"]],
  ["Hair removal", ["hair removal", "epilator", "waxing", "laser hair"]],
  ["Smart home & kitchen", ["smart kitchen", "kitchen", "organizer", "storage", "home gadget"]],
  ["Cleaning tools", ["cleaning", "mop", "scrub", "vacuum", "laundry"]],
  ["Home decor & lighting", ["home", "decor", "furniture", "living", "led light", "lighting"]],
  ["Pet supplies", ["pet", "dog", "cat", "animal", "pet bed", "pet toy"]],
  ["Fitness & yoga", ["fitness", "gym", "workout", "resistance band", "yoga", "activewear"]],
  ["Shapewear", ["shapewear", "compression wear", "waist trainer"]],
  ["Recovery & massage", ["massage", "foam roller", "recovery", "massage gun"]],
  ["Phone & tech accessories", ["gadget", "tech", "electronics", "device", "phone case", "phone mount", "tech pouch"]],
  ["Travel organizers", ["travel organizer", "luggage organizer", "packing cube", "travel pouch"]],
  ["Jewelry & lifestyle accessories", ["apparel", "clothing", "fashion", "shoe", "jewelry", "sunglasses", "watch", "wallet", "handbag"]],
];

export const PRIORITY_NICHES = NICHE_RULES.map(([niche]) => niche);

export function isPriorityNiche(niche: string) {
  return PRIORITY_NICHES.includes(niche);
}

export type ContactRouteType = "email" | "contact_form" | "none" | "unknown";

export type StoreCandidate = {
  storeUrl: string;
  normalizedHost: string;
  storeName: string;
  niche: string;
  region: string;
  regionConfidence: string;
};

export type QualificationResult = StoreCandidate & {
  verificationStatus: "qualified" | "inactive" | "failed";
  verificationEvidence: string;
  publicContactRoute?: string;
  contactRouteType: ContactRouteType;
  contactEmail?: string;
  contactFormProtected: boolean;
  protectionReason?: string;
  responseTimeMs: number;
};

function absoluteUrl(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

export function normalizeHost(value: string): string {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^www\./, "").split("/")[0];
  }
}

function escapeText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagValue(html: string, tag: string, attribute: string, value: string) {
  const expression = new RegExp(`<${tag}[^>]*${attribute}=["']${value}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(expression);
  return match?.[1] ? escapeText(match[1]) : undefined;
}

function inferNiche(text: string, host: string) {
  const haystack = `${text} ${host}`.toLowerCase();
  for (const [niche, words] of NICHE_RULES) {
    if (words.some(word => haystack.includes(word))) return niche;
  }
  return "General e-commerce";
}

function inferRegion(url: string, text: string) {
  const host = normalizeHost(url);
  const lower = `${host} ${text}`.toLowerCase();
  if (host.endsWith(".ca") || /\b(cad|canada|ontario|toronto|montreal)\b/.test(lower)) return { region: "CA", regionConfidence: "high" };
  if (host.endsWith(".au") || /\b(aud|australia|sydney|melbourne)\b/.test(lower)) return { region: "AU", regionConfidence: "high" };
  if ([".de", ".fr", ".it", ".es", ".nl", ".be", ".se", ".dk", ".no", ".fi", ".ie", ".pt", ".at", ".eu"].some(tld => host.endsWith(tld)) || /\b(eur|europe|european)\b/.test(lower)) return { region: "EU", regionConfidence: "high" };
  if (host.endsWith(".com") || /\b(usd|united states|usa|new york|california|texas)\b/.test(lower)) return { region: "US", regionConfidence: host.endsWith(".com") ? "medium" : "high" };
  return { region: "OTHER", regionConfidence: "low" };
}

export function isUsableEmail(email?: string) {
  if (!email) return false;
  const lower = email.toLowerCase();
  const extension = lower.split(".").pop() ?? "";
  const ignoredDomains = ["example.com", "sentry.io", "wixpress.com", "yourdomain.com"];
  const assetExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "css", "js"]);
  return !assetExtensions.has(extension) && !ignoredDomains.some(domain => lower.endsWith(`@${domain}`));
}

function firstEmail(...sources: string[]) {
  const matches = sources.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return matches.find(isUsableEmail);
}

function findContactLink(html: string, baseUrl: string) {
  const anchors = html.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? [];
  for (const anchor of anchors) {
    const href = anchor.match(/href=["']([^"']+)["']/i)?.[1];
    const label = escapeText(anchor).toLowerCase();
    if (href && /(contact|support|help|about)/i.test(`${href} ${label}`)) {
      const result = absoluteUrl(href, baseUrl);
      if (result) return result.split("#")[0];
    }
  }
  return undefined;
}

export function detectLockedStore(html: string) {
  return /(?:shopify|myshopify)[\s\S]{0,180}(?:password protected|enter using password|store is locked|opening soon)|(?:password protected|enter using password|store is locked|opening soon)[\s\S]{0,180}(?:shopify|myshopify)/i.test(html) || /<input[^>]+type=["']password["']/i.test(html) && /(?:store|shopify|password)/i.test(html);
}

export function detectProtectedForm(html: string) {
  const signals = [
    ["reCAPTCHA", /recaptcha|g-recaptcha|grecaptcha/i],
    ["hCaptcha", /hcaptcha|h-captcha/i],
    ["Cloudflare challenge", /cf-chl-|cloudflare.*challenge|turnstile/i],
    ["CAPTCHA field", /name=["'][^"']*captcha[^"']*["']|id=["'][^"']*captcha[^"']*["']/i],
    ["Human verification", /verify you are human|prove you are human|anti-bot/i],
  ] as const;
  const hit = signals.find(([, expression]) => expression.test(html));
  return hit ? { protected: true, reason: hit[0] } : { protected: false };
}

async function fetchText(url: string, timeoutMs = 6500, maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      });
      const text = await response.text();
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) return { response, text };
      await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${url}`);
}

async function robotsAllow(url: string) {
  try {
    const parsed = new URL(url);
    const robots = await fetchText(`${parsed.origin}/robots.txt`, 3500);
    if (!robots.response.ok) return true;
    const lines = robots.text.split(/\r?\n/).map(line => line.trim());
    let applies = false;
    let blocked = false;
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const [key, rawValue = ""] = line.split(":", 2);
      const value = rawValue.trim();
      if (key.toLowerCase() === "user-agent") applies = value === "*" || value.toLowerCase().includes("storeoutreachresearch");
      if (applies && key.toLowerCase() === "disallow" && value && parsed.pathname.startsWith(value)) blocked = true;
    }
    return !blocked;
  } catch {
    return true;
  }
}

function parseCommonCrawlLines(raw: string, target: number) {
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap(line => {
      try {
        const parsed = JSON.parse(line) as { url?: string; status?: string };
        return parsed.url && parsed.status === "200" ? [parsed.url] : [];
      } catch {
        return [];
      }
    })
    .map(url => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}/`;
      } catch {
        return undefined;
      }
    })
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, Math.max(target * 8, 160));
}

export function dedupeCandidates(urls: string[]) {
  const seen = new Set<string>();
  return urls.filter(url => {
    const host = normalizeHost(url);
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });
}

export async function discoverPublicStoreUrls(target: number, page = 0) {
  // Query more than one public storefront pattern, then move across crawl snapshots and page offsets.
  const patterns = ["*.myshopify.com/*", "*.shopify.com/*"];
  const requestedLimit = Math.min(Math.max(target * 2, 200), 1000);
  let collectionsResponse: { response: Response; text: string };
  try {
    collectionsResponse = await fetchText(COMMON_CRAWL_COLLECTIONS, 7000);
  } catch (error) {
    console.warn(JSON.stringify({ event: "discovery_collections_unavailable", error: String(error) }));
    return { urls: [], exhausted: true };
  }
  if (!collectionsResponse.response.ok) {
    console.warn(JSON.stringify({ event: "discovery_collections_failed", status: collectionsResponse.response.status }));
    return { urls: [], exhausted: true };
  }
  let collections: Array<{ id: string }>;
  try {
    collections = JSON.parse(collectionsResponse.text) as Array<{ id: string }>;
  } catch (error) {
    console.warn(JSON.stringify({ event: "discovery_collections_invalid", error: String(error) }));
    return { urls: [], exhausted: true };
  }
  const pageSpan = 12;
  const patternIndex = Math.floor(page / pageSpan) % patterns.length;
  const collectionIndex = Math.floor(page / (patterns.length * pageSpan));
  const pageOffset = Math.floor(page / patterns.length) % pageSpan;
  const collection = collections[collectionIndex];
  if (!collection?.id) return { urls: [], exhausted: true };
  const query = new URL(`https://index.commoncrawl.org/${collection.id}-index`);
  query.searchParams.set("url", patterns[patternIndex]);
  query.searchParams.set("output", "json");
  query.searchParams.set("filter", "status:200");
  query.searchParams.set("collapse", "urlkey");
  query.searchParams.set("page", String(pageOffset));
  query.searchParams.set("limit", String(requestedLimit));
  try {
    const indexResponse = await fetchText(query.toString(), 12000);
    if (!indexResponse.response.ok) throw new Error(`Common Crawl index failed with ${indexResponse.response.status}`);
    const urls = parseCommonCrawlLines(indexResponse.text, target);
    const noMoreCollections = collectionIndex >= collections.length - 1;
    return { urls, exhausted: urls.length === 0 && noMoreCollections };
  } catch (error) {
    const noMoreCollections = collectionIndex >= collections.length - 1;
    console.warn(JSON.stringify({ event: "discovery_page_skipped", page, pattern: patterns[patternIndex], collection: collection.id, error: String(error) }));
    return { urls: [], exhausted: noMoreCollections };
  }
}

export async function collectGeoCandidates(target: number, loadPage: (page: number) => Promise<{ urls: string[]; exhausted: boolean }>) {
  const allowedUrls: string[] = [];
  const seenUrls = new Set<string>();
  let page = 0;
  let sourceExhausted = false;
  while (!sourceExhausted && allowedUrls.length < target) {
    const pageResult = await loadPage(page);
    const pageUrls = dedupeCandidates(pageResult.urls);
    for (const url of pageUrls) {
      const candidateRegion = inferRegion(url, "").region;
      if (!REGIONS.includes(candidateRegion as typeof REGIONS[number]) || seenUrls.has(normalizeHost(url))) continue;
      seenUrls.add(normalizeHost(url));
      allowedUrls.push(url);
    }
    sourceExhausted = pageResult.exhausted;
    page += 1;
  }
  return allowedUrls;
}

export async function qualifyStore(storeUrl: string): Promise<QualificationResult> {
  const startedAt = Date.now();
  const normalizedHost = normalizeHost(storeUrl);
  const requestedUrl = `${new URL(storeUrl).origin}/`;
  const allowed = await robotsAllow(requestedUrl);
  if (!allowed) {
    const region = inferRegion(requestedUrl, "");
    return {
      storeUrl: requestedUrl,
      normalizedHost,
      storeName: normalizedHost,
      niche: "General e-commerce",
      ...region,
      verificationStatus: "failed",
      verificationEvidence: "robots.txt disallows automated research for the homepage",
      contactRouteType: "none",
      contactFormProtected: false,
      responseTimeMs: Date.now() - startedAt,
    };
  }

  try {
    const homepage = await fetchText(requestedUrl);
    const body = escapeText(homepage.text);
    const titleOpen = homepage.text.toLowerCase().indexOf("<title");
    const titleStart = titleOpen >= 0 ? homepage.text.indexOf(">", titleOpen) + 1 : -1;
    const titleEnd = titleStart > 0 ? homepage.text.toLowerCase().indexOf("</title>", titleStart) : -1;
    const title = titleStart > 0 && titleEnd > titleStart ? escapeText(homepage.text.slice(titleStart, titleEnd)) : undefined;
    const ogTitle = homepage.text.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || homepage.text.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const siteName = homepage.text.match(/property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] || homepage.text.match(/name=["']application-name["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const storeName = (title && title.length > 2 ? title : undefined) || ogTitle || siteName || normalizedHost.split(".")[0].replace(/[-_]/g, " ");
    const region = inferRegion(requestedUrl, body);
    const ecomSignal = /shopify|myshopify|add to cart|shopping cart|products?\b|checkout|application\/ld\+json/i.test(homepage.text);
    const locked = detectLockedStore(homepage.text);
    const evidence = `HTTP ${homepage.response.status}; final URL ${homepage.response.url}; e-commerce signal ${ecomSignal ? "detected" : "not detected"}; storefront lock ${locked ? "detected" : "not detected"}; checked ${new Date().toISOString()}`;
    if (locked || !homepage.response.ok || !ecomSignal) {
      return {
        storeUrl: homepage.response.url || requestedUrl,
        normalizedHost,
        storeName,
        niche: inferNiche(body, normalizedHost),
        ...region,
        verificationStatus: locked ? "inactive" : homepage.response.ok ? "failed" : "inactive",
        verificationEvidence: `${evidence}; response time ${Date.now() - startedAt}ms${locked ? "; storefront is password-locked" : ""}`,
        contactRouteType: "none",
        contactFormProtected: false,
        responseTimeMs: Date.now() - startedAt,
      };
    }

    const email = firstEmail(homepage.text);
    const contactUrl = findContactLink(homepage.text, homepage.response.url || requestedUrl);
    let contactRouteType: ContactRouteType = email ? "email" : "none";
    let publicContactRoute = email ? `mailto:${email}` : undefined;
    let contactFormProtected = false;
    let protectionReason: string | undefined;
    if (!email && contactUrl && await robotsAllow(contactUrl)) {
      const contactPage = await fetchText(contactUrl);
      const contactEmail = firstEmail(contactPage.text);
      const protection = detectProtectedForm(contactPage.text);
      if (contactEmail) {
        contactRouteType = "email";
        publicContactRoute = `mailto:${contactEmail}`;
      } else if (/<form\b/i.test(contactPage.text)) {
        contactRouteType = "contact_form";
        publicContactRoute = contactUrl;
        contactFormProtected = protection.protected;
        protectionReason = protection.reason;
      }
    }

    return {
      storeUrl: homepage.response.url || requestedUrl,
      normalizedHost,
      storeName,
      niche: inferNiche(body, normalizedHost),
      ...region,
      verificationStatus: "qualified",
      verificationEvidence: `${evidence}; contact route ${contactRouteType}${protectionReason ? `; protected by ${protectionReason}` : ""}`,
      publicContactRoute,
      contactRouteType,
      contactEmail: publicContactRoute?.startsWith("mailto:") ? publicContactRoute.slice(7) : undefined,
      contactFormProtected,
      protectionReason,
      responseTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    const region = inferRegion(requestedUrl, "");
    return {
      storeUrl: requestedUrl,
      normalizedHost,
      storeName: normalizedHost,
      niche: "General e-commerce",
      ...region,
      verificationStatus: "failed",
      verificationEvidence: `Request failed: ${String(error)}`,
      contactRouteType: "none",
      contactFormProtected: false,
      responseTimeMs: Date.now() - startedAt,
    };
  }
}

export const OUTREACH_SENDER_EMAIL = "Alex.roles21@gmail.com";
export const OUTREACH_SIGNATURE = "Growth Team";

export function personalizeMessage(storeName: string, niche: string, storeUrl: string) {
  const subject = `Quick question about ${storeName}’s scaling`;
  const body = `Hey ${storeName} team,\n\nI was just analyzing top-performing e-commerce brands in the ${niche} space and came across your store. Great branding and product lineup!\n\nQuick question: Are you currently using AI UGC video ads to test new products and scale globally without the headache of shooting content?\n\nMost ${niche} stores are leaving money on the table because traditional content creation is too slow and expensive. With AI UGC, you can generate endless high-converting, viral video ads in seconds—in any language and with any persona.\n\nI put together a quick breakdown of how top brands are using this right now:\n\n👉 Check it out here: https://ugc-gen-ai.carrd.co\n\nKeep crushing it,  \n${OUTREACH_SIGNATURE}`;
  return { senderEmail: OUTREACH_SENDER_EMAIL, subject, body, storeUrl };
}

export function buildManualReviewDraft(storeName: string, niche: string, storeUrl: string, contactRoute: string) {
  return { ...personalizeMessage(storeName, niche, storeUrl), contactRoute };
}

export function getContactDisposition(input: Pick<QualificationResult, "verificationStatus" | "publicContactRoute" | "contactFormProtected">) {
  if (input.contactFormProtected) return "review" as const;
  if (input.verificationStatus === "qualified" && input.publicContactRoute) return "queued" as const;
  return "not_contacted" as const;
}

export async function runDiscoveryCycle(targetCount = 84, idempotencyKey?: string) {
  const existingRun = idempotencyKey ? await getOutreachRunByIdempotencyKey(idempotencyKey) : undefined;
  if (existingRun && existingRun.status !== "running") return { runId: existingRun.id, qualified: existingRun.qualifiedCount, discovered: existingRun.discoveredCount, failures: existingRun.verificationFailures, protected: existingRun.protectedForms, queued: existingRun.queuedOutreach };
  const runId = await createOutreachRun({ targetCount, status: "running", idempotencyKey });
  if (!runId) return { runId: undefined, qualified: 0, discovered: 0, failures: 0, protected: 0, queued: 0 };
  let discovered = 0;
  let qualified = 0;
  let failures = 0;
  let protectedForms = 0;
  let queued = 0;
  try {
    const allowedUrls = await collectGeoCandidates(targetCount, page => discoverPublicStoreUrls(targetCount, page));
    discovered = allowedUrls.length;

    for (let cursor = 0; cursor < allowedUrls.length && qualified < targetCount; cursor += 8) {
      const batch = await Promise.all(allowedUrls.slice(cursor, cursor + 8).map(qualifyStore));
      for (const result of batch) {
        const existing = await getLeadByHost(result.normalizedHost);
        if (existing) {
          await addLeadEvent({ leadId: existing.id, runId, eventType: "duplicate", outcome: "skipped", detail: "Normalized hostname already exists" });
          continue;
        }
        if (result.verificationStatus === "qualified" && !isPriorityNiche(result.niche)) {
          failures += 1;
          continue;
        }
        if (result.verificationStatus === "qualified") qualified += 1;
        else failures += 1;
        if (result.contactFormProtected) protectedForms += 1;
          const contactDisposition = getContactDisposition(result);
          const isQueueable = contactDisposition === "queued";
        const saved = await upsertLead({
          normalizedHost: result.normalizedHost,
          storeName: result.storeName,
          niche: result.niche,
          storeUrl: result.storeUrl,
          region: result.region,
          regionConfidence: result.regionConfidence,
          publicContactRoute: result.publicContactRoute,
          contactRouteType: result.contactRouteType,
          contactEmail: result.contactEmail,
          contactFormProtected: result.contactFormProtected,
          protectionReason: result.protectionReason,
          verificationStatus: result.verificationStatus,
          responseTimeMs: result.responseTimeMs,
          verificationEvidence: result.verificationEvidence,
          contactStatus: contactDisposition,
          doNotContact: false,
          lastVerifiedAt: new Date(),
        });
        if (saved.lead) {
          await addLeadEvent({ leadId: saved.lead.id, runId, eventType: "verification", outcome: result.verificationStatus, detail: result.verificationEvidence });
          if (result.contactFormProtected) await addLeadEvent({ leadId: saved.lead.id, runId, eventType: "protection", outcome: "review", detail: result.protectionReason ?? "Protected form" });
          if (isQueueable) {
            queued += 1;
            await addLeadEvent({ leadId: saved.lead.id, runId, eventType: "outreach", outcome: "queued", detail: "Ready for configured compliant transport" });
          }
        }
      }
    }
    await updateOutreachRun(runId, { discoveredCount: discovered, qualifiedCount: qualified, verificationFailures: failures, protectedForms, queuedOutreach: queued, status: "completed", finishedAt: new Date() });
    return { runId, qualified, discovered, failures, protected: protectedForms, queued };
  } catch (error) {
    await updateOutreachRun(runId, { discoveredCount: discovered, qualifiedCount: qualified, verificationFailures: failures, protectedForms, queuedOutreach: queued, status: "failed", errorMessage: String(error), finishedAt: new Date() });
    throw error;
  }
}
