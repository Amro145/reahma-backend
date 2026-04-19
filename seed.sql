-- =============================================
-- RAHMA DB — Seed Script
-- User ID: LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN
-- Date: April 2026 (Month 4, Academic Year 2026)
-- =============================================

-- 1. Clear all app data (preserving user/session/account/verification tables)
DELETE FROM studentSubscriptions;
DELETE FROM financeLogs;
DELETE FROM students;

-- Reset auto-increment counters
DELETE FROM sqlite_sequence WHERE name IN ('students', 'studentSubscriptions', 'financeLogs');

-- =============================================
-- 2. STUDENTS (10 students)
-- enrollmentDate stored as Unix timestamp (seconds)
-- Jan 1 2026 = 1735689600
-- =============================================

INSERT INTO students (userId, name, whatsapp, requiredAmount, status, enrollmentDate, createdAt) VALUES
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'أحمد محمد السيد',    '01012345678', 500, 'pending', 1735689600, 1735689600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'فاطمة علي حسن',     '01123456789', 500, 'pending', 1735689600, 1735689600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'محمود إبراهيم عمر', '01234567890', 750, 'pending', 1735689600, 1735689600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'نورا عبد الرحمن',   '01098765432', 500, 'pending', 1738368000, 1738368000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'يوسف خالد مصطفى',  '01187654321', 750, 'pending', 1738368000, 1738368000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'سارة أحمد طه',      '01276543210', 500, 'pending', 1738368000, 1738368000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'عمر حسام الدين',    '01365432109', 600, 'pending', 1740787200, 1740787200),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'ريم عصام محمود',    '01454321098', 600, 'pending', 1740787200, 1740787200),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'كريم سامر عبد الله','01543210987', 500, 'pending', 1743465600, 1743465600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'لمياء وليد ناصر',   '01632109876', 750, 'pending', 1743465600, 1743465600);

-- =============================================
-- 3. STUDENT SUBSCRIPTIONS
-- Students 1-3 enrolled Jan → paid months 1,2,3 (Jan/Feb/Mar)
-- Students 4-6 enrolled Feb → paid months 2,3
-- Students 7-8 enrolled Mar → paid month 3 only
-- Students 9-10 enrolled Apr → no payments yet
-- =============================================

-- Student 1 (أحمد محمد السيد) — 500 EGP/mo — paid Jan, Feb, Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (1, 500, 'paid', 1, 2026, 1736121600),
  (1, 500, 'paid', 2, 2026, 1738800000),
  (1, 500, 'paid', 3, 2026, 1741392000);

-- Student 2 (فاطمة علي حسن) — 500 EGP/mo — paid Jan, Feb (missed Mar)
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (2, 500, 'paid', 1, 2026, 1736121700),
  (2, 500, 'paid', 2, 2026, 1738800100);

-- Student 3 (محمود إبراهيم عمر) — 750 EGP/mo — paid Jan, Feb, Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (3, 750, 'paid', 1, 2026, 1736121800),
  (3, 750, 'paid', 2, 2026, 1738800200),
  (3, 750, 'paid', 3, 2026, 1741392200);

-- Student 4 (نورا عبد الرحمن) — 500 EGP/mo — enrolled Feb, paid Feb, Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (4, 500, 'paid', 2, 2026, 1738800300),
  (4, 500, 'paid', 3, 2026, 1741392300);

-- Student 5 (يوسف خالد مصطفى) — 750 EGP/mo — enrolled Feb, paid Feb only
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (5, 750, 'paid', 2, 2026, 1738800400);

-- Student 6 (سارة أحمد طه) — 500 EGP/mo — enrolled Feb, paid Feb, Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (6, 500, 'paid', 2, 2026, 1738800500),
  (6, 500, 'paid', 3, 2026, 1741392500);

-- Student 7 (عمر حسام الدين) — 600 EGP/mo — enrolled Mar, paid Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (7, 600, 'paid', 3, 2026, 1741392600);

-- Student 8 (ريم عصام محمود) — 600 EGP/mo — enrolled Mar, paid Mar
INSERT INTO studentSubscriptions (studentId, amount, status, monthIndex, academicYear, createdAt) VALUES
  (8, 600, 'paid', 3, 2026, 1741392700);

-- Students 9, 10 enrolled Apr — no payments yet (all unpaid for April)

-- =============================================
-- 4. FINANCE LOGS
-- Auto-generated subscription income + manual entries
-- =============================================

-- === Subscription Income (matches subscriptions above) ===
INSERT INTO financeLogs (userId, type, amount, category, description, createdAt) VALUES

  -- January subscriptions
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 1 للطالب أحمد محمد السيد',    1736121600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 1 للطالب فاطمة علي حسن',     1736121700),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 750, 'رسوم دراسية', 'اشتراك شهر 1 للطالب محمود إبراهيم عمر', 1736121800),

  -- February subscriptions
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 2 للطالب أحمد محمد السيد',    1738800000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 2 للطالب فاطمة علي حسن',     1738800100),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 750, 'رسوم دراسية', 'اشتراك شهر 2 للطالب محمود إبراهيم عمر', 1738800200),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 2 للطالب نورا عبد الرحمن',   1738800300),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 750, 'رسوم دراسية', 'اشتراك شهر 2 للطالب يوسف خالد مصطفى',  1738800400),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 2 للطالب سارة أحمد طه',      1738800500),

  -- March subscriptions
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 3 للطالب أحمد محمد السيد',    1741392000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 750, 'رسوم دراسية', 'اشتراك شهر 3 للطالب محمود إبراهيم عمر', 1741392200),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 3 للطالب نورا عبد الرحمن',   1741392300),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 500, 'رسوم دراسية', 'اشتراك شهر 3 للطالب سارة أحمد طه',      1741392500),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 600, 'رسوم دراسية', 'اشتراك شهر 3 للطالب عمر حسام الدين',    1741392600),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income', 600, 'رسوم دراسية', 'اشتراك شهر 3 للطالب ريم عصام محمود',    1741392700),

  -- === Manual Expenses ===
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 1200, 'إيجار',         'إيجار مقر الشهر يناير',                 1736200000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense',  300, 'أدوات مكتبية', 'شراء أقلام وأوراق وملفات',              1736250000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 1200, 'إيجار',         'إيجار مقر الشهر فبراير',                1738900000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense',  450, 'كهرباء وماء',  'فاتورة الكهرباء والمياه فبراير',        1739000000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense', 1200, 'إيجار',         'إيجار مقر الشهر مارس',                  1741480000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense',  200, 'صيانة',         'صيانة أجهزة الحاسوب',                   1741500000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'expense',  800, 'رواتب',         'مكافأة المساعد الإداري مارس',           1741550000),

  -- === Other Income ===
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income',  2000, 'تبرعات',        'تبرع من أحد المحسنين - يناير',          1736300000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income',  5000, 'منح',           'منحة دعم من جمعية خيرية',               1739100000),
  ('LBsggT2tH6kiS12Y4vN2gXoL5nubbPRN', 'income',  1500, 'تبرعات',        'تبرع نقدي - مارس',                      1741600000);
