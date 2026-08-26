CREATE TABLE `automation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`targetPerRun` int NOT NULL DEFAULT 84,
	`intervalMinutes` int NOT NULL DEFAULT 60,
	`enabled` boolean NOT NULL DEFAULT true,
	`schedule_cron_task_uid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_settings_ownerId_unique` UNIQUE(`ownerId`),
	CONSTRAINT `automation_settings_schedule_cron_task_uid_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE TABLE `lead_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`runId` int,
	`eventType` varchar(64) NOT NULL,
	`outcome` varchar(64) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`normalizedHost` varchar(255) NOT NULL,
	`storeName` varchar(255) NOT NULL,
	`niche` varchar(128) NOT NULL,
	`storeUrl` varchar(1000) NOT NULL,
	`region` varchar(32) NOT NULL,
	`regionConfidence` varchar(32) NOT NULL,
	`publicContactRoute` varchar(1000),
	`contactRouteType` enum('email','contact_form','none','unknown') NOT NULL DEFAULT 'unknown',
	`contactEmail` varchar(320),
	`contactFormProtected` boolean NOT NULL DEFAULT false,
	`protectionReason` varchar(255),
	`verificationStatus` enum('qualified','inactive','failed','duplicate','pending') NOT NULL DEFAULT 'pending',
	`verificationEvidence` text NOT NULL,
	`contactStatus` enum('not_contacted','queued','review','sent','failed','do_not_contact') NOT NULL DEFAULT 'not_contacted',
	`doNotContact` boolean NOT NULL DEFAULT false,
	`doNotContactReason` varchar(255),
	`doNotContactAt` timestamp,
	`lastVerifiedAt` timestamp,
	`lastContactedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_normalizedHost_unique` UNIQUE(`normalizedHost`)
);
--> statement-breakpoint
CREATE TABLE `outreach_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetCount` int NOT NULL DEFAULT 84,
	`discoveredCount` int NOT NULL DEFAULT 0,
	`qualifiedCount` int NOT NULL DEFAULT 0,
	`verificationFailures` int NOT NULL DEFAULT 0,
	`protectedForms` int NOT NULL DEFAULT 0,
	`queuedOutreach` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outreach_runs_id` PRIMARY KEY(`id`)
);
