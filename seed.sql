-- ==============================================================================
-- RAHMA Seed Data - New Schema with User Login
-- Login: amroaltayeb14@gmail.com / amro123#$
-- ==============================================================================

DELETE FROM studentSubscriptions;
DELETE FROM auditLogs;
DELETE FROM financeLogs;
DELETE FROM students;
DELETE FROM user;

-- ============================================================
-- 1. Admin/User (can login with amro123#$)
-- Password hash: PBKDF2 with SHA-256
-- ============================================================
INSERT INTO user (id, name, email, emailVerified, password, role, createdAt, updatedAt) VALUES 
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'Amro Altayeb', 'amroaltayeb14@gmail.com', 1, '37abb3a3c87ef03ac4130eab6b6c8cf0:a861db28d865e64bbd300fbddaf772b8369710f1e87e9c9382b9532edaba0695', 'admin', 1700000000000, 1700000000000);

-- ============================================================
-- 2. Additional Users (students)
-- ============================================================
INSERT INTO user (id, name, email, emailVerified, password, role, createdAt, updatedAt) VALUES 
('user_002', 'فاطمة حسن', 'fatma@test.com', 1, '37abb3a3c87ef03ac4130eab6b6c8cf0:a861db28d865e64bbd300fbddaf772b8369710f1e87e9c9382b9532edaba0695', 'student', 1701388800000, 1701388800000),
('user_003', 'عمر طارق', 'omar@test.com', 1, '37abb3a3c87ef03ac4130eab6b6c8cf0:a861db28d865e64bbd300fbddaf772b8369710f1e87e9c9382b9532edaba0695', 'student', 1704067200000, 1704067200000),
('user_004', 'سارة كامل', 'sara@test.com', 1, '37abb3a3c87ef03ac4130eab6b6c8cf0:a861db28d865e64bbd300fbddaf772b8369710f1e87e9c9382b9532edaba0695', 'student', 1706745600000, 1706745600000),
('user_005', 'محمد علي', 'mohamed@test.com', 1, '37abb3a3c87ef03ac4130eab6b6c8cf0:a861db28d865e64bbd300fbddaf772b8369710f1e87e9c9382b9532edaba0695', 'student', 1706745600000, 1706745600000);

-- ============================================================
-- 3. Students
-- ============================================================
INSERT INTO students (userId, name, whatsapp, requiredAmount, status, faculty, semester, enrollmentDate, createdAt) VALUES 
('user_002', 'فاطمة حسن', '+249912345672', 6000.00, 'paid', 'medicine', '1', 1701388800000, 1701388800000),
('user_003', 'عمر طارق', '+249912345673', 5500.00, 'paid', 'dentistry', '2', 1704067200000, 1704067200000),
('user_004', 'سارة كامل', '+249912345674', 4500.00, 'paid', 'engineering', '3', 1706745600000, 1706745600000),
('user_005', 'محمد علي', '+249912345675', 7000.00, 'paid', 'medicine', '4', 1706745600000, 1706745600000);

-- ============================================================
-- 4. Student Subscriptions
-- ============================================================
INSERT INTO studentSubscriptions (studentId, monthIndex, academicYear, amount, status, createdAt) VALUES 
(1, 1, 2026, 6000.00, 'paid', 1701388800000), (1, 2, 2026, 6000.00, 'paid', 1704067200000),
(1, 3, 2026, 6000.00, 'paid', 1706745600000), (1, 4, 2026, 6000.00, 'paid', 1709251200000),
(1, 5, 2026, 6000.00, 'paid', 1711929600000), (1, 6, 2026, 6000.00, 'paid', 1714444800000),
(2, 3, 2026, 5500.00, 'paid', 1706745600000), (2, 4, 2026, 5500.00, 'paid', 1709251200000),
(3, 5, 2026, 4500.00, 'paid', 1711929600000), (3, 6, 2026, 4500.00, 'paid', 1714444800000),
(4, 1, 2026, 7000.00, 'paid', 1701388800000), (4, 2, 2026, 7000.00, 'paid', 1704067200000);

-- ============================================================
-- 5. Finance Logs
-- ============================================================
INSERT INTO financeLogs (type, amount, category, description, createdAt) VALUES 
('income', 33000.00, 'رسوم دراسية', 'تحصيل شهر يناير', 1701388800000),
('income', 15000.00, 'تبرعات', 'تبرعات يناير', 1702000000000),
('expense', 2000.00, 'فواتير', 'فاتورة كهرباء', 1702500000000),
('income', 38000.00, 'رسوم دراسية', 'تحصيل شهر فبراير', 1704067200000),
('expense', 3500.00, 'صيانة', 'صيانة', 1705000000000),
('income', 45000.00, 'رسوم دراسية', 'تحصيل شهر مارس', 1706745600000),
('income', 8000.00, 'تبرعات', 'صدقة جار', 1707000000000),
('expense', 1500.00, 'فواتير', 'فاتورة مياه', 1707500000000),
('income', 52000.00, 'رسوم دراسية', 'تحصيل شهر أبريل', 1709251200000),
('expense', 2500.00, 'صيانة', 'إصلاح أجهزة', 1710000000000);

-- ============================================================
-- 6. Audit Logs
-- ============================================================
INSERT INTO auditLogs (userId, action, details, createdAt) VALUES 
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'CREATE_STUDENT', '{"studentId": 1, "name": "فاطمة حسن"}', 1701388800000),
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'CREATE_STUDENT', '{"studentId": 2, "name": "عمر طارق"}', 1704067200000),
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'CREATE_STUDENT', '{"studentId": 3, "name": "سارة كامل"}', 1706745600000),
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'PAYMENT_RECEIVED', '{"studentId": 1, "month": 1, "amount": 6000}', 1701388800000),
('5lYrbrDx7dp5oY6rP8zvXtNWDqZVUPIk', 'PAYMENT_RECEIVED', '{"studentId": 2, "month": 3, "amount": 5500}', 1706745600000);

-- ============================================================
-- Login credentials:
-- Email: amroaltayeb14@gmail.com
-- Password: amro123#$
-- ============================================================