-- تعليمات هامة قبل التشغيل:
-- يجب استبدال 'YOUR_USER_ID' بـ المعرف (ID) الخاص بحسابك من جدول 'user'.
-- لمعرفة الـ ID الخاص بك، يمكنك تشغيل الأمر التالي في التيرمنال:
-- npx wrangler d1 execute rahma-db --local --command="SELECT id, name FROM user;"
--
-- بعد تعديل الـ ID، قم بتشغيل هذا الملف لتعبئة البيانات:
-- للبيئة المحلية: npx wrangler d1 execute rahma-db --local --file=seed.sql
-- لبيئة الإنتاج: npx wrangler d1 execute rahma-db --remote --file=seed.sql

-- 1. إضافة بيانات 5 طلاب حقيقيين للجامعات
INSERT INTO students (userId, name, whatsapp, requiredAmount, status, createdAt) VALUES
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'عمر خليل محمد', '+249911223344', 150000, 'pending', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'فاطمة عبدالرحمن الشيخ', '+249123456789', 200000, 'paid', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'أحمد مصطفى يوسف', '+249110022003', 180000, 'pending', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'مريم عثمان خالد', '+249120033004', 120000, 'paid', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'محمد عبدالله حسن', '+249910000000', 300000, 'pending', strftime('%s','now') * 1000);

-- 2. إضافة بيانات المصروفات (Expenses)
INSERT INTO financeLogs (userId, type, amount, category, description, createdAt) VALUES
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 40000, 'مواصلات', 'رسوم ترحيل الطلاب لشهر أكتوبر', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 15000, 'قرطاسية', 'طباعة مذكرات وتصوير أوراق جامعية', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 80000, 'سكن', 'إيجار السكن الطلابي', strftime('%s','now') * 1000);

-- 3. إضافة بيانات الإيرادات والتبرعات (Income)
INSERT INTO financeLogs (userId, type, amount, category, description, createdAt) VALUES
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500000, 'تبرع عام', 'تبرع من فاعل خير بالسعودية', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 100000, 'اشتراك شهري', 'مساهمة مجموعة الواتساب', strftime('%s','now') * 1000),
('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 250000, 'زكاة مال', 'دعم مخصص للرسوم الدراسية', strftime('%s','now') * 1000);
