PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text,
	`name` text NOT NULL,
	`whatsapp` text,
	`requiredAmount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`faculty` text NOT NULL,
	`semester` text NOT NULL,
	`enrollmentDate` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_students`("id", "userId", "name", "whatsapp", "requiredAmount", "status", "faculty", "semester", "enrollmentDate", "createdAt") SELECT "id", "userId", "name", "whatsapp", "requiredAmount", "status", "faculty", "semester", "enrollmentDate", "createdAt" FROM `students`;--> statement-breakpoint
DROP TABLE `students`;--> statement-breakpoint
ALTER TABLE `__new_students` RENAME TO `students`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `students_userId_unique` ON `students` (`userId`);