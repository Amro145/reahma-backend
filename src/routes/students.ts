import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index';
import { students, auditLogs, studentSubscriptions, financeLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { orgMiddleware } from '../middlewares/org-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const studentSchema = z.object({
  name: z.string().min(2).max(100),
  whatsapp: z.string().regex(/^[\d\s+\-()]+$/).min(8).max(25), // More flexible for international formats
  requiredAmount: z.number().positive().max(10000000),
});

const paymentSchema = z.object({
  monthIndex: z.number().min(1).max(12),
  academicYear: z.number().min(2024).max(2100),
  amount: z.number().nonnegative(),
});

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);
  
  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
  const offset = Number(c.req.query('offset')) || 0;

  const data = await db.select().from(students)
    .where(eq(students.organizationId, orgId))
    .limit(limit)
    .offset(offset);
    
  return c.json({ students: data });
});

app.post('/', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
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
    organizationId: orgId,
    createdAt: new Date(),
  }).returning().get();

  if (newStudent) {
    await db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'CREATE_STUDENT',
      details: JSON.stringify(newStudent),
      createdAt: new Date(),
    }).run();
  }

  return c.json({ student: newStudent });
});

app.patch('/:id', orgMiddleware, async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = studentSchema.partial().safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const updated = await db.update(students)
    .set(validation.data)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (updated) {
    await db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'UPDATE_STUDENT',
      details: JSON.stringify({ studentId, changes: validation.data }),
      createdAt: new Date(),
    }).run();
  }

  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json({ student: updated });
});

app.delete('/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const deleted = await db.delete(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (deleted) {
    await db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'DELETE_STUDENT',
      details: JSON.stringify({ studentId, name: deleted.name }),
      createdAt: new Date(),
    }).run();
  }

  if (!deleted) return c.json({ error: "Not found" }, 404);

  return c.json({ success: true });
});

// --- Advanced Payment Tracking --- //

app.get('/:id/payment-status', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const student = await db.select().from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId))).get();
  
  if (!student) return c.json({ error: "Not found" }, 404);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const subscriptions = await db.select().from(studentSubscriptions)
    .where(and(eq(studentSubscriptions.studentId, studentId), eq(studentSubscriptions.academicYear, currentYear)));

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

app.patch('/:id/pay', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
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

  // Security Check: Verify student ownership before payment
  const student = await db.select().from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .get();

  if (!student) {
    console.warn(`[Payment] Student ${studentId} not found in org ${orgId}`);
    return c.json({ error: "Student not found in this organization" }, 404);
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

  const newLog = await db.insert(financeLogs).values({
    organizationId: orgId,
    type: 'income',
    amount,
    category: 'رسوم دراسية',
    description: `سداد شهر ${monthIndex} للطالب ${student.name} (ID: ${studentId})`,
    createdAt: new Date()
  }).returning().get();
  
  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'PAY_STUDENT_SUBSCRIPTIONS',
    details: JSON.stringify({ studentId, monthIndex, logId: newLog?.id }),
    createdAt: new Date(),
  }).run();

  return c.json({ subscription });
});

export default app;
