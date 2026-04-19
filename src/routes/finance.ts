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
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().optional(),
});

app.get('/summary', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);

  // Total Students
  const studentsCount = await db.select({ count: sql<number>`count(*)` })
    .from(students)
    .where(eq(students.organizationId, orgId))
    .get();

  // Financial Totals
  const logs = await db.select().from(financeLogs).where(eq(financeLogs.organizationId, orgId));
  
  let totalIncome = 0;
  let totalExpenses = 0;

  logs.forEach(log => {
    if (log.type === 'income') totalIncome += log.amount;
    else totalExpenses += log.amount;
  });

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
  const data = await db.select()
    .from(financeLogs)
    .where(eq(financeLogs.organizationId, orgId))
    .orderBy(desc(financeLogs.createdAt))
    .limit(100); // Pagination limit added
  
  return c.json({ logs: data });
});

app.post('/logs', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = logSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  let newLog: any = null;
  // Transactions
  await db.transaction(async (tx) => {
    newLog = await tx.insert(financeLogs).values({
      ...validation.data,
      organizationId: orgId,
      createdAt: new Date(),
    }).returning().get();

    await tx.insert(auditLogs).values({
      organizationId: orgId,
      userId,
      action: 'CREATE_FINANCE_LOG',
      details: JSON.stringify(newLog),
      createdAt: new Date(),
    }).run();
  });

  return c.json({ log: newLog });
});

app.patch('/logs/:id', orgMiddleware, async (c) => {
  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid log ID" }, 400);
  const logId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = logSchema.partial().safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  let updated: any = null;
  await db.transaction(async (tx) => {
    updated = await tx.update(financeLogs)
      .set(validation.data)
      .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
      .returning().get();

    if (updated) {
      await tx.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        action: 'UPDATE_FINANCE_LOG',
        details: JSON.stringify({ logId, changes: validation.data }),
        createdAt: new Date(),
      }).run();
    }
  });

  if (!updated) return c.json({ error: "Finance log not found" }, 404);

  return c.json({ log: updated });
});

app.delete('/logs/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid log ID" }, 400);
  const logId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  let deleted: any = null;

  await db.transaction(async (tx) => {
    deleted = await tx.delete(financeLogs)
      .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
      .returning().get();

    if (deleted) {
      await tx.insert(auditLogs).values({
        organizationId: orgId,
        userId,
        action: 'DELETE_FINANCE_LOG',
        details: JSON.stringify({ logId, amount: deleted.amount, type: deleted.type }),
        createdAt: new Date(),
      }).run();
    }
  });

  if (!deleted) return c.json({ error: "Finance log not found" }, 404);

  return c.json({ success: true });
});

export default app;
