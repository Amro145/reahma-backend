import { Hono } from 'hono';
import { initAuth } from './lib/auth';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { getDb } from './db/index';
import { students, financeLogs } from './db/schema';
import { eq, and, desc } from 'drizzle-orm';

type Bindings = {
  rahma_db: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

type Variables = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/', (c) => c.json({ status: 'ok', message: 'RAHMA API is running' }));

app.use('/api/*', cors({
  origin: ['https://client.amroaltayeb14.workers.dev', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = initAuth(c.env);
    return auth.handler(c.req.raw);
});

// Authentication Middleware
const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const auth = initAuth(c.env);
    const sessionResponse = await auth.api.getSession({
        headers: c.req.raw.headers
    });
    
    if (!sessionResponse || !sessionResponse.user) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    
    c.set('user', sessionResponse.user);
    await next();
});

// --- Students Endpoints --- //

app.get('/api/students', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);

    const allStudents = await db.select().from(students).where(eq(students.userId, user.id));
    return c.json({ students: allStudents });
});

app.post('/api/students', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);
    
    const body = await c.req.json();
    const { name, whatsapp, requiredAmount } = body;

    if (!name || requiredAmount === undefined) {
        return c.json({ error: "Missing required fields" }, 400);
    }

    const newStudent = await db.insert(students).values({
        userId: user.id,
        name,
        whatsapp,
        requiredAmount: Number(requiredAmount),
        status: 'pending',
        createdAt: new Date(),
    }).returning();

    return c.json({ message: "Student added", student: newStudent[0] });
});

app.patch('/api/students/:id/pay', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);
    const studentId = Number(c.req.param('id'));

    const updated = await db.update(students)
        .set({ status: 'paid' })
        .where(and(eq(students.id, studentId), eq(students.userId, user.id)))
        .returning();

    if (updated.length === 0) {
        return c.json({ error: "Student not found or unauthorized" }, 404);
    }

    return c.json({ message: "Student marked as paid", student: updated[0] });
});

// --- Finance Endpoints --- //

app.get('/api/finance/summary', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);

    // Fetch students to calculate total required vs collected
    const allStudents = await db.select().from(students).where(eq(students.userId, user.id));
    let totalRequired = 0;
    let totalCollected = 0;

    for (const student of allStudents) {
        totalRequired += student.requiredAmount;
        if (student.status === 'paid') {
            totalCollected += student.requiredAmount;
        }
    }

    // Fetch finance logs to calculate additional income and total expenses
    const logs = await db.select().from(financeLogs).where(eq(financeLogs.userId, user.id));
    let totalExpenses = 0;
    let totalIncome = 0;

    for (const log of logs) {
        if (log.type === 'expense') {
            totalExpenses += log.amount;
        } else if (log.type === 'income') {
            totalIncome += log.amount;
        }
    }

    return c.json({
        summary: {
            students: {
                totalRequired,
                totalCollected,
                pending: totalRequired - totalCollected
            },
            finances: {
                totalIncome,
                totalExpenses,
                netBalance: (totalCollected + totalIncome) - totalExpenses
            }
        }
    });
});

app.post('/api/finance/logs', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);
    
    const body = await c.req.json();
    const { type, amount, category, description } = body;

    if (!type || !['income', 'expense'].includes(type) || amount === undefined || !category) {
        return c.json({ error: "Invalid or missing fields" }, 400);
    }

    const newLog = await db.insert(financeLogs).values({
        userId: user.id,
        type,
        amount: Number(amount),
        category,
        description,
        createdAt: new Date(),
    }).returning();

    return c.json({ message: "Finance log added", log: newLog[0] });
});

app.get('/api/finance/logs', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb(c.env.rahma_db);

    const logs = await db.select().from(financeLogs).where(eq(financeLogs.userId, user.id)).orderBy(desc(financeLogs.createdAt));
    return c.json({ logs });
});

export default app;
