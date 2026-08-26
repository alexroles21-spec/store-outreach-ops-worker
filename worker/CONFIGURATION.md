# Worker configuration

The persistent cloud runtime must provide `DATABASE_URL` as a server-side secret. Set `WORKER_INTERVAL_MINUTES=60`, `WORKER_TARGET_PER_RUN=84`, and `WORKER_DRY_RUN=false` for normal operation. Use `WORKER_DRY_RUN=true` only for startup smoke checks; it starts the process without making discovery requests.

The process command is `pnpm worker`. Configure the cloud service to use Node 22, restart the process on failure, and keep one worker instance running. GitHub stores the repository; it does not provide the always-on runtime itself.
