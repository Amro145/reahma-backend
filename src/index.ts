import { Hono } from 'hono';
import { initAuth } from './lib/auth';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';
import { getDb } from './db/index';
import { students, financeLogs, studentSubscriptions } from './db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

type Bindings = {
  rahma_db: D1Database;
  RATE_LIMITER: KVNamespace;
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
  session: {
    id: string;
    activeOrganizationId?: string | null;
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Security Middlewares --- //

// 1. Secure Headers (HSTS, CSP, X-Frame-Options, etc.)
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], // Removed unsafe-inline for better security. If auth fails, add it back specifically for auth routes.
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
app.use('/api/*', (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = ['https://client.amroaltayeb14.workers.dev', 'http://localhost:3000'];
  
  return cors({
    origin: ((origin && allowedOrigins.includes(origin)) ? origin : allowedOrigins[0]) as string,
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// 3. Cloudflare KV Rate Limiter
const rateLimiterKV = (limit: number, windowSeconds: number) => {
  return createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    // Keying by IP and path to allow isolation
    const pathPrefix = c.req.path.startsWith('/api/auth') ? 'auth' : 'api';
    const key = `rl:${ip}:${pathPrefix}`;
    const kv = c.env.RATE_LIMITER;

    if (!kv) {
      console.warn("KV RATE_LIMITER binding is missing. Skipping rate limit.");
      return await next();
    }

    const current = await kv.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }

    await kv.put(key, (count + 1).toString(), { expirationTtl: Math.max(windowSeconds, 60) });
    await next();
  });
};

app.use('/api/auth/*', rateLimiterKV(10, 60)); // 10 req/min for Auth
app.use('/api/*', rateLimiterKV(60, 60));      // 60 req/min for General

// --- Input Validation Schemas Hardening --- //

const studentSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون أكثر من حرفين").max(100, "الاسم طويل جداً"),
  whatsapp: z.string().regex(/^\d+$/, "رقم الواتساب يجب أن يحتوي على أرقام فقط").min(10, "رقم الواتساب غير صالح").max(20, "رقم الواتساب طويل جداً"),
  requiredAmount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً").max(10000000, "المبلغ غير منطقي"),
});

const financeLogSchema = z.object({
  type: z.enum(['income', 'expense'], { error: "نوع المعاملة غير صالح" }),
  amount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً").max(50000000, "المبلغ غير منطقي"),
  category: z.string().min(2, "الفئة مطلوبة").max(100, "الفئة طويلة جداً"),
  description: z.string().max(512, "الوصف طويل جداً").optional(),
});

const studentIdParam = z.string().regex(/^\d+$/, "معرف الطالب غير صالح").transform(Number);

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
  c.set('session', sessionResponse.session as any);
  await next();
});

// --- Endpoints with Validation --- //

app.get('/api/students', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);
  
  const db = getDb(c.env.rahma_db);
  const allStudents = await db.select().from(students).where(eq(students.organizationId, session.activeOrganizationId));
  return c.json({ students: allStudents });
});

app.post('/api/students', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  
  const body = await c.req.json();
  const validation = studentSchema.safeParse(body);
  
  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { name, whatsapp, requiredAmount } = validation.data;

  const newStudent = await db.insert(students).values({
    organizationId: session.activeOrganizationId,
    name,
    whatsapp,
    requiredAmount,
    status: 'pending',
    createdAt: new Date(),
  }).returning();

  return c.json({ message: "Student added", student: newStudent[0] });
});

app.patch('/api/students/:id/pay', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) {
    return c.json({ error: parsedId.error.format() }, 400);
  }
  const studentId = parsedId.data;

  const updated = await db.update(students)
    .set({ status: 'paid' })
    .where(and(eq(students.id, studentId), eq(students.organizationId, session.activeOrganizationId)))
    .returning();

  if (updated.length === 0) {
    return c.json({ error: "الطالب غير موجود أو غير تابع لمؤسستك" }, 404);
  }

  return c.json({ message: "Student marked as paid", student: updated[0] });
});

