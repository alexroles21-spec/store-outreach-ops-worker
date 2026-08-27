# Store Outreach Worker

This repository’s primary deliverable is a **GitHub-ready Node worker service** for hourly public e-commerce lead discovery and qualification. It starts immediately, repeats on a configured interval, prevents overlapping cycles, and uses an hourly idempotency key so a retry does not create a duplicate run record.

The worker entrypoint is `worker/index.ts` and the command is `pnpm worker`. The active production path is GitHub Actions with `WORKER_STORAGE=repository`, `WORKER_INTERVAL_MINUTES=60`, `WORKER_TARGET_PER_RUN=84`, `WORKER_DRY_RUN=false`, and `WORKER_ONCE=true`. `worker/CONFIGURATION.md` and `.github/workflows/hourly-lead-worker.yml` define the active contract.

The pipeline uses permitted public sources, checks robots.txt, filters for the requested US, Canada, Europe, and Australia regions, backfills through source pages until the source reports exhaustion or the target is reached, verifies live HTTP responses, records response timing and evidence, extracts store identity and niche signals, prevents duplicate hosts, and classifies CAPTCHA or anti-bot contact forms as review-only. It never attempts to bypass CAPTCHA or similar controls and never fabricates emails or delivery outcomes.

The supplied outreach structure is preserved. Only store name, niche, and store URL variables are personalized, and the promotional link remains `https://ugc-gen-ai.carrd.co`. Public business contact routes are recorded for a later compliant transport; the code does not pretend an email was sent when no real provider is configured.

## Optional monitoring dashboard

The repository also contains an authenticated dashboard for observing the worker’s run records, lead evidence, queue states, review lane, suppression history, and personalization previews. It is a secondary monitoring surface, not the worker itself. The active hourly execution is the repository-backed GitHub Actions job, not the managed platform scheduler or an always-on process.

## GitHub Actions execution

GitHub stores and versions this code and GitHub Actions is the active hourly runtime. Each job runs one bounded cycle, writes repository-backed JSON and HTML reports under `data/`, and commits them back to the private repository. The earlier persistent cloud and database-backed worker paths remain optional code paths only; they are not active in this deployment.

## Validation

The codebase passes `pnpm check`, `pnpm test`, and `pnpm build`. The worker entrypoint was smoke-tested directly with `WORKER_DRY_RUN=true`; the full Vitest suite covers normalization, deduplication, CAPTCHA classification, qualified/failed/inactive verification, response timing, message URL interpolation, task-window idempotency, and worker overlap protection.

## Safety and production prerequisites

Use only public business contact routes permitted by their site terms and applicable commercial-communication rules. Maintain suppression history and respect opt-out requests. Add outbound provider credentials only as managed server secrets after sender-domain authentication and provider quota approval. Never commit secrets to GitHub or expose them in client code.

## GitHub-only hourly report mode

The repository also supports a GitHub Actions execution mode. The hourly workflow runs one bounded cycle, writes `data/leads.json`, `data/runs.json`, `data/dashboard.html`, and `data/leads.html`, and commits those reports back to the private repository. This mode uses `WORKER_STORAGE=repository` and does not require the unreachable Manus database secret. Manual dispatch supports a target up to 84 and a dry-run switch.

The generated reports are the GitHub-centered monitoring surface. Protected forms remain in review with a prepared sender, subject, body, and route; CAPTCHA is never bypassed. Direct email transport is not configured by the repository worker, and the current form sender identity is `Alex.roles21@gmail.com`.

## Optional guarded webhook dispatcher

The repository includes an optional sequential dispatcher for an explicitly authorized local webhook. It is disabled unless `AUTO_DISPATCH=true` and all three repository secrets `LOCAL_WEBHOOK_ENDPOINT`, `LOCAL_WEBHOOK_TOKEN`, and `LOCAL_WEBHOOK_ALLOWED_HOST` are present. The dispatcher sends only records with `opted_in: true`, `contactStatus: "queued"`, `contactFormProtected: false`, and no prior `deliveryStatus: "sent"`. It uses a minimum 43-second interval, records delivery status, and never sends to discovered store contact-form URLs. The opt-in source of truth is `data/opt-in-registry.json`, keyed by normalized host with boolean `true` values; unknown leads remain ineligible. A CAPTCHA review card links to the contact form and to the `Mark review lead sent` GitHub Actions workflow. After the operator submits the form, they can dispatch that workflow with the normalized host; it commits `sent` state to `data/leads.json`, so the next generated report removes it from the active review queue. `Hide locally` only affects the current browser. A GitHub-hosted runner cannot reach `localhost` on a personal computer; use a self-hosted runner on the authorized machine or an authenticated staging endpoint you control.
