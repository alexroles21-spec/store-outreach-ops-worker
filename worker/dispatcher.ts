import { URL } from "node:url";

export type DispatchLead = {
  id: number;
  storeName: string;
  niche: string;
  storeUrl: string;
  normalizedHost: string;
  publicContactRoute?: string;
  contactEmail?: string;
  contactFormProtected: boolean;
  contactStatus: "queued" | "review" | "not_contacted" | "sent";
  optedIn?: boolean;
  deliveryStatus?: "pending" | "sent" | "failed" | "skipped";
  deliveryAttempts?: number;
  deliveredAt?: string;
  deliveryError?: string;
  senderEmail: string;
  subject: string;
  body: string;
};

export type DispatcherConfig = {
  endpoint: string;
  token: string;
  intervalMs: number;
  maxPerRun: number;
  allowedHost: string;
  timeoutMs: number;
};

export type DispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

function assertConfig(config: DispatcherConfig) {
  const parsed = new URL(config.endpoint);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("LOCAL_WEBHOOK_ENDPOINT must be an HTTP(S) URL");
  if (!parsed.hostname || parsed.hostname !== config.allowedHost) throw new Error("LOCAL_WEBHOOK_ENDPOINT host is not allowlisted");
  if (!config.token) throw new Error("LOCAL_WEBHOOK_TOKEN is required when auto dispatch is enabled");
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function dispatchQueuedLeads(leads: DispatchLead[], config: DispatcherConfig, update: (lead: DispatchLead) => void): Promise<DispatchResult> {
  assertConfig(config);
  const candidates = leads.filter(lead => lead.optedIn === true && !lead.contactFormProtected && lead.contactStatus === "queued" && lead.deliveryStatus !== "sent").slice(0, config.maxPerRun);
  const result: DispatchResult = { attempted: 0, sent: 0, failed: 0, skipped: leads.length - candidates.length };
  let nextStart = Date.now();
  for (const lead of candidates) {
    const wait = nextStart - Date.now();
    if (wait > 0) await sleep(wait);
    result.attempted += 1;
    lead.deliveryAttempts = (lead.deliveryAttempts ?? 0) + 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json", "authorization": `Bearer ${config.token}` },
        body: JSON.stringify({ leadId: lead.id, storeName: lead.storeName, niche: lead.niche, storeUrl: lead.storeUrl, contactEmail: lead.contactEmail, contactRoute: lead.publicContactRoute, senderEmail: lead.senderEmail, subject: lead.subject, body: lead.body }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      lead.deliveryStatus = "sent";
      lead.contactStatus = "sent";
      lead.deliveredAt = new Date().toISOString();
      lead.deliveryError = undefined;
      result.sent += 1;
    } catch (error) {
      lead.deliveryStatus = "failed";
      lead.deliveryError = String(error).slice(0, 500);
      result.failed += 1;
    } finally {
      clearTimeout(timer);
      update(lead);
      nextStart = Date.now() + config.intervalMs;
    }
  }
  return result;
}
