PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` text NOT NULL,
	`name` text NOT NULL,
	`whatsapp` text,
	`requiredAmount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`enrollmentDate` integer DEFAULT '"2026-04-19T19:14:42.179Z"' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_students`("id", "organizationId", "name", "whatsapp", "requiredAmount", "status", "enrollmentDate", "createdAt") SELECT "id", "organizationId", "name", "whatsapp", "requiredAmount", "status", "enrollmentDate", "createdAt" FROM `students`;--> statement-breakpoint
DROP TABLE `students`;--> statement-breakpoint
ALTER TABLE `__new_students` RENAME TO `students`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `session` ADD `activeOrganizationId` text;