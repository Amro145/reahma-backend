-- ==============================================================================
-- RAHMA Single-Tenant Seed Data
-- Description: Comprehensive test data for Subscriptions, Finance, and Audits
-- Updated: Match new single-tenant schema (no organization/member tables)
-- ==============================================================================

DELETE FROM studentSubscriptions;
DELETE FROM auditLogs;
DELETE FROM financeLogs;
DELETE FROM students;
DELETE FROM user;

-- ---------------------------------------------------------
-- 1. Users (المستخدمون)
-- ---------------------------------------------------------
INSERT INTO user (id, name, email, password, role, createdAt, updatedAt) VALUES 
('user_001', 'الأستاذة أميرة', 'amira@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'admin', 1704067200000, 1704067200000),
('user_002', 'أحمد、大豆', 'ahmed@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1704067200000, 1704067200000),
('user_003', 'فاطمة علي', 'fatma@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1704067200000, 1704067200000),
('user_004', 'عمر طارق', 'omar@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1709251200000, 1709251200000),
('user_005', 'سارة كامل', 'sara@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1710451200000, 1710451200000),
('user_006', 'محمد علي', 'mohamed@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1711351200000, 1711351200000),
('user_007', 'خالد يوسف', 'khaled@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1712221200000, 1712221200000),
('user_008', 'منى أحمد', 'mona@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1713528000000, 1713528000000),
('user_009', 'ياسر محمود', 'yasser@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1714305600000, 1714305600000),
('user_010', 'رانيا محمد', 'rania@example.com', '$2a$10$rQv8Z5vJ7kPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvPLzJYvO', 'student', 1715280000000, 1715280000000);

-- ---------------------------------------------------------
-- 2. Students (الطلاب)
-- ---------------------------------------------------------
INSERT INTO students (id, userId, name, whatsapp, requiredAmount, status, faculty, semester, enrollmentDate, createdAt) VALUES 
(1, 'user_002', 'أحمد、大豆', '+249912345678', 5000.00, 'paid', 'medicine', '4', 1704067200000, 1704067200000),
(2, 'user_003', 'فاطمة علي', '+249112233445', 6000.00, 'paid', 'medicine', '5', 1704067200000, 1704067200000),
(3, 'user_004', 'عمر طارق', '+249123123123', 5500.00, 'pending', 'dentistry', '3', 1709251200000, 1709251200000),
(4, 'user_005', 'سارة كامل', '+249998877665', 4500.00, 'pending', 'engineering', '2', 1710451200000, 1710451200000),
(5, 'user_006', 'محمد علي', '+249115599773', 7000.00, 'paid', 'medicine', '6', 1711351200000, 1711351200000),
(6, 'user_007', 'خالد يوسف', '+249771122334', 5000.00, 'pending', 'medicine', '3', 1712221200000, 1712221200000),
(7, 'user_008', 'منى أحمد', '+249661122334', 6500.00, 'paid', 'dentistry', '4', 1713528000000, 1713528000000),
(8, 'user_009', 'ياسر محمود', '+249551122334', 4800.00, 'pending', 'engineering', '1', 1714305600000, 1714305600000),
(9, 'user_010', 'رانيا محمد', '+249441122334', 5500.00, 'pending', 'medicine', '2', 1715280000000, 1715280000000);

-- ---------------------------------------------------------
-- 3. Student Subscriptions (الاشتراكات الشهرية - Year 2026)
-- ---------------------------------------------------------
--Student 1 (أحمد): Paid months 1-4, owes months 5-6
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(1, 5000.00, 'paid', 1, 2026, 1704153600000),
(1, 5000.00, 'paid', 2, 2026, 1706745600000),
(1, 5000.00, 'paid', 3, 2026, 1709337600000),
(1, 5000.00, 'paid', 4, 2026, 1711929600000);

-- Student 2 (فاطمة): Perfect record, all months paid
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(2, 6000.00, 'paid', 1, 2026, 1704500000000),
(2, 6000.00, 'paid', 2, 2026, 1707000000000),
(2, 6000.00, 'paid', 3, 2026, 1709500000000),
(2, 6000.00, 'paid', 4, 2026, 1712000000000),
(2, 6000.00, 'paid', 5, 2026, 1714500000000),
(2, 6000.00, 'paid', 6, 2026, 1717000000000);

-- Student 3 (عمر): Registered month 3, paid month 3 only
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(3, 5500.00, 'paid', 3, 2026, 1709337600000);

-- Student 4 (سارة): New in month 5, paid month 5
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(4, 4500.00, 'paid', 5, 2026, 1714500000000);

-- Student 5 (محمد): Excellent record
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(5, 7000.00, 'paid', 1, 2026, 1711929600000),
(5, 7000.00, 'paid', 2, 2026, 1714500000000),
(5, 7000.00, 'paid', 3, 2026, 1717000000000);

-- Student 6 (خالد): New in month 4
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(6, 5000.00, 'paid', 4, 2026, 1712000000000);

-- Student 7 (منى): Good record
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES 
(7, 6500.00, 'paid', 1, 2026, 1714000000000),
(7, 6500.00, 'paid', 2, 2026, 1716500000000),
(7, 6500.00, 'paid', 3, 2026, 1719000000000);

-- ---------------------------------------------------------
-- 4. Finance Logs (السجلات المالية)
-- ---------------------------------------------------------
-- Income (إيرادات)
INSERT INTO financeLogs (type, amount, category, description, createdAt) VALUES 
('income', 11000.00, 'رسوم دراسية', 'تحصيل شهر يناير - أحمد وفاطة', 1704500000000),
('income', 11000.00, 'رسوم دراسية', 'تحصيل شهر فبراير', 1707000000000),
('income', 16500.00, 'رسوم دراسية', 'تحصيل شهر مارس - أحمد وفاطة وعمر', 1709500000000),
('income', 11000.00, 'رسوم دراسية', 'تحصيل شهر أبريل', 1712000000000),
('income', 11500.00, 'رسوم دراسية', 'تحصيل شهر مايو', 1714500000000),
('income', 6000.00, 'تبرعات', 'تبرع من أحد المحسنين', 1710000000000),
('income', 3500.00, 'تبرعات', 'صدقة جار', 1713000000000),
('income', 12000.00, 'رسوم دراسية', 'تحصيل شهر يونيو', 1717000000000),
('income', 8000.00, 'رسوم دراسية', 'رسوم تسجيل جدد', 1710451200000);

-- Expenses (مصروفات)
INSERT INTO financeLogs (type, amount, category, description, createdAt) VALUES 
('expense', 1500.00, 'فواتير', 'فاتورة كهرباء شهر يناير', 1705000000000),
('expense', 3000.00, 'صيانة', 'صيانة مكيفات', 1708000000000),
('expense', 500.00, 'نثريات', 'أدوات نظافة', 1710000000000),
('expense', 1200.00, 'فواتير', 'فاتورة إنترنت', 1711500000000),
('expense', 2500.00, 'صيانة', 'إصلاح projector', 1712500000000),
('expense', 800.00, 'قرطاسية', 'أدوات مكتبية', 1714000000000),
('expense', 1000.00, 'transport', 'مواصلات للطلاب', 1716000000000);

-- ---------------------------------------------------------
-- 5. Audit Logs (سجلات التدقيق)
-- ---------------------------------------------------------
INSERT INTO auditLogs (userId, action, details, createdAt) VALUES 
('user_001', 'CREATE_STUDENT', '{"studentId": 1, "name": "أحمد、大豆"}', 1704067200000),
('user_001', 'CREATE_STUDENT', '{"studentId": 2, "name": "فاطمة علي"}', 1704067200000),
('user_001', 'CREATE_STUDENT', '{"studentId": 3, "name": "عمر طارق"}', 1709251200000),
('user_001', 'PAYMENT_RECEIVED', '{"studentId": 1, "month": 1, "amount": 5000}', 1704500000000),
('user_001', 'PAYMENT_RECEIVED', '{"studentId": 2, "month": 1, "amount": 6000}', 1704500000000),
('user_001', 'PAYMENT_RECEIVED', '{"studentId": 1, "month": 2, "amount": 5000}', 1707000000000),
('user_001', 'UPDATE_STUDENT', '{"studentId": 1, "field": "whatsapp"}', 1706000000000),
('user_001', 'CREATE_STUDENT', '{"studentId": 4, "name": "سارة كامل"}', 1710451200000),
('user_001', 'CREATE_STUDENT', '{"studentId": 5, "name": "محمد علي"}', 1711351200000),
('user_001', 'PAYMENT_RECEIVED', '{"studentId": 2, "month": 4, "amount": 6000}', 1712000000000);