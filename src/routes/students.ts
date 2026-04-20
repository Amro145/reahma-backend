import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index';
import { students, auditLogs, studentSubscriptions, financeLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { orgMiddleware } from '../middlewares/org-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const studentSchema = z.object({
  name: z.string()
    .min(2, "اسم الطالب يجب أن يكون حرفين على الأقل")
    .max(100, "اسم الطالب طويل جداً (الحد الأقصى 100 حرف)"),
  whatsapp: z.string()
    .regex(/^[\d\s+\-()]+$/, "رقم الواتساب يحتوي على أحرف غير مقبولة")
    .min(8, "رقم الواتساب قصير جداً")
    .max(25, "رقم الواتساب طويل جداً"),
  requiredAmount: z.number({
    required_error: "المبلغ المطلوب مطلوب",
    invalid_type_error: "المبلغ المطلوب يجب أن يكون رقماً"
  })
    .positive("يجب أن يكون المبلغ أكبر من صفر")
    .max(10000000, "المبلغ المدخل كبير جداً"),
});

const paymentSchema = z.object({
  monthIndex: z.number({
    required_error: "رقم الشهر مطلوب",
    invalid_type_error: "رقم الشهر يجب أن يكون رقماً"
  }).min(1, "رقم الشهر غير صالح").max(12, "رقم الشهر غير صالح"),
  academicYear: z.number({
    required_error: "السنة الدراسية مطلوبة",
    invalid_type_error: "السنة الدراسية يجب أن تكون رقماً"
  }).min(2024, "السنة الدراسية غير صالحة").max(2100, "السنة الدراسية غير صالحة"),
  amount: z.number({
    required_error: "المبلغ مطلوب",
    invalid_type_error: "المبلغ يجب أن يكون رقماً"
  }).nonnegative("يجب أن يكون المبلغ صفراً أو أكثر"),
});

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

const parseBody = async (c: Parameters<typeof orgMiddleware>[0]) => {
  try {
    return { body: await c.req.json(), error: null };
  } catch {
    return { body: null, error: "بيانات الطلب غير صالحة أو مفقودة" };
  }
};

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
  
  const { body, error: bodyError } = await parseBody(c);
  if (bodyError) return c.json({ error: bodyError }, 400);

  const validation = studentSchema.safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }

  const newStudent = await db.insert(students).values({
    ...validation.data,
    organizationId: orgId,
    createdAt: new Date(),
  }).returning().get();

  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'CREATE_STUDENT',
      details: JSON.stringify(newStudent),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] CREATE_STUDENT failed:', err))
  );

  return c.json({ student: newStudent });
});

app.patch('/:id', orgMiddleware, async (c) => {
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "معرّف الطالب غير صالح" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const { body, error: bodyError } = await parseBody(c);
  if (bodyError) return c.json({ error: bodyError }, 400);

  const validation = studentSchema.partial().safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }

  const updated = await db.update(students)
    .set(validation.data)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (!updated) return c.json({ error: "الطالب غير موجود" }, 404);

  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'UPDATE_STUDENT',
      details: JSON.stringify({ studentId, changes: validation.data }),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] UPDATE_STUDENT failed:', err))
  );

  return c.json({ student: updated });
});

app.delete('/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "غير مصرح لك بهذا الإجراء" }, 403);

  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "معرّف الطالب غير صالح" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const deleted = await db.delete(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (!deleted) return c.json({ error: "الطالب غير موجود" }, 404);

  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'DELETE_STUDENT',
      details: JSON.stringify({ studentId, name: deleted.name }),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] DELETE_STUDENT failed:', err))
  );

  return c.json({ success: true });
});

// --- Advanced Payment Tracking --- //

app.get('/:id/payment-status', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "معرّف الطالب غير صالح" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const student = await db.select().from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId))).get();
  
  if (!student) return c.json({ error: "الطالب غير موجود في هذه المؤسسة" }, 404);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const subscriptions = await db.select().from(studentSubscriptions)
    .where(and(eq(studentSubscriptions.studentId, studentId), eq(studentSubscriptions.academicYear, currentYear)))
    .all();

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
  if (!parsedId.success) return c.json({ error: "معرّف الطالب غير صالح" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const { body, error: bodyError } = await parseBody(c);
  if (bodyError) return c.json({ error: bodyError }, 400);
  
  const validation = paymentSchema.safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات الدفع غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }
  
  const { monthIndex, academicYear, amount } = validation.data;

  const student = await db.select().from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .get();

  if (!student) return c.json({ error: "الطالب غير موجود في هذه المؤسسة" }, 404);

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

  // These are critical operations for data integrity, run sequentially
  await db.insert(financeLogs).values({
    organizationId: orgId,
    type: 'income',
    amount,
    category: 'رسوم دراسية',
    description: `سداد شهر ${monthIndex} للطالب ${student.name} (ID: ${studentId})`,
    createdAt: new Date()
  }).run();

  await db.update(students)
    .set({ status: 'paid' })
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .run();

  // Non-critical audit log
  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'PAY_STUDENT_SUBSCRIPTIONS',
      details: JSON.stringify({ studentId, monthIndex }),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] PAY_STUDENT failed:', err))
  );

  return c.json({ subscription });
});

export default app;
