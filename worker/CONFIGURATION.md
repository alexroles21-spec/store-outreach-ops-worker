# Worker configuration

GitHub Actions is the primary execution path for this repository. The workflow runs one bounded cycle at the start of every hour, caps the target at 84, writes `data/leads.json`, `data/runs.json`, `data/dashboard.html`, and `data/leads.html`, then commits those reports back to the private repository.

The Actions job uses `WORKER_STORAGE=repository`, `WORKER_INTERVAL_MINUTES=60`, `WORKER_TARGET_PER_RUN=84`, `WORKER_DRY_RUN=false`, and `WORKER_ONCE=true`. A manual run can set `target_per_run` and `dry_run` from the Actions tab. No `DATABASE_URL` secret is required for this GitHub-only report mode.

The repository-backed mode is intentionally transparent: GitHub stores the code and committed reports, while Actions provides the hourly execution. It does not pretend that an Actions runner is a permanent database or a continuously running server.

Protected contact forms are recorded with a review status and a prepared sender, subject, body, and route. CAPTCHA is never bypassed. A human can open the route, complete the protection step, submit the prepared message, and then mark the lead as sent in the private dashboard when that dashboard is connected to its database-backed deployment.

Direct email delivery remains a separate integration. The current template uses `Alex.roles21@gmail.com` as the form sender identity, but a direct SMTP or email-provider quota is not configured by this worker.
