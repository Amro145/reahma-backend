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
  whatsapp: z.string().regex(/^\d+$/).min(10).max(20),
  requiredAmount: z.number().positive().max(10000000),
});

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);
  const data = await db.select().from(students).where(eq(students.organizationId, orgId));
  return c.json({ students: data });
});

app.post('/', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);
  
  const body = await c.req.json();
  const validation = studentSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  let newStudent: any = null;
  await db.transaction(async (tx) => {
    newStudent = await tx.insert(students).values({
      ...validation.data,
      organizationId: orgId,
      createdAt: new Date(),
    }).returning().get();

    await tx.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'CREATE_STUDENT',
      details: JSON.stringify(newStudent),
      createdAt: new Date(),
    }).run();
  });

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

  let updated: any = null;
  await db.transaction(async (tx) => {
    updated = await tx.update(students)
      .set(validation.data)
      .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
      .returning().get();

    if (updated) {
      await tx.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        action: 'UPDATE_STUDENT',
        details: JSON.stringify({ studentId, changes: validation.data }),
        createdAt: new Date(),
      }).run();
    }
  });

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

  let deleted: any = null;
  await db.transaction(async (tx) => {
    deleted = await tx.delete(students)
      .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
      .returning().get();

    if (deleted) {
      await tx.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        action: 'DELETE_STUDENT',
        details: JSON.stringify({ studentId, name: deleted.name }),
        createdAt: new Date(),
      }).run();
    }
  });

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
  const body = await c.req.json();
  const { monthIndex, academicYear, amount } = body;

  let newSub: any = null;

  await db.transaction(async (tx) => {
    newSub = await tx.insert(studentSubscriptions).values({
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

    const newLog = await tx.insert(financeLogs).values({
      organizationId: orgId,
      type: 'income',
      amount,
      category: 'رسوم دراسية',
      description: `سداد شهر ${monthIndex} للطالب ${studentId}`,
      createdAt: new Date()
    }).returning().get();
    
    await tx.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'PAY_STUDENT_SUBSCRIPTIONS',
      details: JSON.stringify({ studentId, monthIndex, logId: newLog?.id }),
      createdAt: new Date(),
    }).run();
  });

  return c.json({ subscription: newSub });
});

export default app;
