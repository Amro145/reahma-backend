-- 1. تهيئة الجداول الجديدة والمستحدثة (لحل مشكلة فشل Migration 0000)
CREATE TABLE IF NOT EXISTS `studentSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`studentId` integer NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`monthIndex` integer NOT NULL,
	`academicYear` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `studentSubscriptions_studentId_monthIndex_academicYear_unique` ON `studentSubscriptions` (`studentId`,`monthIndex`,`academicYear`);

PRAGMA foreign_keys=OFF;
-- محاولة إضافة العمود بقيمة ثابتة أولاً (لأن SQLite لا يقبل تعبيرات ديناميكية في ALTER TABLE)
ALTER TABLE `students` ADD COLUMN `enrollmentDate` integer DEFAULT 1713456000000 NOT NULL;
PRAGMA foreign_keys=ON;

-- 3. تنظيف البيانات القديمة (اختياري، للبدء من جديد)
-- DELETE FROM studentSubscriptions;
-- DELETE FROM students;

-- 4. إضافة الطلاب مع تواريخ انتساب مختلفة
-- ملاحظة: تأكد من أن الـ userId صحيح (يمكنك العثور عليه من جدول user)
-- المعرف المستخدم هنا هو مثال: 'LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN'

INSERT INTO students (userId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt) VALUES
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'أحمد محمد علي', '+249911223344', 5000, 'pending', (strftime('%s','2026-01-01') * 1000), (strftime('%s','now') * 1000)),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'سارة عبدالرحمن', '+249123456789', 5000, 'pending', (strftime('%s','2026-02-01') * 1000), (strftime('%s','now') * 1000)),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'خالد يوسف', '+249110022003', 4500, 'pending', (strftime('%s','2026-03-01') * 1000), (strftime('%s','now') * 1000));

-- 5. إضافة اشتراكات ومدفوعات تجريبية
-- سنستخدم LAST_INSERT_ROWID() أو المعرفات المتوقعة (1, 2, 3) إذا كانت الجداول فارغة
-- دفعات للطالب الأول (أحمد) - دفع شهري 1 و 2
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
(1, 5000, 'paid', 1, 2026, (strftime('%s','now') * 1000)),
(1, 5000, 'paid', 2, 2026, (strftime('%s','now') * 1000)),
(1, 5000, 'paid', 3, 2026, (strftime('%s','now') * 1000));

-- دفعات للطالب الثاني (سارة) - دفعت شهر 2 فقط
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
(2, 5000, 'paid', 2, 2026, (strftime('%s','now') * 1000));

-- الطالب الثالث (خالد) - لم يدفع شيء بعد (سيظهر باللون الأحمر في التقويم)
