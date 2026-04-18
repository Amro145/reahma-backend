CREATE TABLE `studentSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`studentId` integer NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`monthIndex` integer NOT NULL,
	`academicYear` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studentSubscriptions_studentId_monthIndex_academicYear_unique` ON `studentSubscriptions` (`studentId`,`monthIndex`,`academicYear`);--> statement-breakpoint
ALTER TABLE `students` ADD `enrollmentDate` integer DEFAULT '"2026-04-18T16:09:23.336Z"' NOT NULL;