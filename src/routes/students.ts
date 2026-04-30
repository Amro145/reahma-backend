import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getDb } from '../db/index';
import { students, auditLogs, studentSubscriptions, financeLogs } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth-middleware';
import { studentSchema, paymentSchema } from '../schemas';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.rahma_db);
  
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const offset = Number(c.req.query('offset')) || 0;

  const [data, countResult] = await Promise.all([
    db.select().from(students)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql`count(*)`.mapWith(Number) }).from(students).get()
  ]);
    
  return c.json({ students: data, total: countResult?.count || 0, limit, offset });
});

app.get('/:id', authMiddleware, async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const student = await db.select().from(students)
    .where(eq(students.id, studentId))
    .get();
  
  if (!student) return c.json({ error: "Not found" }, 404);

  return c.json({ student });
});

app.post('/', authMiddleware, zValidator('json', studentSchema), async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'management') return c.json({ error: "Forbidden: Only admins and management can create students" }, 403);

  const db = getDb(c.env.rahma_db);
  const data = c.req.valid('json');

  const newStudent = await db.insert(students).values({
    ...data,
    createdAt: new Date(),
  }).returning().get();

  if (newStudent) {
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'CREATE_STUDENT',
      details: JSON.stringify(newStudent),
      createdAt: new Date(),
    }).run();
  }

  return c.json({ student: newStudent });
});

app.patch('/:id', authMiddleware, zValidator('json', studentSchema.partial()), async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const user = c.get('user');
  const db = getDb(c.env.rahma_db);

  const data = c.req.valid('json') as Partial<z.infer<typeof studentSchema>>;
  const validation = studentSchema.partial().safeParse(data);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const updated = await db.update(students)
    .set(validation.data)
    .where(eq(students.id, studentId))
    .returning().get();

  if (updated) {
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'UPDATE_STUDENT',
      details: JSON.stringify({ studentId, changes: validation.data }),
      createdAt: new Date(),
    }).run();
  }

  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json({ student: updated });
});

app.delete('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'management') return c.json({ error: "Forbidden: Only management and admins can delete students" }, 403);

  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);

  const deleted = await db.delete(students)
    .where(eq(students.id, studentId))
    .returning().get();

  if (deleted) {
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'DELETE_STUDENT',
      details: JSON.stringify({ studentId, name: deleted.name }),
      createdAt: new Date(),
    }).run();
  }

  if (!deleted) return c.json({ error: "Not found" }, 404);

  return c.json({ success: true });
});

// --- Advanced Payment Tracking --- //

app.get('/:id/payment-status', authMiddleware, async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const student = await db.select().from(students)
    .where(eq(students.id, studentId)).get();
  
  if (!student) return c.json({ error: "Not found" }, 404);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const subscriptions = await db.select().from(studentSubscriptions)
    .where(and(eq(studentSubscriptions.studentId, studentId), eq(studentSubscriptions.academicYear, currentYear)))
    .all();

  console.log(`[Status] Fetched ${subscriptions.length} subscriptions for student ${studentId} in year ${currentYear}`);

  const paymentPlan = Array.from({ length: 12 }).map((_, idx) => {
    const monthIndex = idx + 1;
    const sub = subscriptions.find(s => s.monthIndex === monthIndex);
    let status = "upcoming";
    if (sub?.status === 'paid') {
      status = "paid";
    } else if (monthIndex <= currentMonth) {
      status = "unpaid";
    }
    
    return {
      monthIndex,
      status,
      amount: student.requiredAmount,
      label: `شهر ${monthIndex}`,
    };
  });

  const unpaidMonths = paymentPlan.filter(p => p.status === 'unpaid').length;

  return c.json({
    studentId: student.id,
    academicYear: currentYear,
    paymentPlan,
    totalBalanceDue: unpaidMonths * student.requiredAmount,
    monthlyAmount: student.requiredAmount
  });
});

app.patch('/:id/pay', authMiddleware, zValidator('json', paymentSchema), async (c) => {
  const user = c.get('user');
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const { monthIndex, academicYear, amount } = c.req.valid('json');
  console.log(`[Payment] Attempting payment for student ${studentId}, month ${monthIndex}, year ${academicYear}, amount ${amount}`);

  const student = await db.select().from(students)
    .where(eq(students.id, studentId))
    .get();

  if (!student) {
    console.warn(`[Payment] Student ${studentId} not found`);
    return c.json({ error: "Student not found" }, 404);
  }

  const subscription = await db.insert(studentSubscriptions).values({
    studentId,
    monthIndex,
    academicYear,
    amount,
    status: 'paid',
    createdAt: new Date()
  }).onConflictDoUpdate({
    target: [studentSubscriptions.studentId, studentSubscriptions.monthIndex, studentSubscriptions.academicYear],
    set: { status: 'paid', amount }
  }).returning().get();

  console.log(`[Payment] Inserted/Updated subscription for student ${studentId}. Result:`, subscription);
  
  const newLog = await db.insert(financeLogs).values({
    type: 'income',
    amount,
    category: 'رسوم دراسية',
    description: `سداد شهر ${monthIndex} للطالب ${student.name} (ID: ${studentId})`,
    createdAt: new Date()
  }).returning().get();
  
  console.log(`[Payment] Created finance log ${newLog?.id} for student ${studentId}`);

  await db.insert(auditLogs).values({
    userId: user.id,
    action: 'PAY_STUDENT_SUBSCRIPTIONS',
    details: JSON.stringify({ studentId, monthIndex, logId: newLog?.id }),
    createdAt: new Date(),
  }).run();

  await db.update(students)
    .set({ status: 'paid' })
    .where(eq(students.id, studentId))
    .run();
  
  console.log(`[Payment] Success for student ${studentId}, month ${monthIndex}`);

  return c.json({ subscription });
});

export default app;