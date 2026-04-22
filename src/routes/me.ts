import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { user, students, studentSubscriptions } from '../db/schema';
import { authMiddleware } from '../middlewares/auth-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/me
 * Returns the current authenticated user's profile.
 * For students, also includes the student record and payment summary.
 */
app.get('/', authMiddleware, async (c) => {
  const me = c.get('user');
  const db = getDb(c.env.rahma_db);

  const dbUser = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }).from(user).where(eq(user.id, me.id)).get();

  if (!dbUser) return c.json({ error: 'User not found' }, 404);

  if (dbUser.role !== 'student') {
    return c.json({ user: dbUser });
  }

  // Fetch student record linked to this user
  const student = await db.select().from(students).where(eq(students.userId, me.id)).get();

  if (!student) {
    return c.json({ user: dbUser, student: null });
  }

  // Payment summary for current academic year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const subscriptions = await db.select().from(studentSubscriptions)
    .where(eq(studentSubscriptions.studentId, student.id))
    .all();

  const paidThisYear = subscriptions
    .filter(s => s.academicYear === currentYear && s.status === 'paid')
    .length;

  const totalPaidAmount = subscriptions
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + s.amount, 0);

  const unpaidMonths = Math.max(0, currentMonth - paidThisYear);
  const balanceDue = unpaidMonths * student.requiredAmount;

  return c.json({
    user: dbUser,
    student: {
      id: student.id,
      name: student.name,
      whatsapp: student.whatsapp,
      faculty: student.faculty,
      semester: student.semester,
      requiredAmount: student.requiredAmount,
      status: student.status,
      enrollmentDate: student.enrollmentDate,
    },
    paymentSummary: {
      paidMonthsThisYear: paidThisYear,
      totalPaidAmount,
      balanceDue,
      monthlyAmount: student.requiredAmount,
      currentMonth,
      currentYear,
    },
  });
});

export default app;
