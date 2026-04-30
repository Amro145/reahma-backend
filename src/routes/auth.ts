import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { user, students } from '../db/schema';
import { hashPassword, verifyPassword } from '../lib/auth-utils';
import { signupSchema, loginSchema } from '../schemas';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const generateToken = async (payload: { id: string; email: string; name: string; role: string }, secret: string) => {
  return await sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    secret,
    'HS256',
  );
};

app.post('/signup', zValidator('json', signupSchema), async (c) => {
  const db = getDb(c.env.rahma_db);
  const { email, password, name, whatsapp, requiredAmount, faculty, semester } = c.req.valid('json');

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

app.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const db = getDb(c.env.rahma_db);
    const { email, password } = c.req.valid('json');

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