import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { user } from '../db/schema';
import { authMiddleware } from '../middlewares/auth-middleware';
import { updateRoleSchema } from '../schemas';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/users', authMiddleware, async (c) => {
  // TODO GIVE ALL USERS WITHOUT currentUser
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
    }).from(user).where(sql`${user.id} != ${currentUser.id}`).orderBy(user.createdAt).limit(limit).offset(offset),
    db.select({ count: sql`count(*)`.mapWith(Number) }).from(user).get()
  ]);

  return c.json({ users, total: countResult?.count || 0, limit, offset });
});

app.patch('/users/:id/role', authMiddleware, zValidator('json', updateRoleSchema), async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'admin' && currentUser.role !== 'management') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const userId = c.req.param('id');
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  const { role } = c.req.valid('json');
  const db = getDb(c.env.rahma_db);

  const targetUser = await db.select().from(user).where(eq(user.id, userId)).get();
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
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