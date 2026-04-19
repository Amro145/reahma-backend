-- Modern Seed Data for RAHMA Project
-- User: Amro Altayeb (SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY)

-- 1. إنشاء المؤسسة (Organization)
INSERT INTO organization (id, name, slug, createdAt) 
VALUES ('org_rahma_main', 'مؤسسة رحمة التعليمية', 'rahma-edu', 1713456000000);

-- 2. ربط حسابك كمدير (Owner) للمؤسسة
INSERT INTO member (id, organizationId, userId, role, createdAt)
VALUES ('mem_admin_01', 'org_rahma_main', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'owner', 1713456000000);

-- 3. إضافة طلاب تجريبيين
-- طالب منتظم (أحمد)
INSERT INTO students (id, organizationId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt)
VALUES (1, 'org_rahma_main', 'أحمد محمد علي', '249123456789', 5000.0, 'pending', 1704067200000, 1704067200000);

-- طالب جديد (سارة)
INSERT INTO students (id, organizationId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt)
VALUES (2, 'org_rahma_main', 'سارة محمود حسن', '249987654321', 4500.0, 'pending', 1709251200000, 1709251200000);

-- 4. إضافة اشتراكات شهرية (Student Subscriptions)
-- أحمد دفع شهور 1، 2، 3 لعام 2026
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(1, 5000.0, 'paid', 1, 2026, 1704153600000),
(1, 5000.0, 'paid', 2, 2026, 1706745600000),
(1, 5000.0, 'paid', 3, 2026, 1709251200000);

-- سارة دفعت شهر 3 فقط (وعليها متأخرات لو كان الشهر الحالي هو 4)
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(2, 4500.0, 'paid', 3, 2026, 1709251200000);

-- 5. سجلات مالية عامة (Finance Logs)
INSERT INTO financeLogs (organizationId, type, amount, category, description, createdAt) VALUES 
('org_rahma_main', 'income', 15000.0, 'مصروفات دراسية', 'دفعات شهر يناير وفبراير ومارس - الطالب أحمد', 1709251200000),
('org_rahma_main', 'expense', 2000.0, 'أدوات مكتبية', 'شراء أقلام وورق للطباعة', 1710547200000),
('org_rahma_main', 'income', 4500.0, 'مصروفات دراسية', 'قسط شهر مارس - الطالبة سارة', 1711843200000);