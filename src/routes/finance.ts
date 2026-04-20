import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index';
import { financeLogs, auditLogs, students } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { orgMiddleware } from '../middlewares/org-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const logIdParam = z.string().regex(/^\d+$/).transform(Number);

const logSchema = z.object({
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: "نوع المعاملة يجب أن يكون إما إيراد أو مصروف" })
  }),
  amount: z.number({
    required_error: "المبلغ مطلوب",
    invalid_type_error: "المبلغ يجب أن يكون رقماً"
  }).positive("يجب أن يكون المبلغ أكبر من صفر"),
  category: z.string().min(1, "التصنيف مطلوب").trim(),
  description: z.string().optional().transform(v => v?.trim() || ""),
});

app.get('/summary', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);

  // Total Students
  const studentsCount = await db.select({ count: sql<number>`count(*)` })
    .from(students)
    .where(eq(students.organizationId, orgId))
    .get();

  // Optimized Financial Totals using SQL SUM
  const totals = await db.select({
    type: financeLogs.type,
    total: sql<number>`sum(${financeLogs.amount})`
  }).from(financeLogs)
    .where(eq(financeLogs.organizationId, orgId))
    .groupBy(financeLogs.type)
    .all();

  const totalIncome = totals.find(t => t.type === 'income')?.total || 0;
  const totalExpenses = totals.find(t => t.type === 'expense')?.total || 0;

  return c.json({
    totalStudents: studentsCount?.count || 0,
    finance: {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses
    }
  });
});

app.get('/logs', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);

  const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
  const offset = Number(c.req.query('offset')) || 0;

  const data = await db.select()
    .from(financeLogs)
    .where(eq(financeLogs.organizationId, orgId))
    .orderBy(desc(financeLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ logs: data });
});

app.post('/logs', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = logSchema.safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }

  // Sequential inserts — D1 does not support interactive transactions
  const log = await db.insert(financeLogs).values({
    ...validation.data,
    organizationId: orgId,
    createdAt: new Date(),
  }).returning().get();

  // Fire-and-forget audit log (non-critical, don't block response)
  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'CREATE_FINANCE_LOG',
      details: JSON.stringify(log),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] CREATE_FINANCE_LOG failed:', err))
  );

  return c.json({ log });
});

app.patch('/logs/:id', orgMiddleware, async (c) => {
  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "معرّف السجل غير صالح" }, 400);
  const logId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = logSchema.partial().safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }

  // Sequential update — no transaction needed
  const log = await db.update(financeLogs)
    .set(validation.data)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
    .returning()
    .get();

  if (!log) return c.json({ error: "السجل المالي غير موجود" }, 404);

  // Fire-and-forget audit log
  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'UPDATE_FINANCE_LOG',
      details: JSON.stringify({ logId, changes: validation.data }),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] UPDATE_FINANCE_LOG failed:', err))
  );

  return c.json({ log });
});

app.delete('/logs/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "غير مصرح لك بهذا الإجراء" }, 403);

  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "معرّف السجل غير صالح" }, 400);
  const logId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  // Sequential delete — no transaction needed
  const log = await db.delete(financeLogs)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
    .returning()
    .get();

  if (!log) return c.json({ error: "السجل المالي غير موجود" }, 404);

  // Fire-and-forget audit log
  c.executionCtx.waitUntil(
    db.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'DELETE_FINANCE_LOG',
      details: JSON.stringify({ logId, amount: log.amount, type: log.type }),
      createdAt: new Date(),
    }).run().catch(err => console.error('[AuditLog] DELETE_FINANCE_LOG failed:', err))
  );

  return c.json({ success: true });
});

export default app;
