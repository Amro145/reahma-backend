PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` text NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`whatsapp` text,
	`requiredAmount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`enrollmentDate` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_students`("id", "organizationId", "userId", "name", "whatsapp", "requiredAmount", "status", "enrollmentDate", "createdAt") SELECT "id", "organizationId", 'placeholder_' || "id", "name", "whatsapp", "requiredAmount", "status", "enrollmentDate", "createdAt" FROM `students`;--> statement-breakpoint
DROP TABLE `students`;--> statement-breakpoint
ALTER TABLE `__new_students` RENAME TO `students`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `students_userId_unique` ON `students` (`userId`);