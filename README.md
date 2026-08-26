# Outreach OS

Outreach OS is a private authenticated operations dashboard for discovering and qualifying public e-commerce leads. It keeps the workflow evidence-first: each record stores the live verification result, normalized host, public contact route, protection signals, campaign status, and audit events.

## What is implemented

The dashboard has two private routes. **Command center** shows hourly target-versus-qualified metrics, recent cycles, protected-form counts, queued outreach, failures, and the automation state. **Lead directory** provides search and status filtering, a detail pane with verification evidence, a review signal for protected forms, suppression controls, and an exact message preview.

The worker discovers public URLs through the Common Crawl URL index, then performs a live request with a descriptive user agent. It checks robots.txt before research, follows redirects, records HTTP evidence, looks for e-commerce signals, extracts a title and niche, detects public contact routes, and classifies common CAPTCHA or anti-bot markers. Protected forms are written to the review lane; the worker never attempts to bypass them.

The message preview preserves the supplied structure and personalizes only the store name, niche, and store URL variables. It keeps the promotional link `https://ugc-gen-ai.carrd.co`.

## Hourly workflow

The hourly callback is mounted at `/api/scheduled/discoverLeads` and authenticates scheduled requests through the platform SDK. It looks up automation settings by the platform-provided cron task UID, caps each run at 84 targets, updates a durable run record, and is safe to retry at the record level through hostname deduplication. The dashboard includes manual Run now and Enable hourly controls.

The platform scheduler requires the site to be deployed before an hourly task is created. After deployment, sign in as an administrator and use **Enable hourly** once. The schedule uses the six-field UTC expression `0 0 * * * *`.

## Important boundaries

This version does not fabricate stores, emails, ratings, testimonials, or delivery outcomes. It does not use proxy rotation, CAPTCHA bypass, or stealth mechanisms. A lead is queueable only when it has a public route, is live and qualified, is not suppressed, and does not expose a protected contact form. A real outbound transport can be added later through a compliant provider after sender-domain authentication and quota approval; until then the system records a queue state without pretending that a message was sent.

## Development

Run `pnpm check` for TypeScript validation, `pnpm test` for the Vitest suite, and `pnpm build` for the production bundle. Database schema changes are defined in `drizzle/schema.ts`, generated through Drizzle, reviewed, and applied through the managed database migration workflow.

## Production prerequisites

Use an authenticated production deployment and promote the project owner to the administrator role if needed. Configure a real sender domain and a provider only when the provider account has approved quota, authenticated DNS records, and a lawful process for commercial outreach. Keep any provider credentials in managed server secrets; never place them in client code or commit them to GitHub.
