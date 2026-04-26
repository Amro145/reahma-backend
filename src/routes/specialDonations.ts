import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index';
import { specialDonations, financeLogs, auditLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/auth-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const idParam = z.string().regex(/^\d+$/).transform(Number);

const donationSchema = z.object({
    donorName: z.string().min(1, "اسم المتبرع مطلوب").max(100, "اسم المتبرع يجب ان لا يتجاوز 100 حرف"),
    amount: z.number().positive("المبلغ يجب ان يكون اكبر من 0"),
});

app.get('/', authMiddleware, async (c) => {
    const db = getDb(c.env.rahma_db);
    const data = await db.select()
        .from(specialDonations)
        .orderBy(desc(specialDonations.createdAt))
        .all();
    
    return c.json({ donations: data });
});

app.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);

    const body = await c.req.json();
    const validation = donationSchema.safeParse(body);
    if (!validation.success) return c.json({ error: validation.error.format() }, 400);

    const newDonation = await db.insert(specialDonations).values({
        ...validation.data,
        createdAt: new Date(),
    }).returning().get();

    await db.insert(financeLogs).values({
        type: 'income',
        amount: validation.data.amount,
        category: 'تبرعات',
        description: `تبرع خاص: ${validation.data.donorName}`,
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
