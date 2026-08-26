import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectGeoCandidates, qualifyStore, personalizeMessage } from "../server/outreach";

type RepoLead = ReturnType<typeof personalizeMessage> & {
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
  discoveredAt: string;
  lastVerifiedAt: string;
};

const DATA_DIR = join(process.cwd(), "data");
const LEADS_FILE = join(DATA_DIR, "leads.json");
const RUNS_FILE = join(DATA_DIR, "runs.json");
const CURSOR_FILE = join(DATA_DIR, "source-cursor.json");

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, "utf8")) as T; } catch { return fallback; }
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function renderPages(leads: RepoLead[], runs: Array<Record<string, unknown>>) {
  const links = `<nav><a href="dashboard.html">Run status</a> · <a href="leads.html">All leads</a> · <a href="review.html">CAPTCHA review</a></nav>`;
  const rows = leads.map(lead => `<tr><td>${esc(lead.storeName)}</td><td>${esc(lead.niche)}</td><td>${esc(lead.region)}</td><td><a href="${esc(lead.storeUrl)}" target="_blank" rel="noreferrer">Store</a></td><td>${lead.publicContactRoute ? `<a href="${esc(lead.publicContactRoute)}" target="_blank" rel="noreferrer">${esc(lead.publicContactRoute)}</a>` : "No public route"}</td><td>${esc(lead.contactStatus)}</td></tr>`).join("");
  const table = `<table><thead><tr><th>Store</th><th>Niche</th><th>Region</th><th>URL</th><th>Contact route</th><th>Status</th></tr></thead><tbody>${rows || "<tr><td colspan=6>No leads yet</td></tr>"}</tbody></table>`;
  const reviewLeads = leads.filter(lead => lead.contactFormProtected && lead.contactStatus === "review");
  const reviewCards = reviewLeads.map(lead => `<article class="review-card"><h2>${esc(lead.storeName)}</h2><p><strong>Niche:</strong> ${esc(lead.niche)} · <strong>Region:</strong> ${esc(lead.region)}</p><p><strong>Store:</strong> <a href="${esc(lead.storeUrl)}" target="_blank" rel="noreferrer">${esc(lead.storeUrl)}</a></p><p><strong>Reason:</strong> ${esc(lead.protectionReason ?? "Protected form")}</p><p><a class="send" href="${esc(lead.publicContactRoute ?? lead.storeUrl)}" target="_blank" rel="noreferrer">Open contact form</a></p><dl><dt>Sender email</dt><dd>${esc(lead.senderEmail)}</dd><dt>Subject</dt><dd>${esc(lead.subject)}</dd><dt>Message</dt><dd><pre>${esc(lead.body)}</pre></dd></dl></article>`).join("");
  const shell = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font:15px system-ui;margin:40px;background:#f7f5ef;color:#263e31}main{max-width:1200px;margin:auto}nav{margin-bottom:24px}nav a{color:#397457}table{width:100%;border-collapse:collapse;background:white}th,td{padding:12px;border-bottom:1px solid #e8e4db;text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#777}a{color:#397457}.review-card{background:white;border:1px solid #e8e4db;border-radius:12px;padding:22px;margin:16px 0}.review-card h2{margin-top:0}.send{display:inline-block;background:#397457;color:white;padding:10px 14px;border-radius:8px;text-decoration:none}.review-card dl{display:grid;grid-template-columns:150px 1fr;gap:10px;margin-top:20px}.review-card dt{font-weight:700}.review-card dd{margin:0}.review-card pre{white-space:pre-wrap;background:#f7f5ef;padding:14px;border-radius:8px}</style></head><body><main>${links}<h1>${esc(title)}</h1>${body}</main></body></html>`;
  writeFileSync(join(DATA_DIR, "dashboard.html"), shell("Store Outreach Operations", `<p>Repository-backed hourly report. Runs recorded: ${runs.length}. Leads tracked: ${leads.length}.</p><h2>Latest runs</h2><pre>${esc(JSON.stringify(runs.slice(-10).reverse(), null, 2))}</pre>`));
  writeFileSync(join(DATA_DIR, "leads.html"), shell("Lead directory", `<p>Protected forms are marked review; no CAPTCHA is bypassed.</p>${table}`));
  writeFileSync(join(DATA_DIR, "review.html"), shell("CAPTCHA manual review", `<p>${reviewLeads.length} protected form(s) require manual review. The contact link opens the store form; verify the site permits contact before sending.</p>${reviewCards || "<p>No protected forms are waiting for review.</p>"}`));
}

export async function runRepositoryCycle(targetCount = 84) {
  mkdirSync(DATA_DIR, { recursive: true });
  const leads = readJson<RepoLead[]>(LEADS_FILE, []);
  const runs = readJson<Array<Record<string, unknown>>>(RUNS_FILE, []);
  const cursor = readJson<{ page: number }>(CURSOR_FILE, { page: 0 });
  const startedAt = new Date().toISOString();
  const startPage = Math.max(0, cursor.page);
  const urls = await collectGeoCandidates(targetCount, page => import("../server/outreach").then(module => module.discoverPublicStoreUrls(targetCount, startPage + page)));
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
      leads.push({ id: leads.length + 1, storeName: result.storeName, niche: result.niche, storeUrl: result.storeUrl, normalizedHost: result.normalizedHost, region: result.region, publicContactRoute: result.publicContactRoute, contactEmail: result.contactEmail, contactFormProtected: result.contactFormProtected, protectionReason: result.protectionReason, verificationStatus: result.verificationStatus, verificationEvidence: result.verificationEvidence, responseTimeMs: result.responseTimeMs, contactStatus, discoveredAt: startedAt, lastVerifiedAt: startedAt, ...personalizeMessage(result.storeName, result.niche, result.storeUrl) });
    }
  }
  const run = { startedAt, finishedAt: new Date().toISOString(), target: targetCount, discovered: urls.length, qualified, failures, protectedForms, queued, sourcePage: startPage, nextSourcePage: nextCursor.page };
  writeFileSync(CURSOR_FILE, JSON.stringify(nextCursor, null, 2) + "\n");
  runs.push(run);
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2) + "\n");
  writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2) + "\n");
  renderPages(leads, runs);
  return run;
}
