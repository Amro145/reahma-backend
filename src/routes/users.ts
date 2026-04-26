import { Hono } from 'hono';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { user } from '../db/schema';
import { authMiddleware } from '../middlewares/auth-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'management', 'student']),
});

app.get('/users', authMiddleware, async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'admin' && currentUser.role !== 'management') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const db = getDb(c.env.rahma_db);
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const offset = Number(c.req.query('offset')) || 0;

  const [users, countResult] = await Promise.all([
    db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    }).from(user).orderBy(user.createdAt).limit(limit).offset(offset),
    db.select({ count: sql`count(*)`.mapWith(Number) }).from(user).get()
  ]);

  return c.json({ users, total: countResult?.count || 0, limit, offset });
});

app.patch('/users/:id/role', authMiddleware, async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'admin' && currentUser.role !== 'management') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const userId = c.req.param('id');
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  const body = await c.req.json();
  const validation = updateRoleSchema.safeParse({ ...body, userId });
  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { role } = validation.data;
  const db = getDb(c.env.rahma_db);

  const targetUser = await db.select().from(user).where(eq(user.id, userId)).get();
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Management cannot make someone admin, only toggle between student and management
  if (currentUser.role === 'management' && role === 'admin') {
    return c.json({ error: 'Management cannot assign admin role' }, 403);
  }

  // Cannot demote yourself if you're the only admin
  if (currentUser.id === userId && currentUser.role === 'admin' && role !== 'admin') {
    const adminCount = await db.select({ count: user.id })
      .from(user)
      .where(eq(user.role, 'admin'))
      .all();
    if (adminCount.length <= 1) {
      return c.json({ error: 'Cannot demote the only admin' }, 400);
    }
  }

  const updated = await db.update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id, name: user.name, email: user.email, role: user.role })
    .get();

  return c.json({ user: updated });
});

export default app;