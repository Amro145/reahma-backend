ALTER TABLE `user` ADD COLUMN `password` text NOT NULL;
ALTER TABLE `students` ADD COLUMN `faculty` text NOT NULL;
ALTER TABLE `students` ADD COLUMN `semester` text NOT NULL;
ALTER TABLE `students` ADD COLUMN `enrollmentDate` integer DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE `students` ALTER COLUMN `whatsapp` DROP NOT NULL;
ALTER TABLE `students` ALTER COLUMN `status` SET DEFAULT 'pending';