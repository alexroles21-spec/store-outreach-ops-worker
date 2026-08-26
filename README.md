# Store Outreach Worker

This repository’s primary deliverable is a **GitHub-ready Node worker service** for hourly public e-commerce lead discovery and qualification. It starts immediately, repeats on a configured interval, prevents overlapping cycles, and uses an hourly idempotency key so a retry does not create a duplicate run record.

The worker entrypoint is `worker/index.ts` and the command is `pnpm worker`. Configure the persistent cloud runtime with `DATABASE_URL`, `WORKER_INTERVAL_MINUTES=60`, `WORKER_TARGET_PER_RUN=84`, and `WORKER_DRY_RUN=false`. `worker/CONFIGURATION.md` and `Procfile` define the runtime contract. `WORKER_DRY_RUN=true` is available for safe startup checks.

The pipeline uses permitted public sources, checks robots.txt, filters for the requested US, Canada, Europe, and Australia regions, backfills through source pages until the source reports exhaustion or the target is reached, verifies live HTTP responses, records response timing and evidence, extracts store identity and niche signals, prevents duplicate hosts, and classifies CAPTCHA or anti-bot contact forms as review-only. It never attempts to bypass CAPTCHA or similar controls and never fabricates emails or delivery outcomes.

The supplied outreach structure is preserved. Only store name, niche, and store URL variables are personalized, and the promotional link remains `https://ugc-gen-ai.carrd.co`. Public business contact routes are recorded for a later compliant transport; the code does not pretend an email was sent when no real provider is configured.

## Optional monitoring dashboard

The repository also contains an authenticated dashboard for observing the worker’s run records, lead evidence, queue states, review lane, suppression history, and personalization previews. It is a secondary monitoring surface, not the worker itself. The dashboard’s hourly callback is available when using the managed platform scheduler; the standalone `pnpm worker` process is the intended always-running service for a persistent cloud runtime.

## GitHub and runtime distinction

GitHub stores and versions this code. GitHub is not the machine that keeps a Node process alive. Connect this private repository to an always-on Node runtime such as Manus Reserved Hosting or another persistent cloud service, configure automatic restarts, and keep the process command as `pnpm worker`. Do not rely on an autoscaling request-scoped runtime to keep `setInterval` alive.

## Validation

The codebase passes `pnpm check`, `pnpm test`, and `pnpm build`. The worker entrypoint was smoke-tested directly with `WORKER_DRY_RUN=true`; the full Vitest suite covers normalization, deduplication, CAPTCHA classification, qualified/failed/inactive verification, response timing, message URL interpolation, task-window idempotency, and worker overlap protection.

## Safety and production prerequisites

Use only public business contact routes permitted by their site terms and applicable commercial-communication rules. Maintain suppression history and respect opt-out requests. Add outbound provider credentials only as managed server secrets after sender-domain authentication and provider quota approval. Never commit secrets to GitHub or expose them in client code.
