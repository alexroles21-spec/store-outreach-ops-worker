ALTER TABLE `leads` ADD `responseTimeMs` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewStatus` enum('unreviewed','reviewed','approved_manual','dismissed') DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `outreach_runs` ADD `idempotencyKey` varchar(120);--> statement-breakpoint
ALTER TABLE `outreach_runs` ADD CONSTRAINT `outreach_runs_idempotencyKey_unique` UNIQUE(`idempotencyKey`);