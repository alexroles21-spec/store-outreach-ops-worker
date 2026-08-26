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

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, "utf8")) as T; } catch { return fallback; }
}

function esc(value: unknown) { return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char)); }

function renderPages(leads: RepoLead[], runs: Array<Record<string, unknown>>) {
  const rows = leads.map(lead => `<tr><td>${esc(lead.storeName)}</td><td>${esc(lead.niche)}</td><td>${esc(lead.region)}</td><td><a href="${esc(lead.storeUrl)}">Store</a></td><td>${esc(lead.publicContactRoute ?? "No public route")}</td><td>${esc(lead.contactStatus)}</td></tr>`).join("");
  const table = `<table><thead><tr><th>Store</th><th>Niche</th><th>Region</th><th>URL</th><th>Contact route</th><th>Status</th></tr></thead><tbody>${rows || "<tr><td colspan=6>No leads yet</td></tr>"}</tbody></table>`;
  const shell = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px system-ui;margin:40px;background:#f7f5ef;color:#263e31}main{max-width:1200px;margin:auto}table{width:100%;border-collapse:collapse;background:white}th,td{padding:12px;border-bottom:1px solid #e8e4db;text-align:left}th{font-size:12px;text-transform:uppercase;color:#777}a{color:#397457}</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
  writeFileSync(join(DATA_DIR, "dashboard.html"), shell("Store Outreach Operations", `<p>Repository-backed hourly report. Runs recorded: ${runs.length}. Leads tracked: ${leads.length}.</p><h2>Latest runs</h2><pre>${esc(JSON.stringify(runs.slice(-10).reverse(), null, 2))}</pre>`));
  writeFileSync(join(DATA_DIR, "leads.html"), shell("Lead directory", `<p>Protected forms are marked review; no CAPTCHA is bypassed.</p>${table}`));
}

export async function runRepositoryCycle(targetCount = 84) {
  mkdirSync(DATA_DIR, { recursive: true });
  const leads = readJson<RepoLead[]>(LEADS_FILE, []);
  const runs = readJson<Array<Record<string, unknown>>>(RUNS_FILE, []);
  const startedAt = new Date().toISOString();
  const urls = await collectGeoCandidates(targetCount, page => import("../server/outreach").then(module => module.discoverPublicStoreUrls(targetCount, page)));
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
  const run = { startedAt, finishedAt: new Date().toISOString(), target: targetCount, discovered: urls.length, qualified, failures, protectedForms, queued };
  runs.push(run);
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2) + "\n");
  writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2) + "\n");
  renderPages(leads, runs);
  return run;
}
