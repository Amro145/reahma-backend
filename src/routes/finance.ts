import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getDb } from '../db/index';
import { financeLogs, auditLogs, students } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth-middleware';
import { financeLogSchema } from '../schemas';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const logIdParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/summary', authMiddleware, async (c) => {
  const db = getDb(c.env.rahma_db);

  const studentsCount = await db.select({ count: sql<number>`count(*)` })
    .from(students)
    .get();

  const totals = await db.select({
    type: financeLogs.type,
    total: sql<number>`sum(${financeLogs.amount})`
  }).from(financeLogs)
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

app.get('/logs', authMiddleware, async (c) => {
  const db = getDb(c.env.rahma_db);
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const offset = Number(c.req.query('offset')) || 0;

  const [data, countResult] = await Promise.all([
    db.select()
      .from(financeLogs)
      .orderBy(desc(financeLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql`count(*)`.mapWith(Number) }).from(financeLogs).get()
  ]);
  
  return c.json({ logs: data, total: countResult?.count || 0, limit, offset });
});

app.post('/logs', authMiddleware, zValidator('json', financeLogSchema), async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'management') return c.json({ error: "Forbidden" }, 403);
  const db = getDb(c.env.rahma_db);
  const data = c.req.valid('json');

  const newLog = await db.insert(financeLogs).values({
    ...data,
    createdAt: new Date(),
  }).returning().get();

  // Audit log is best-effort — don't let it block the response
  db.insert(auditLogs).values({
    userId: user.id,
    action: 'CREATE_FINANCE_LOG',
    details: JSON.stringify(newLog),
    createdAt: new Date(),
  }).run().catch(console.error);

  return c.json({ log: newLog });
});

app.patch('/logs/:id', authMiddleware, zValidator('json', financeLogSchema.partial()), async (c) => {
  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid log ID" }, 400);
  const logId = parsedId.data;

  const user = c.get('user');
  const db = getDb(c.env.rahma_db);
  const data = c.req.valid('json');

  const updated = await db.update(financeLogs)
    .set(data)
    .where(eq(financeLogs.id, logId))
    .returning().get();

  if (!updated) return c.json({ error: "Finance log not found" }, 404);

  db.insert(auditLogs).values({
    userId: user.id,
    action: 'UPDATE_FINANCE_LOG',
    details: JSON.stringify({ logId, changes: data }),
    createdAt: new Date(),
  }).run().catch(console.error);

  return c.json({ log: updated });
});

app.delete('/logs/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const parsedId = logIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: "Invalid log ID" }, 400);
  const logId = parsedId.data;

  const db = getDb(c.env.rahma_db);

  const log = await db.select().from(financeLogs).where(eq(financeLogs.id, logId)).get();
  if (!log) return c.json({ error: "Finance log not found" }, 404);

  await db.insert(auditLogs).values({
    userId: user.id,
    action: 'DELETE_FINANCE_LOG',
    details: JSON.stringify({ logId, amount: log.amount, type: log.type }),
    createdAt: new Date(),
  }).run();

  await db.delete(financeLogs).where(eq(financeLogs.id, logId)).run();

  return c.json({ success: true });
});

export default app;