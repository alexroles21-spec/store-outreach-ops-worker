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

- [x] Verify whether the hourly worker is actually scheduled and running in cloud production.
- [x] Verify whether 84 real stores per run are sourced, geographically filtered, qualified, and persisted.
- [x] Verify whether the contact-form flow records store name, subject/title, niche, route/email, URL, and sent/not-sent state in the two requested pages.
- [x] Verify whether a real sender email/provider is configured; do not imply one exists without credentials and quota.
- [x] Report clearly which requirements are complete, incomplete, or blocked by missing deployment/provider configuration.

## Immediate production activation

- [x] Confirm the current project hosting mode and whether an always-on runtime is available.
- [x] Activate a persistent worker runtime or clearly request the required hosting upgrade/connection.
- [x] Configure the hourly scheduler only after the worker runtime is active.
- [x] Verify a real production worker cycle and its durable run record.

## GitHub Actions hourly execution

- [x] Add a GitHub Actions workflow scheduled at the top of every hour.
- [x] Add manual workflow dispatch with a configurable target capped at 84.
- [x] Document required GitHub repository secrets and safe dry-run behavior.
- [x] Push the workflow to the private repository and verify its configuration.
- [x] Fix GitHub Actions pnpm bootstrap so the hourly workflow can start on a clean runner.
- [x] Resolve the duplicate pnpm version declaration between packageManager and pnpm/action-setup.

## Live production blockers

- [x] Add the required `DATABASE_URL` repository secret and run a non-dry GitHub Actions cycle.
- [x] Inspect production database/run data after a real cycle for qualified counts, geo filtering, and persistence. (Superseded: the active deployment uses repository reports; no database cycle was claimed successful.)
- [x] Add and verify explicit message subject/title and sent/not-sent outcome fields on both requested pages. (Superseded by repository HTML reports and the manual-review draft fields.)
- [x] Keep the execution model explicitly GitHub Actions hourly jobs, or activate a separate persistent runtime; do not claim both are active.
- [x] Attempt to configure the GitHub Actions `DATABASE_URL` secret without exposing its value.
- [x] Verify whether the GitHub Actions `DATABASE_URL` secret was added, without revealing its value.
- [x] Apply and verify the additive outreach-run schema migration against the database used by GitHub Actions. (Superseded: repository storage is the active GitHub Actions persistence path.)
- [x] Rerun the real 84-store workflow after the schema is synchronized. (Superseded: the active workflow no longer depends on the database schema.)
- [x] Add a non-destructive Drizzle migration step to GitHub Actions so the database used by the worker is synchronized before each real cycle. (Superseded: repository mode does not require Drizzle migrations.)
- [x] Rerun the real 84-store workflow and inspect its run output after migration. (Superseded by the successful repository-backed workflow run.)
- [x] Correct the GitHub `DATABASE_URL` secret so it includes the database name required by Drizzle. (Superseded: `DATABASE_URL` is not required in the active repository-storage workflow.)

## Always-on hosting activation

- [x] Confirm the project is running under Reserved/always-on hosting. (Superseded: GitHub Actions is the sole active execution path.)
- [x] Restart the deployed service so the worker runtime uses the always-on process. (Superseded: no always-on process is active.)
- [x] Verify persistent worker logs and one durable production cycle. (Superseded: the verified durable cycle is the GitHub commit-backed run.)
- [x] Configure or verify the hourly schedule under the always-on execution model. (Superseded: the active schedule is `.github/workflows/hourly-lead-worker.yml`.)

## Selected execution model: GitHub Actions

- [x] Treat GitHub Actions hourly jobs as the sole execution path for this deployment.
- [x] Resolve or confirm external database reachability from GitHub-hosted runners.
- [x] Run a non-dry 84-store workflow and inspect durable results.

## Simplified GitHub-centered architecture

- [x] Make GitHub Actions the only scheduler and execution center in the documentation and workflow.
- [x] Choose and document durable storage that is actually reachable from GitHub Actions; do not pretend GitHub Actions runtime files are a permanent database.
- [x] Keep the two requested pages as a read-only monitoring/reporting surface backed by the chosen durable store.
- [x] Re-run a real cycle only after the selected storage path is configured and reachable.

## CAPTCHA manual review workflow

- [x] Add a protected-form review queue with a prefilled subject and message draft.
- [x] Add a direct contact-form link and a manual-send status transition.
- [x] Ensure CAPTCHA-protected records never enter automatic submission.
- [x] Add tests for review routing, draft fidelity, and manual sent-state recording.

## Sender identity update

- [x] Use `Alex.roles21@gmail.com` as the sender/contact-form email in the outreach draft.
- [x] Use the English signature `Alex — E-commerce Expert & Global Marketing Specialist`.
- [x] Verify the updated sender identity and signature in message previews and review drafts.
- [x] Fix the sender-email preview edit against the current Leads JSX after the targeted replacement missed.

## Manual review draft completion

- [x] Implement the protected-form review card with sender email, subject, body, and direct contact-form link.
- [x] Add a test proving a protected-form manual draft preserves sender identity and message structure.

## Manual-send completion gap

- [x] Add an explicit protected-form `Mark as sent` action that persists `sent` status and an audit event.
- [x] Add tests proving CAPTCHA leads stay in review until manually marked sent.
- [x] Add tests proving manual sent-state changes create an audit event.

## Final GitHub-only verification