app.patch('/api/students/:id', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: parsedId.error.format() }, 400);
  const studentId = parsedId.data;

  const body = await c.req.json();
  const updateSchema = z.object({
    name: z.string().min(2, "الاسم يجب أن يكون أكثر من حرفين").max(100, "الاسم طويل جداً").optional(),
    whatsapp: z.string().regex(/^\d+$/, "رقم الواتساب يجب أن يحتوي على أرقام فقط").min(10, "رقم الواتساب غير صالح").max(20, "رقم الواتساب طويل جداً").optional(),
    requiredAmount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً").max(10000000, "المبلغ غير منطقي").optional(),
  });

  const validation = updateSchema.safeParse(body);
  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const updated = await db.update(students)
    .set(validation.data)
    .where(and(eq(students.id, studentId), eq(students.organizationId, session.activeOrganizationId)))
    .returning();

  if (updated.length === 0) return c.json({ error: "الطالب غير موجود أو غير تابع للمؤسسة" }, 404);
  return c.json({ message: "Student updated", student: updated[0] });
});

app.delete('/api/students/:id', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: parsedId.error.format() }, 400);
  const studentId = parsedId.data;

  const deleted = await db.delete(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, session.activeOrganizationId)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "الطالب غير موجود أو غير تابع للمؤسسة" }, 404);
  return c.json({ message: "Student deleted" });
});

app.get('/api/students/:id/payment-status', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: parsedId.error.format() }, 400);
  const studentId = parsedId.data;

  const studentList = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.organizationId, session.activeOrganizationId)));
  if (studentList.length === 0) return c.json({ error: "الطالب غير موجود" }, 404);
  const student = studentList[0];

  const currentDate = new Date();
  const enrollmentDate = new Date(student.enrollmentDate);
  const academicYear = currentDate.getFullYear(); // For simplicity, using current year. Real apps might use custom logic.

  // Get months required. E.g., if enrolled in Jan, difference is months since enrolled.
  const monthsDiff = (currentDate.getFullYear() - enrollmentDate.getFullYear()) * 12 + currentDate.getMonth() - enrollmentDate.getMonth() + 1;
  const maxMonthsThisYear = 12; // Assuming full 12 months in an academic year
  
  // Calculate required months for this year (up to 12)
  // For simplicity, just get the current month index for logic
  const currentMonthIndex = currentDate.getMonth() + 1;
  
  const subscriptions = await db.select().from(studentSubscriptions).where(and(eq(studentSubscriptions.studentId, studentId), eq(studentSubscriptions.academicYear, academicYear)));

  const paymentPlan = [];
  let totalBalanceDue = 0;

  for (let month = 1; month <= 12; month++) {
    const sub = subscriptions.find(s => s.monthIndex === month);
    let status = 'upcoming';
    
    // Logic for past or current months
    if (month <= currentMonthIndex) {
      if (sub && sub.status === 'paid') {
        status = 'paid';
      } else {
        status = 'unpaid';
        totalBalanceDue += student.requiredAmount;
      }
    }

    const dateForMonthLabel = new Date(academicYear, month - 1, 1);
    
    paymentPlan.push({
      monthIndex: month,
      status, // paid, unpaid, upcoming
      amount: student.requiredAmount,
      label: dateForMonthLabel.toLocaleString('ar-EG', { month: 'long' })
    });
  }

  return c.json({
    studentId: student.id,
    academicYear,
    paymentPlan,
    totalBalanceDue,
    monthlyAmount: student.requiredAmount
  });
});

app.post('/api/students/:id/payment', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const parsedId = studentIdParam.safeParse(c.req.param('id'));
  if (!parsedId.success) return c.json({ error: parsedId.error.format() }, 400);
  const studentId = parsedId.data;

  // Make sure admin owns student
  const studentList = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.organizationId, session.activeOrganizationId)));
  if (studentList.length === 0) return c.json({ error: "الطالب غير موجود" }, 404);
  const student = studentList[0];

  const bodySchema = z.object({
    monthIndex: z.number().min(1).max(12),
    academicYear: z.number(),
    amount: z.number().positive().max(10000000, "المبلغ غير منطقي")
  });

  const body = await c.req.json();
  const validation = bodySchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const { monthIndex, academicYear, amount } = validation.data;

  try {
    const [newPayment] = await db.insert(studentSubscriptions).values({
      studentId,
      amount,
      status: 'paid',
      monthIndex,
      academicYear,
      createdAt: new Date(),
    }).returning();

    // إضافة العملية لسجل المالية تلقائياً
    await db.insert(financeLogs).values({
      organizationId: session.activeOrganizationId,
      type: 'income',
      amount,
      category: 'رسوم دراسية',
      description: `اشتراك شهر ${monthIndex} للطالب ${student.name}`,
      createdAt: new Date(),
    });

    return c.json({ message: "تم تسجيل الدفع بنجاح", payment: newPayment });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: "يوجد دفع مسجل مسبقاً لهذا الشهر" }, 400);
    }
    return c.json({ error: "حدث خطأ غير متوقع" }, 500);
  }
});

