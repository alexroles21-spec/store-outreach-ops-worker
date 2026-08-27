import { refreshRepositoryReports } from "../worker/repository";

refreshRepositoryReports();
console.log(JSON.stringify({ ok: true, refreshed: ["stores.html", "contact-review.html", "leads.csv"] }));