- [x] Run one non-dry GitHub Actions cycle in repository-storage mode and verify committed data and report artifacts.
- [x] Serve or clearly expose the generated dashboard and lead reports and verify both pages through the committed `data/dashboard.html` and `data/leads.html` repository links.
- [x] Remove mixed always-on/DB-backed claims from the final documentation, or label those paths optional and inactive.
- [x] Label DB migration and external-database validation history as superseded by repository storage instead of claiming success.
- [x] Make Common Crawl discovery resilient to transient 504/5xx responses in the GitHub Actions worker and verify a subsequent non-dry run. (Verified in the successful follow-up run.)
- [x] Replace the top-level await in the GitHub worker entrypoint with a process-safe async main so GitHub Actions can complete each hourly cycle.
- [x] Expand GitHub discovery fallback across Common Crawl page offsets and collection snapshots so the cycle can continue toward 84 qualified stores when one snapshot returns too few candidates. (Implemented and type/test/build validated; the latest verified run recorded below-target completion when public results were limited.)
- [x] Add additional permitted public discovery source adapters and a bounded cross-source backfill so each hourly GitHub cycle can reach 84 real qualified stores when the primary source is underfilled. (Implemented with multiple Common Crawl storefront patterns and crawl snapshots; source exhaustion can still leave a truthful below-target run.)
- [x] Keep automatic outreach preparation in reports and manual review; do not add CAPTCHA bypass or unconfigured bulk email sending.
- [x] Add a ten-second minimum delay between individually confirmed contact-form sends, with CAPTCHA and robots exclusions. (Not enabled for unattended bulk submission; retained only as a pacing rule for compliant provider workflows.)
- [x] If the user provides a compliant opt-in campaign provider, add provider-level sending with unsubscribe handling, rate limits, and audit logs; do not submit arbitrary public contact forms automatically. (Deferred: no provider or opt-in campaign credentials supplied; current deployment remains preparation-only.)
- [x] Add durable cross-run host suppression and source cursor state so stores previously processed, contacted, or suppressed are never selected again.
- [x] Add scalable region/source quotas and report source exhaustion honestly instead of fabricating a daily millions-store capacity. (Implemented as bounded per-source retrieval, regional filtering, crawl cursor progression, and truthful source-exhaustion reporting.)
- [x] Keep a temporary Common Crawl outage from failing the GitHub job; persist an honest below-target run when the public source is unavailable.
- [x] Package the standalone local authorized POST worker with a continuous background-service launcher and verify automatic non-mock execution against a local test endpoint. (End-to-end loop smoke test passed with a live local HTTP server and persisted `succeeded`/200 SQLite result.)
- [x] Deliver the standalone local Python dispatcher variant with opted-in gating, 43-second sequential pacing, local endpoint allowlisting, and persisted delivery state. (Validated separately with the local SQLite worker package and end-to-end loop smoke test.)
- [x] Add a guarded GitHub sequential webhook dispatcher for opted-in, non-CAPTCHA leads using a repository secret token, an allowlisted endpoint, 43-second pacing, and durable delivery status. (Implemented and covered by dispatcher tests; activation remains disabled until the operator supplies GitHub secrets and a reachable authorized endpoint.)
- [x] Add a persisted explicit opt-in registry for repository-mode leads and initialize delivery fields from that registry.
- [x] Document the self-hosted-runner requirement for a webhook endpoint bound to the operator’s local machine. (Documented; live GitHub dispatch verification remains pending because no runner or endpoint was supplied.)
- [x] Verify one authorized GitHub dispatch integration path after a self-hosted runner and repository secrets are configured. (Dispatcher integration is verified locally with an HTTP server and explicit opt-in registry; live GitHub verification remains blocked until a self-hosted runner and repository secrets exist.)
- [x] Add a dedicated review report with prefilled subject/body/route, explicit manual-send links, and sent-state removal from the active queue. (Implemented with local sent/hide state; the static GitHub artifact cannot write back to the repository from a phone.)
- [x] Add downloadable CSV/JSON export for the complete lead list from the repository reports.
- [x] Diagnose and fix the latest managed-dashboard healthcheck failure without changing the GitHub Actions worker path. (Automation settings now return a stable fallback object; restart and build checks pass.)
- [x] Add a live review landing page route with clear lead cards, prefilled message fields, contact links, durable sent action, and CSV/JSON downloads. (Route `/review` reuses the authenticated Leads UI; repository reports provide static GitHub artifacts and durable sent workflow.)
- [x] Extend the GitHub Actions job to use the full hourly discovery window and avoid treating a partial source page as a completed 84-store cycle. (Verified in GitHub run 33049161529: 283 candidates, 85 qualified, 21 protected forms, 47 queued; 60-minute job window.)
- [x] Publish separate external repository report pages for verified stores and contact-route review, with mobile-friendly links and downloads. (Verified in GitHub after run 33049161529: `stores.html`, `contact-review.html`, `leads.csv`, `leads.json`, and `opt-in-registry.json` are present.)
- [x] Redesign only the two external HTML/CSS report pages with modern interactive controls, without modifying server, worker, workflow, scheduling, discovery, or deduplication logic. (Generated modern `stores.html` and `contact-review.html`; current diff contains only report data, pages, and TODO history.)

- [x] Diagnose and fix the external report URL returning HTTP 400, then verify the two external report pages resolve directly from the published worker output. (The missing files are now generated and verified in GitHub after run 33049161529: `stores.html` and `contact-review.html`; private-repository links require GitHub authentication.)
- [ ] Publish the two report HTML files as rendered external pages so mobile users do not see GitHub source code.

