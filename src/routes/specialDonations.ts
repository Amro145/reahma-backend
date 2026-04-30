import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getDb } from '../db/index';
import { specialDonations, financeLogs, auditLogs } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth-middleware';
import { donationSchema } from '../schemas';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const idParam = z.string().regex(/^\d+$/).transform(Number);

app.get('/', authMiddleware, async (c) => {
    const db = getDb(c.env.rahma_db);
    const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
    const offset = Number(c.req.query('offset')) || 0;

    const [data, countResult] = await Promise.all([
        db.select()
            .from(specialDonations)
            .orderBy(desc(specialDonations.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql`count(*)`.mapWith(Number) }).from(specialDonations).get()
    ]);
    
    return c.json({ donations: data, total: countResult?.count || 0, limit, offset });
});

app.post('/', authMiddleware, zValidator('json', donationSchema), async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);
    const data = c.req.valid('json');

    const newDonation = await db.insert(specialDonations).values({
        ...data,
        createdAt: new Date(),
    }).returning().get();

    await db.insert(financeLogs).values({
        type: 'income',
        amount: data.amount,
        category: 'تبرعات',
        description: `تبرع خاص: ${data.donorName}`,
        createdAt: new Date(),
    }).run();

    db.insert(auditLogs).values({
        userId: user.id,
        action: 'CREATE_SPECIAL_DONATION',
        details: JSON.stringify(newDonation),
        createdAt: new Date(),
    }).run().catch(console.error);

    return c.json({ donation: newDonation });
});

app.delete('/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const parsedId = idParam.safeParse(c.req.param('id'));
    if (!parsedId.success) return c.json({ error: 'Invalid ID' }, 400);
    const id = parsedId.data;

    const db = getDb(c.env.rahma_db);

    const donation = await db.select().from(specialDonations).where(eq(specialDonations.id, id)).get();
    if (!donation) return c.json({ error: 'Donation not found' }, 404);

    db.insert(auditLogs).values({
        userId: user.id,
        action: 'DELETE_SPECIAL_DONATION',
        details: JSON.stringify({ id, donorName: donation.donorName, amount: donation.amount }),
        createdAt: new Date(),
    }).run();

    await db.delete(specialDonations).where(eq(specialDonations.id, id)).run();

    return c.json({ success: true });
});

export default app;
