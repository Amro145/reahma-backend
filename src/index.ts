import { Hono } from 'hono';
import { initAuth } from './lib/auth';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';
import { getDb } from './db/index';
import { students, financeLogs, studentSubscriptions, auditLogs } from './db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { Bindings, Variables } from './types';
import { orgMiddleware } from './middlewares/org-middleware';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Security Middlewares --- //

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], 
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
    connectSrc: ["'self'", "https://client.amroaltayeb14.workers.dev", "http://localhost:3000"],
  },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
}));

app.use('/api/*', (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = ['https://client.amroaltayeb14.workers.dev', 'http://localhost:3000'];
  
  return cors({
    origin: ((origin && allowedOrigins.includes(origin)) ? origin : allowedOrigins[0]) as string,
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-organization-id'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

const rateLimiterKV = (limit: number, windowSeconds: number) => {
  return createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const pathPrefix = c.req.path.startsWith('/api/auth') ? 'auth' : 'api';
    const key = `rl:${ip}:${pathPrefix}`;
    const kv = c.env.RATE_LIMITER;

    if (!kv) return await next();

    const current = await kv.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await kv.put(key, (count + 1).toString(), { expirationTtl: Math.max(windowSeconds, 60) });
    await next();
  });
};

app.use('/api/auth/*', rateLimiterKV(100, 60));
app.use('/api/*', rateLimiterKV(500, 60));

// --- Auth Handler --- //

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = initAuth(c.env);
  return auth.handler(c.req.raw);
});

// --- Validation Schemas --- //

const studentSchema = z.object({
  name: z.string().min(2).max(100),
  whatsapp: z.string().regex(/^\d+$/).min(10).max(20),
  requiredAmount: z.number().positive().max(10000000),
});

const studentIdParam = z.string().regex(/^\d+$/).transform(Number);

// --- Core Endpoints --- //

app.get('/api/students', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);
  const data = await db.select().from(students).where(eq(students.organizationId, orgId));
  return c.json({ students: data });
});

app.post('/api/students', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);
  
  const body = await c.req.json();
  const validation = studentSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const newStudent = await db.insert(students).values({
    ...validation.data,
    organizationId: orgId,
    createdAt: new Date(),
  }).returning().get();

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'CREATE_STUDENT',
    details: JSON.stringify(newStudent),
    createdAt: new Date(),
  });

  return c.json({ student: newStudent });
});

app.patch('/api/students/:id', orgMiddleware, async (c) => {
  const studentIdStr = c.req.param('id');
  const parsedId = studentIdParam.safeParse(studentIdStr);
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const validation = studentSchema.partial().safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const updated = await db.update(students)
    .set(validation.data)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (!updated) return c.json({ error: "Not found" }, 404);

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'UPDATE_STUDENT',
    details: JSON.stringify({ studentId, changes: validation.data }),
    createdAt: new Date(),
  });

  return c.json({ student: updated });
});

app.delete('/api/students/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const studentIdStr = c.req.param('id');
  const parsedId = studentIdParam.safeParse(studentIdStr);
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const deleted = await db.delete(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .returning().get();

  if (!deleted) return c.json({ error: "Not found" }, 404);

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'DELETE_STUDENT',
    details: JSON.stringify({ studentId, name: deleted.name }),
    createdAt: new Date(),
  });

  return c.json({ success: true });
});

// --- Financial Endpoints --- //

app.get('/api/finance/summary', orgMiddleware, async (c) => {
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

app.get('/api/finance/logs', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const db = getDb(c.env.rahma_db);
  const data = await db.select()
    .from(financeLogs)
    .where(eq(financeLogs.organizationId, orgId))
    .orderBy(desc(financeLogs.createdAt));
  
  return c.json({ logs: data });
});

app.post('/api/finance/logs', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const logSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive(),
    category: z.string().min(1),
    description: z.string().optional(),
  });

  const validation = logSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const newLog = await db.insert(financeLogs).values({
    ...validation.data,
    organizationId: orgId,
    createdAt: new Date(),
  }).returning().get();

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'CREATE_FINANCE_LOG',
    details: JSON.stringify(newLog),
    createdAt: new Date(),
  });

  return c.json({ log: newLog });
});

app.patch('/api/finance/logs/:id', orgMiddleware, async (c) => {
  const logId = parseInt(c.req.param('id'));
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const body = await c.req.json();
  const logSchema = z.object({
    type: z.enum(['income', 'expense']).optional(),
    amount: z.number().positive().optional(),
    category: z.string().min(1).optional(),
    description: z.string().optional(),
  });

  const validation = logSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const updated = await db.update(financeLogs)
    .set(validation.data)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
    .returning().get();

  if (!updated) return c.json({ error: "Finance log not found" }, 404);

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'UPDATE_FINANCE_LOG',
    details: JSON.stringify({ logId, changes: validation.data }),
    createdAt: new Date(),
  });

  return c.json({ log: updated });
});

app.delete('/api/finance/logs/:id', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const logId = parseInt(c.req.param('id'));
  const orgId = c.get('orgId');
  const userId = c.get('user').id;
  const db = getDb(c.env.rahma_db);

  const deleted = await db.delete(financeLogs)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, orgId)))
    .returning().get();

  if (!deleted) return c.json({ error: "Finance log not found" }, 404);

  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId,
    action: 'DELETE_FINANCE_LOG',
    details: JSON.stringify({ logId, amount: deleted.amount, type: deleted.type }),
    createdAt: new Date(),
  });

  return c.json({ success: true });
});

// --- Advanced Payment Tracking --- //

app.get('/api/students/:id/payment-status', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const studentIdStr = c.req.param('id');
  const parsedId = studentIdParam.safeParse(studentIdStr);
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  
  const student = await db.select().from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId))).get();
  
  if (!student) return c.json({ error: "Not found" }, 404);

  const currentYear = new Date().getFullYear();
  const subscriptions = await db.select().from(studentSubscriptions)
    .where(and(eq(studentSubscriptions.studentId, studentId), eq(studentSubscriptions.academicYear, currentYear)));

  return c.json({ student, subscriptions, currentYear });
});

app.patch('/api/students/:id/pay', orgMiddleware, async (c) => {
  const orgId = c.get('orgId');
  const studentIdStr = c.req.param('id');
  const parsedId = studentIdParam.safeParse(studentIdStr);
  if (!parsedId.success) return c.json({ error: "Invalid ID" }, 400);
  const studentId = parsedId.data;

  const db = getDb(c.env.rahma_db);
  const body = await c.req.json();
  const { monthIndex, academicYear, amount } = body;

  const newSub = await db.insert(studentSubscriptions).values({
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

  // Also log to financeLogs
  await db.insert(financeLogs).values({
    organizationId: orgId,
    type: 'income',
    amount,
    category: 'رسوم دراسية',
    description: `سداد شهر ${monthIndex} للطالب ${studentId}`,
    createdAt: new Date()
  });

  return c.json({ subscription: newSub });
});

// --- Invitation Workflow --- //

app.post('/api/organizations/invite', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).default('member'),
  });

  const validation = inviteSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const auth = initAuth(c.env);
  const orgId = c.get('orgId');

  try {
    const invitation = await auth.api.createInvitation({
      body: {
        email: validation.data.email,
        role: validation.data.role,
        organizationId: orgId,
      },
      headers: c.req.raw.headers,
    });

    return c.json({ invitation });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create invitation" }, 500);
  }
});

export default app;
