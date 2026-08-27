import { readFileSync, writeFileSync } from "node:fs";

const host = process.argv[2]?.trim().toLowerCase();
if (!host) throw new Error("Usage: node scripts/mark-repo-lead-sent.mjs <normalized-host>");
const file = "data/leads.json";
const leads = JSON.parse(readFileSync(file, "utf8"));
const lead = leads.find(item => item.normalizedHost === host);
if (!lead) throw new Error(`No lead found for normalized host: ${host}`);
if (!lead.publicContactRoute || !["review", "queued"].includes(lead.contactStatus)) throw new Error("Only a pending contact lead with a public route may be marked sent");
lead.contactStatus = "sent";
lead.deliveryStatus = "sent";
lead.manualSentAt = new Date().toISOString();
lead.manualSentBy = "github-actions";
writeFileSync(file, JSON.stringify(leads, null, 2) + "\n");
console.log(JSON.stringify({ host, status: "sent" }));
