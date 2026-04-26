import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { user, students } from '../db/schema';
import { hashPassword, verifyPassword } from '../lib/auth-utils';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const signupSchema = z.object({
  email: z.string({
    required_error: "البريد الإلكتروني مطلوب",
    invalid_type_error: "البريد الإلكتروني يجب أن يكون نصاً",
  }).email("البريد الإلكتروني غير صالح"),
  password: z.string({
    required_error: "كلمة المرور مطلوبة",
    invalid_type_error: "كلمة المرور يجب أن تكون نصاً",
  }).min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(100, "كلمة المرور يجب أن لا تتجاوز 100 حرف"),
  name: z.string({
    required_error: "اسم المستخدم مطلوب",
    invalid_type_error: "اسم المستخدم يجب أن يكون نصاً",
  }).min(2, "اسم المستخدم يجب أن يكون حرفين على الأقل").max(100, "اسم المستخدم يجب أن لا يتجاوز 100 حرف"),
  whatsapp: z.string({
    required_error: "رقم الهاتف مطلوب",
    invalid_type_error: "رقم الهاتف يجب أن يكون نصاً",
  }).regex(/^\+?\d+$/, "رقم الهاتف غير صالح").min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل").max(25, "رقم الهاتف يجب أن لا يتجاوز 25 رقم").optional(),
  requiredAmount: z.number({
    required_error: "المبلغ المطلوب مطلوب",
    invalid_type_error: "المبلغ المطلوب يجب أن يكون رقماً",
  }).positive("المبلغ المطلوب يجب أن يكون أكبر من 0").max(10000000, "المبلغ المطلوب يجب أن لا يتجاوز 10000000"),
  faculty: z.enum(['medicine', 'dentistry', 'engineering', 'other']),
  semester: z.enum(['1', '2', '3', '4', '5', '6']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const generateToken = async (payload: { id: string; email: string; name: string; role: string }, secret: string) => {
  return await sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    secret,
    'HS256',
  );
};

app.post('/signup', async (c) => {
  const db = getDb(c.env.rahma_db);
  
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }

  const validation = signupSchema.safeParse(body);
  if (!validation.success) {
    return c.json({ error: validation.error.format() }, 400);
  }

  const { email, password, name, whatsapp, requiredAmount, faculty, semester } = validation.data;

  const existingUser = await db.select().from(user).where(eq(user.email, email)).get();
  if (existingUser) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();

  const newUser = await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: false,
    password: hashedPassword,
    role: 'student',
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  const newStudent = await db.insert(students).values({
    userId: newUser.id,
    name,
    whatsapp: whatsapp || null,
    requiredAmount,
    faculty,
    semester,
    enrollmentDate: now,
    createdAt: now,
  }).returning().get();

  const token = await generateToken({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  }, c.env.JWT_SECRET);

  return c.json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      student: newStudent,
    },
  });
});

app.post('/login', async (c) => {
  try {
    const db = getDb(c.env.rahma_db);

    let body;
    try {
      body = await c.req.json();
    } catch (err) {
      return c.json({ error: "Invalid or missing JSON body" }, 400);
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.format() }, 400);
    }

    const { email, password } = validation.data;

    const existingUser = await db.select().from(user).where(eq(user.email, email)).get();
    if (!existingUser) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const isValidPassword = await verifyPassword(password, existingUser.password);
    if (!isValidPassword) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const token = await generateToken({
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role,
    }, c.env.JWT_SECRET);

    return c.json({
      token,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ error: "Internal server error", details: String(err) }, 500);
  }
});

export default app;