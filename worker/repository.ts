import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectGeoCandidates, isUsableEmail, qualifyStore, personalizeMessage } from "../server/outreach";
import { dispatchQueuedLeads, type DispatcherConfig } from "./dispatcher";

export type RepoLead = ReturnType<typeof personalizeMessage> & {
  id: number;
  storeName: string;
  niche: string;
  storeUrl: string;
  normalizedHost: string;
  region: string;
  publicContactRoute?: string;
  contactEmail?: string;
  contactFormProtected: boolean;
  protectionReason?: string;
  verificationStatus: string;
  verificationEvidence: string;
  responseTimeMs?: number;
  contactStatus: "queued" | "review" | "not_contacted" | "sent";
  optedIn?: boolean;
  deliveryStatus?: "pending" | "sent" | "failed" | "skipped";
  deliveryAttempts?: number;
  deliveredAt?: string;
  deliveryError?: string;
  discoveredAt: string;
  lastVerifiedAt: string;
};

const DATA_DIR = join(process.cwd(), "data");
const LEADS_FILE = join(DATA_DIR, "leads.json");
const RUNS_FILE = join(DATA_DIR, "runs.json");
const CURSOR_FILE = join(DATA_DIR, "source-cursor.json");
const OPT_IN_FILE = join(DATA_DIR, "opt-in-registry.json");

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, "utf8")) as T; } catch { return fallback; }
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function renderPages(leads: RepoLead[], runs: Array<Record<string, unknown>>) {
  const links = `<nav><a href="dashboard.html">Run status</a> · <a href="stores.html">Stores</a> · <a href="contact-review.html">Contact review</a> · <a href="leads.csv" download>Download CSV</a> · <a href="leads.json" download>Download JSON</a></nav>`;
  const reportLeads = leads.map(lead => lead.contactEmail && !isUsableEmail(lead.contactEmail) ? { ...lead, contactEmail: undefined, publicContactRoute: lead.publicContactRoute?.startsWith("mailto:") ? undefined : lead.publicContactRoute, contactRouteType: lead.publicContactRoute?.startsWith("mailto:") ? "none" as const : lead.contactRouteType } : lead);
  const rows = reportLeads.map(lead => `<tr><td>${esc(lead.storeName)}</td><td>${esc(lead.niche)}</td><td>${esc(lead.contactEmail ?? "No support email found")}</td><td>${esc(lead.region)}</td><td><a href="${esc(lead.storeUrl)}" target="_blank" rel="noreferrer">${esc(lead.storeUrl)}</a></td><td>${lead.publicContactRoute ? `<a href="${esc(lead.publicContactRoute)}" target="_blank" rel="noreferrer">Open contact route</a>` : "No public route"}</td><td>${esc(lead.contactStatus)}</td></tr>`).join("");
  const table = `<table><thead><tr><th>Store</th><th>Niche</th><th>Support email</th><th>Region</th><th>Store URL</th><th>Contact route</th><th>Status</th></tr></thead><tbody>${rows || "<tr><td colspan=7>No leads yet</td></tr>"}</tbody></table>`;
  const reviewLeads = reportLeads.filter(lead => lead.verificationStatus === "qualified" && lead.contactStatus !== "sent");
  const protectedLeads = reviewLeads.filter(lead => lead.contactFormProtected);
  const readyLeads = reviewLeads.filter(lead => !lead.contactFormProtected && Boolean(lead.publicContactRoute));
  const unavailableLeads = reviewLeads.filter(lead => !lead.publicContactRoute);
  const renderContactCard = (lead: RepoLead) => `<article class="review-card" data-host="${esc(lead.normalizedHost)}"><h2>${esc(lead.storeName)}</h2><p><strong>Niche:</strong> ${esc(lead.niche)} · <strong>Region:</strong> ${esc(lead.region)}</p><p><strong>Store:</strong> <a href="${esc(lead.storeUrl)}" target="_blank" rel="noreferrer">${esc(lead.storeUrl)}</a></p><p><strong>Route:</strong> ${esc(lead.contactRouteType ?? (lead.contactEmail ? "email" : "contact form"))} · <strong>Status:</strong> ${esc(lead.contactStatus)}</p><p>${lead.publicContactRoute ? `<a class="send" href="${esc(lead.publicContactRoute)}" target="_blank" rel="noreferrer">Open contact route</a>` : `<span class="unavailable">No public contact route found</span>`} <button class="confirm-send" type="button" onclick="markSentLocally('${esc(lead.normalizedHost)}')">I sent it — remove from queue</button> <a href="https://github.com/alexroles21-spec/store-outreach-ops-worker/actions/workflows/mark-review-sent.yml" target="_blank" rel="noreferrer">Record sent permanently in GitHub</a></p><dl><dt>Sender email</dt><dd>${esc(lead.senderEmail)}</dd><dt>Subject</dt><dd>${esc(lead.subject)}</dd><dt>Message</dt><dd><pre>${esc(lead.body)}</pre></dd></dl></article>`;
  const reviewCards = [...protectedLeads, ...readyLeads].map(renderContactCard).join("");
  const shell = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font:15px system-ui;margin:40px;background:#f7f5ef;color:#263e31}main{max-width:1200px;margin:auto}nav{margin-bottom:24px}nav a{color:#397457}table{width:100%;border-collapse:collapse;background:white}th,td{padding:12px;border-bottom:1px solid #e8e4db;text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#777}button{border:1px solid #397457;background:white;color:#397457;border-radius:8px;padding:9px 12px;cursor:pointer}a{color:#397457}.review-card{background:white;border:1px solid #e8e4db;border-radius:12px;padding:22px;margin:16px 0}.review-card h2{margin-top:0}.send{display:inline-block;background:#397457;color:white;padding:10px 14px;border-radius:8px;text-decoration:none}.confirm-send{margin-left:8px;background:#fff4d6;border-color:#c38a28;color:#714f0b}.unavailable{display:inline-block;color:#8a5a18;background:#fff4d6;padding:10px 14px;border-radius:8px}.review-card dl{display:grid;grid-template-columns:150px 1fr;gap:10px;margin-top:20px}.review-card dt{font-weight:700}.review-card dd{margin:0}.review-card pre{white-space:pre-wrap;background:#f7f5ef;padding:14px;border-radius:8px}</style></head><body><main>${links}<h1>${esc(title)}</h1>${body}</main><script>function hideLocally(host){localStorage.setItem('hidden:'+host,'1');const card=document.querySelector('[data-host="'+CSS.escape(host)+'"]');if(card)card.remove();}function markSentLocally(host){if(confirm('Confirm that you completed the form and sent this message. The card will be removed from this device.')){hideLocally(host);alert('Removed from this review queue. Use “Record sent permanently in GitHub” for durable no-repeat tracking.');}}document.querySelectorAll('[data-host]').forEach(card=>{if(localStorage.getItem('hidden:'+card.dataset.host))card.remove();});</script></body></html>`;
  const csvRows = ["store_name,niche,region,store_url,contact_route,contact_email,contact_status,opted_in,delivery_status,subject,body", ...reportLeads.map(lead => [lead.storeName, lead.niche, lead.region, lead.storeUrl, lead.publicContactRoute, lead.contactEmail, lead.contactStatus, lead.optedIn, lead.deliveryStatus, lead.subject, lead.body].map(csv).join(","))].join("\n");
  writeFileSync(join(DATA_DIR, "leads.csv"), csvRows + "\n");
  writeFileSync(join(DATA_DIR, "dashboard.html"), shell("Store Outreach Operations", `<p>Repository-backed hourly report. Runs recorded: ${runs.length}. Leads tracked: ${leads.length}.</p><h2>Latest runs</h2><pre>${esc(JSON.stringify(runs.slice(-10).reverse(), null, 2))}</pre>`));
  const storesPage = shell("Verified stores", `<p>${leads.length} repository records. Fields are ordered as store name, niche, support email, region, store URL, and contact route. Download CSV/JSON for phone-friendly follow-up.</p>${table}`);
  const contactReviewPage = shell("Contact queue", `<p>${reviewLeads.length} qualified lead(s) in the send queue: ${readyLeads.length} ready routes, ${protectedLeads.length} protected forms, and ${unavailableLeads.length} with no public route found. Every card keeps its personalized subject and message; only cards with a route can be opened for sending.</p><h2>Ready contact routes</h2>${readyLeads.map(renderContactCard).join("") || "<p>No ready contact routes are waiting.</p>"}<h2>Protected forms requiring manual review</h2>${protectedLeads.map(renderContactCard).join("") || "<p>No protected forms are waiting for review.</p>"}<h2>No public route found</h2>${unavailableLeads.map(renderContactCard).join("") || "<p>No unavailable contact records.</p>"}`);
  writeFileSync(join(DATA_DIR, "leads.html"), storesPage);
  writeFileSync(join(DATA_DIR, "stores.html"), storesPage);
  writeFileSync(join(DATA_DIR, "review.html"), contactReviewPage);
  writeFileSync(join(DATA_DIR, "contact-review.html"), contactReviewPage);
}

