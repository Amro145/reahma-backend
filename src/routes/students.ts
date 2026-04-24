import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index';
import { students, auditLogs, studentSubscriptions, financeLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const studentSchema = z.object({
  name: z.string().min(2).max(100),
  whatsapp: z.string().regex(/^\+?\d+$/).min(8).max(25).optional(),
  requiredAmount: z.number().positive().max(10000000),
  faculty: z.enum(['medicine', 'dentistry', 'engineering', 'other']),
  semester: z.enum(['1', '2', '3', '4', '5', '6']),
});

const paymentSchema = z.object({
  monthIndex: z.number().min(1).max(12),
  academicYear: z.number().min(2024).max(2100),
  amount: z.number().nonnegative(),
});

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.rahma_db);
  
  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
  const offset = Number(c.req.query('offset')) || 0;

  const data = await db.select().from(students)
    .limit(limit)
    .offset(offset);
    
  return c.json({ students: data });
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

app.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: "Forbidden: Only admins can create students" }, 403);
  
  const db = getDb(c.env.rahma_db);
  
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    console.error("[Students] Failed to parse JSON body:", err);
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }

  const validation = studentSchema.safeParse(body);
  if (!validation.success) {
    console.warn("[Students] Validation failed:", validation.error.format());
    return c.json({ error: validation.error.format() }, 400);
  }

  const newStudent = await db.insert(students).values({
    ...validation.data,
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

app.patch('/:id', authMiddleware, async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const user = c.get('user');
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = studentSchema.partial().safeParse(body);
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
  if (user.role !== 'admin') return c.json({ error: "Forbidden" }, 403);

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

app.patch('/:id/pay', authMiddleware, async (c) => {
  const user = c.get('user');
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    console.error("[Payment] Failed to parse JSON body:", err);
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }
  
  const validation = paymentSchema.safeParse(body);
  if (!validation.success) {
    console.warn("[Payment] Validation failed:", validation.error.format());
    return c.json({ error: validation.error.format() }, 400);
  }
  
  const { monthIndex, academicYear, amount } = validation.data;
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