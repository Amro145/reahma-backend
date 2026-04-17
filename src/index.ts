import { Hono } from 'hono';
import { initAuth } from './lib/auth';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';
import { getDb } from './db/index';
import { students, financeLogs } from './db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

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

// --- Security Middlewares --- //

// 1. Secure Headers (HSTS, CSP, X-Frame-Options, etc.)
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline often needed for some auth scripts, tune as needed
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"], // Google avatars
    connectSrc: ["'self'", "https://client.amroaltayeb14.workers.dev", "http://localhost:3000"],
  },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
}));

// 2. Strict CORS
app.use('/api/*', cors({
  origin: ['https://client.amroaltayeb14.workers.dev', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// 3. Simple In-Memory Rate Limiter (Per IP)
// Note: In Cloudflare Workers, this is per-isolate. For global, use Cloudflare KV.
const rateLimiter = (limit: number, windowSeconds: number) => {
  const cache = new Map<string, { count: number; resetAt: number }>();
  return createMiddleware(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const key = `${ip}:${c.req.path}`;
    
    let info = cache.get(key);
    if (!info || now > info.resetAt) {
      info = { count: 0, resetAt: now + (windowSeconds * 1000) };
    }
    
    info.count++;
    cache.set(key, info);
    
    if (info.count > limit) {
      return c.json({ 
        error: "Too many requests", 
        retryAfter: Math.ceil((info.resetAt - now) / 1000) 
      }, 429);
    }
    await next();
  });
};

app.use('/api/auth/*', rateLimiter(10, 60)); // 10 req/min for Auth
app.use('/api/*', rateLimiter(60, 60));      // 60 req/min for General

// --- Input Validation Schemas --- //

const studentSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون أكثر من حرفين"),
  whatsapp: z.string().regex(/^\d+$/, "رقم الواتساب يجب أن يحتوي على أرقام فقط").min(10, "رقم الواتساب غير صالح"),
  requiredAmount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً"),
});

const financeLogSchema = z.object({
  type: z.enum(['income', 'expense'], { error: "نوع المعاملة غير صالح" }),
  amount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً"),
  category: z.string().min(2, "الفئة مطلوبة"),
  description: z.string().optional(),
});

// --- Existing Logic --- //

app.get('/', (c) => c.json({ status: 'ok', message: 'RAHMA API is running secure' }));

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = initAuth(c.env);
  return auth.handler(c.req.raw);
});

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

// --- Endpoints with Validation --- //

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
  const validation = studentSchema.safeParse(body);
  
  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { name, whatsapp, requiredAmount } = validation.data;

  const newStudent = await db.insert(students).values({
    userId: user.id,
    name,
    whatsapp,
    requiredAmount,
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

app.get('/api/finance/summary', requireAuth, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.rahma_db);

  const allStudents = await db.select().from(students).where(eq(students.userId, user.id));
  let totalRequired = 0;
  let totalCollected = 0;
  for (const student of allStudents) {
    totalRequired += student.requiredAmount;
    if (student.status === 'paid') totalCollected += student.requiredAmount;
  }

  const logs = await db.select().from(financeLogs).where(eq(financeLogs.userId, user.id));
  let totalExpenses = 0;
  let totalIncome = 0;
  for (const log of logs) {
    if (log.type === 'expense') totalExpenses += log.amount;
    else if (log.type === 'income') totalIncome += log.amount;
  }

  return c.json({
    summary: {
      students: { totalRequired, totalCollected, pending: totalRequired - totalCollected },
      finances: { totalIncome, totalExpenses, netBalance: (totalCollected + totalIncome) - totalExpenses }
    }
  });
});

app.post('/api/finance/logs', requireAuth, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.rahma_db);
  
  const body = await c.req.json();
  const validation = financeLogSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { type, amount, category, description } = validation.data;

  const newLog = await db.insert(financeLogs).values({
    userId: user.id,
    type,
    amount,
    category,
    description: description || '',
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