export function refreshRepositoryReports() {
  const leads = readJson<RepoLead[]>(LEADS_FILE, []);
  const runs = readJson<Array<Record<string, unknown>>>(RUNS_FILE, []);
  renderPages(leads, runs);
}

export function hasCompletedTargetThisUtcHour(runs: Array<Record<string, unknown>>, targetCount: number, now = new Date()) {
  const hourKey = now.toISOString().slice(0, 13);
  return runs.some(run => typeof run.startedAt === "string" && run.startedAt.slice(0, 13) === hourKey && Number(run.qualified ?? 0) >= targetCount);
}

export async function runRepositoryCycle(targetCount = 84, now = new Date()) {
  mkdirSync(DATA_DIR, { recursive: true });
  const optInRegistry = readJson<Record<string, boolean>>(OPT_IN_FILE, {});
  const leads = readJson<RepoLead[]>(LEADS_FILE, []).map(lead => ({
    ...lead,
    optedIn: lead.optedIn === true || optInRegistry[lead.normalizedHost] === true,
  }));
  const runs = readJson<Array<Record<string, unknown>>>(RUNS_FILE, []);
  if (hasCompletedTargetThisUtcHour(runs, targetCount, now)) {
    return { skipped: "already_completed_this_utc_hour" as const, target: targetCount };
  }
  const cursor = readJson<{ page: number }>(CURSOR_FILE, { page: 0 });
  const startedAt = now.toISOString();
  const startPage = Math.max(0, cursor.page);
  const candidateBudget = Math.min(Math.max(targetCount * 6, targetCount), 1000);
  const urls = await collectGeoCandidates(candidateBudget, page => import("../server/outreach").then(module => module.discoverPublicStoreUrls(candidateBudget, startPage + page)));
  // Advance the durable source cursor after every bounded cycle; the lead host set below prevents reuse.
  const nextCursor = { page: startPage + 1, updatedAt: startedAt };
  let qualified = 0; let failures = 0; let protectedForms = 0; let queued = 0;
  for (let cursor = 0; cursor < urls.length && qualified < targetCount; cursor += 8) {
    const results = await Promise.all(urls.slice(cursor, cursor + 8).map(qualifyStore));
    for (const result of results) {
      if (leads.some(lead => lead.normalizedHost === result.normalizedHost)) continue;
      if (result.verificationStatus === "qualified") qualified += 1; else failures += 1;
      if (result.contactFormProtected) protectedForms += 1;
      const contactStatus = result.contactFormProtected ? "review" : result.verificationStatus === "qualified" && result.publicContactRoute ? "queued" : "not_contacted";
      if (contactStatus === "queued") queued += 1;
      const optedIn = optInRegistry[result.normalizedHost] === true;
      leads.push({ id: leads.length + 1, storeName: result.storeName, niche: result.niche, storeUrl: result.storeUrl, normalizedHost: result.normalizedHost, region: result.region, publicContactRoute: result.publicContactRoute, contactEmail: result.contactEmail, contactFormProtected: result.contactFormProtected, protectionReason: result.protectionReason, verificationStatus: result.verificationStatus, verificationEvidence: result.verificationEvidence, responseTimeMs: result.responseTimeMs, contactStatus, optedIn, deliveryStatus: contactStatus === "queued" && optedIn ? "pending" : "skipped", discoveredAt: startedAt, lastVerifiedAt: startedAt, ...personalizeMessage(result.storeName, result.niche, result.storeUrl) });
    }
  }
  let dispatch = { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  const endpoint = process.env.LOCAL_WEBHOOK_ENDPOINT;
  const token = process.env.LOCAL_WEBHOOK_TOKEN;
  const allowedHost = process.env.LOCAL_WEBHOOK_ALLOWED_HOST;
  if (process.env.AUTO_DISPATCH === "true" && endpoint && token && allowedHost && !process.env.WORKER_DRY_RUN?.includes("true")) {
    const config: DispatcherConfig = { endpoint, token, allowedHost, intervalMs: Math.max(43_000, Number(process.env.DISPATCH_INTERVAL_MS ?? 43_000)), maxPerRun: Math.min(84, Number(process.env.DISPATCH_MAX_PER_RUN ?? 84)), timeoutMs: Math.max(1000, Number(process.env.DISPATCH_TIMEOUT_MS ?? 15_000)) };
    dispatch = await dispatchQueuedLeads(leads, config, () => undefined);
  }
  const run = { startedAt, finishedAt: new Date().toISOString(), target: targetCount, candidateBudget, discovered: urls.length, qualified, failures, protectedForms, queued, dispatch, sourcePage: startPage, nextSourcePage: nextCursor.page };
  writeFileSync(CURSOR_FILE, JSON.stringify(nextCursor, null, 2) + "\n");
  writeFileSync(OPT_IN_FILE, JSON.stringify(optInRegistry, null, 2) + "\n");
  runs.push(run);
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2) + "\n");
  writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2) + "\n");
  renderPages(leads, runs);
  return run;
}
