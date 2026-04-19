-- ==============================================================================
-- RAHMA Enterprise Seed Data
-- User ID: SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY (Amro Altayeb)
-- Description: Comprehensive test data for Multi-Admin, Subscriptions, and Audits
-- ==============================================================================

DELETE FROM studentSubscriptions;
DELETE FROM auditLogs;
DELETE FROM financeLogs;
DELETE FROM students;
DELETE FROM member;
DELETE FROM organization;
-- ---------------------------------------------------------
-- 1. Organizations (المؤسسات)
-- إنشاء مؤسستين لاختبار عزل البيانات (Tenant Isolation)
-- ---------------------------------------------------------
INSERT INTO organization (id, name, slug, metadata, createdAt) VALUES 
('org_hq_001', 'مؤسسة رحمة - المركز الرئيسي', 'rahma-hq', '{"region":"الخرطوم", "type":"main"}', 1704067200000),
('org_branch_002', 'مؤسسة رحمة - فرع الجزيرة', 'rahma-jezira', '{"region":"ود مدني", "type":"branch"}', 1704067200000);

-- ---------------------------------------------------------
-- 2. Memberships (صلاحياتك في النظام)
-- أنت Owner في المركز الرئيسي، و Admin في الفرع
-- ---------------------------------------------------------
INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES 
('mem_hq_owner', 'org_hq_001', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'owner', 1704067200000),
('mem_br_admin', 'org_branch_002', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'admin', 1706745600000);

-- ---------------------------------------------------------
-- 3. Students (الطلاب)
-- طلاب المركز الرئيسي (org_hq_001)
-- ---------------------------------------------------------
INSERT INTO students (id, organizationId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt) VALUES 
(1, 'org_hq_001', 'أحمد محمد عبدالله', '+249912345678', 5000.0, 'pending', 1704067200000, 1704067200000), -- طالب قديم
(2, 'org_hq_001', 'فاطمة حسن علي', '+249112233445', 6000.0, 'pending', 1704067200000, 1704067200000), -- طالبة منتظمة
(3, 'org_hq_001', 'عمر طارق عبدالرحمن', '+249123123123', 5000.0, 'pending', 1709251200000, 1709251200000); -- طالب جديد (مسجل في شهر 3)

-- طلاب الفرع (org_branch_002) - لا يجب أن يظهروا لك وأنت في المركز الرئيسي!
INSERT INTO students (id, organizationId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt) VALUES 
(4, 'org_branch_002', 'سارة كمال عثمان', '+249998877665', 4500.0, 'pending', 1704067200000, 1704067200000),
(5, 'org_branch_002', 'ياسين محمود إبراهيم', '+249115599773', 4500.0, 'pending', 1706745600000, 1706745600000);

-- ---------------------------------------------------------
-- 4. Subscriptions (الاشتراكات الشهرية لعام 2026)
-- ---------------------------------------------------------
-- الطالب 1 (أحمد): سدد شهر 1 و 2، وعليه متأخرات شهر 3 و 4 (حالة ممتازة لاختبار الـ UI الأحمر)
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(1, 5000.0, 'paid', 1, 2026, 1704153600000),
(1, 5000.0, 'paid', 2, 2026, 1706745600000);

-- الطالب 2 (فاطمة): طالبة مثالية، سددت شهور 1, 2, 3, 4 (حالة لاختبار الـ UI الأخضر بالكامل)
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(2, 6000.0, 'paid', 1, 2026, 1704500000000),
(2, 6000.0, 'paid', 2, 2026, 1707000000000),
(2, 6000.0, 'paid', 3, 2026, 1709500000000),
(2, 6000.0, 'paid', 4, 2026, 1712000000000);

-- الطالب 3 (عمر): سجل في شهر 3، دفع شهر 3 فقط، ومتبقي عليه شهر 4
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(3, 5000.0, 'paid', 3, 2026, 1709251200000);

-- الطالب 4 (سارة - فرع): سددت شهر 1 فقط
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(4, 4500.0, 'paid', 1, 2026, 1704153600000);

-- ---------------------------------------------------------
-- 5. Finance Logs (السجلات المالية والمصروفات)
-- لبناء رسوم بيانية (Dashboards) واقعية
-- ---------------------------------------------------------
INSERT INTO financeLogs (organizationId, type, amount, category, description, createdAt) VALUES 
-- إيرادات المركز الرئيسي
('org_hq_001', 'income', 11000.0, 'رسوم دراسية', 'تحصيل رسوم شهر يناير (أحمد وفاطمة)', 1704500000000),
('org_hq_001', 'income', 11000.0, 'رسوم دراسية', 'تحصيل رسوم شهر فبراير (أحمد وفاطمة)', 1707000000000),
('org_hq_001', 'income', 11000.0, 'رسوم دراسية', 'تحصيل رسوم شهر مارس (فاطمة وعمر)', 1709500000000),
-- منصرفات المركز الرئيسي
('org_hq_001', 'expense', 1500.0, 'فواتير', 'فاتورة كهرباء وإنترنت المركز', 1705000000000),
('org_hq_001', 'expense', 3000.0, 'صيانة', 'صيانة مكيفات القاعة أ', 1708000000000),
('org_hq_001', 'expense', 500.0, 'نثريات', 'أدوات نظافة وضيافة', 1710000000000),
-- حركات الفرع
('org_branch_002', 'income', 4500.0, 'رسوم دراسية', 'رسوم سارة شهر يناير', 1704153600000),
('org_branch_002', 'expense', 1000.0, 'إيجار', 'إيجار مقر الفرع', 1705153600000);

-- ---------------------------------------------------------
-- 6. Audit Logs (سجلات التدقيق والمراقبة)
-- لتتبع من فعل ماذا ومتى!
-- ---------------------------------------------------------
INSERT INTO auditLogs (organizationId, userId, action, details, createdAt) VALUES 
('org_hq_001', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'CREATE_STUDENT', '{"studentId": 1, "name": "أحمد محمد عبدالله"}', 1704067200000),
('org_hq_001', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'PAYMENT_RECEIVED', '{"studentId": 2, "month": 1, "amount": 6000}', 1704500000000),
('org_hq_001', 'SzyMzs04J5Eb0uVxTUyvyvwFCLu3DqqY', 'UPDATE_STUDENT', '{"studentId": 1, "field": "whatsapp", "old": "null", "new": "+249912345678"}', 1706000000000);