app.get('/api/finance/summary', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const orgId = session.activeOrganizationId;

  // Aggregate student stats directly in D1
  const studentStatsResult = await db.select({
    totalRequired: sql<number>`COALESCE(SUM(${students.requiredAmount}), 0)`,
    totalCollected: sql<number>`COALESCE(SUM(CASE WHEN ${students.status} = 'paid' THEN ${students.requiredAmount} ELSE 0 END), 0)`
  }).from(students).where(eq(students.organizationId, orgId));

  // Aggregate financeLogs stats directly in D1
  const financeStatsResult = await db.select({
    totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${financeLogs.type} = 'income' THEN ${financeLogs.amount} ELSE 0 END), 0)`,
    totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN ${financeLogs.type} = 'expense' THEN ${financeLogs.amount} ELSE 0 END), 0)`
  }).from(financeLogs).where(eq(financeLogs.organizationId, orgId));

  const s = studentStatsResult[0] || { totalRequired: 0, totalCollected: 0 };
  const f = financeStatsResult[0] || { totalIncome: 0, totalExpenses: 0 };

  return c.json({
    summary: {
      students: { 
        totalRequired: s.totalRequired, 
        totalCollected: s.totalCollected, 
        pending: s.totalRequired - s.totalCollected 
      },
      finances: { 
        totalIncome: f.totalIncome, 
        totalExpenses: f.totalExpenses, 
        netBalance: (s.totalCollected + f.totalIncome) - f.totalExpenses 
      }
    }
  });
});

app.post('/api/finance/logs', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  
  const body = await c.req.json();
  const validation = financeLogSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { type, amount, category, description } = validation.data;

  const newLog = await db.insert(financeLogs).values({
    organizationId: session.activeOrganizationId,
    type,
    amount,
    category,
    description: description || '',
    createdAt: new Date(),
  }).returning();

  return c.json({ message: "Finance log added", log: newLog[0] });
});

app.get('/api/finance/logs', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const logs = await db.select().from(financeLogs).where(eq(financeLogs.organizationId, session.activeOrganizationId)).orderBy(desc(financeLogs.createdAt));
  return c.json({ logs });
});

app.patch('/api/finance/logs/:id', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const logId = parseInt(c.req.param('id'));
  if (isNaN(logId)) return c.json({ error: "المعرف غير صالح" }, 400);

  const body = await c.req.json();
  const updateSchema = z.object({
    type: z.enum(['income', 'expense'], { error: "نوع المعاملة غير صالح" }).optional(),
    amount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً").max(50000000, "المبلغ غير منطقي").optional(),
    category: z.string().min(2, "الفئة مطلوبة").max(100, "الفئة طويلة جداً").optional(),
    description: z.string().max(512, "الوصف طويل جداً").optional(),
  });

  const validation = updateSchema.safeParse(body);
  if (!validation.success) return c.json({ error: validation.error.format() }, 400);

  const updated = await db.update(financeLogs)
    .set(validation.data)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, session.activeOrganizationId)))
    .returning();

  if (updated.length === 0) return c.json({ error: "السجل غير موجود أو غير تابع لمؤسستك" }, 404);
  return c.json({ message: "Log updated", log: updated[0] });
});

app.delete('/api/finance/logs/:id', requireAuth, async (c) => {
  const session = c.get('session');
  if (!session.activeOrganizationId) return c.json({ error: "يجب اختيار مؤسسة أولاً" }, 400);

  const db = getDb(c.env.rahma_db);
  const logId = parseInt(c.req.param('id'));
  if (isNaN(logId)) return c.json({ error: "المعرف غير صالح" }, 400);

  const deleted = await db.delete(financeLogs)
    .where(and(eq(financeLogs.id, logId), eq(financeLogs.organizationId, session.activeOrganizationId)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "السجل غير موجود أو غير تابع لمؤسستك" }, 404);
  return c.json({ message: "Log deleted" });
});

export default app;
