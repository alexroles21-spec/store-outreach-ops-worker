# Project TODO

- [x] Create a private authenticated dashboard shell using the provided DashboardLayout component.
- [x] Add a lead data model containing store name, niche, URL, public contact route or email, verification evidence, contact status, timestamps, and do-not-contact history.
- [x] Add an hourly workflow that requests up to 84 candidate e-commerce stores per run from permitted public sources in the US, Canada, Europe, and Australia.
- [x] Add live-store verification with HTTP status, final URL, response timing, and evidence fields.
- [x] Add Shopify/e-commerce signal detection without claiming that Common Crawl or a storefront API is a universal store directory.
- [x] Add duplicate prevention using normalized hostnames and persistent lead history.
- [x] Add inactive-store filtering and verification-failure logging.
- [x] Add contact-route discovery for public business contact pages and publicly listed business emails only.
- [x] Add CAPTCHA and anti-bot detection for contact forms and route protected forms to review without bypass attempts.
- [x] Add do-not-contact and opt-out suppression history with audit timestamps.
- [x] Preserve the supplied outreach message structure and fill only store name, niche, and store URL variables, including the promotional link https://ugc-gen-ai.carrd.co.
- [x] Add an hourly processing queue with target-versus-qualified counters and idempotent run records.
- [x] Add the private monitoring dashboard for hourly targets, qualified stores, failures, protected forms, queued outreach, and outcomes.
- [x] Add a searchable lead directory for contacted and queued stores with store name, niche, URL, contact route, and campaign status.
- [x] Add an admin-only manual run control and safe review controls for protected forms.
- [x] Add backend procedures and database helpers for dashboard metrics, lead search, run history, and review status.
- [x] Add vitest coverage for personalization, normalization/deduplication, verification classification, CAPTCHA routing, and idempotent run behavior.
- [x] Run type checks, tests, and browser visual verification.
- [x] Document required production email/provider credentials and the deploy-before-schedule prerequisite.
- [x] Fix the accidental trailing schema sentinel that caused a TypeScript error during live reload.
- [x] Fix the accidental trailing helper sentinel that caused a TypeScript error during live reload.
- [x] Fix qualification typing errors for region confidence and do-not-contact handling in the discovery worker.
- [x] Add a reliable title/metadata extractor for qualified store names.
- [x] Fix the scheduled handler import so it calls the discovery worker from its owning module.
- [x] Count every live qualified store separately from the subset that has a queueable contact route.

## Follow-up fixes from validation

- [x] Filter candidates by allowed regions before counting toward the 84-target run and backfill until the target is met.
- [x] Capture and persist response timing in verification evidence.
- [x] Record suppression and opt-out actions as lead audit events with timestamps and reason, and expose the history.
- [x] Interpolate the store URL in the approved message body without changing the supplied structure.
- [x] Add an idempotency key or task-window check so retried hourly callbacks do not create duplicate run records.
- [x] Add protected-form review actions and state transitions for reviewed, approved for manual handling, and dismissed.
- [x] Add Vitest coverage for duplicate-host upsert behavior, verification classifications, and scheduled retry idempotency.
- [x] Expand store-name extraction with og:title and site-name metadata fallbacks.

## Final validation fixes

- [x] Implement iterative candidate backfill until the geo-filtered pool reaches 84 or public sources are exhausted.
- [x] Add mocked tests for duplicate-host upsert behavior and qualified, failed, and inactive classification paths.

## Checkpoint blockers

- [x] Replace the arbitrary discovery-page cap with a source-exhaustion condition while backfilling toward 84 geo-qualified candidates.
- [x] Add a mocked database test proving duplicate-host upsert updates one record instead of creating another.

## Backfill edge-case fix

- [x] Continue pagination through no-progress pages until the source explicitly reports exhaustion or 84 geo-qualified candidates are gathered.
- [x] Test that a no-progress page followed by a valid page continues backfill.

## Strict source-exhaustion correction

- [x] Stop candidate pagination only when the source explicitly reports exhaustion or the 84-target is reached.
- [x] Test that an empty non-exhausted page is followed by a later valid page.

## Corrected deliverable: GitHub-ready worker service

- [x] Make the worker service the primary deliverable instead of presenting the dashboard as the main product.
- [x] Add a standalone worker runtime entrypoint for hourly cloud execution.
- [x] Add a deployment contract for a persistent cloud runtime and environment configuration.
- [x] Add a private GitHub repository export/push for the corrected server code.
- [x] Document clearly that GitHub stores the code while a cloud runtime executes it continuously.
- [x] Validate the worker entrypoint and deployment files independently from the optional dashboard.

## Worker-first delivery corrections

- [x] Restructure the repository documentation and entrypoints so the worker is clearly primary and the dashboard secondary.
- [x] Add a concrete persistent-worker deployment manifest with command and required environment variables.
- [x] Add a direct worker startup smoke test that does not depend on the dashboard build.

## Deployment manifest correction

- [x] Add one concrete persistent service manifest that includes the worker command and required runtime variables together.

## Readiness audit requested by user

- [ ] Verify whether the hourly worker is actually scheduled and running in cloud production.
- [ ] Verify whether 84 real stores per run are sourced, geographically filtered, qualified, and persisted.
- [ ] Verify whether the contact-form flow records store name, subject/title, niche, route/email, URL, and sent/not-sent state in the two requested pages.
- [ ] Verify whether a real sender email/provider is configured; do not imply one exists without credentials and quota.
- [ ] Report clearly which requirements are complete, incomplete, or blocked by missing deployment/provider configuration.

## Immediate production activation

- [ ] Confirm the current project hosting mode and whether an always-on runtime is available.
- [ ] Activate a persistent worker runtime or clearly request the required hosting upgrade/connection.
- [ ] Configure the hourly scheduler only after the worker runtime is active.
- [ ] Verify a real production worker cycle and its durable run record.

## GitHub Actions hourly execution

- [ ] Add a GitHub Actions workflow scheduled at the top of every hour.
- [ ] Add manual workflow dispatch with a configurable target capped at 84.
- [ ] Document required GitHub repository secrets and safe dry-run behavior.
- [ ] Push the workflow to the private repository and verify its configuration.
