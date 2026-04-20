import { Hono } from 'hono';
import { z } from 'zod';
import { initAuth } from '../lib/auth';
import { orgMiddleware } from '../middlewares/org-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.post('/invite', orgMiddleware, async (c) => {
  const role = c.get('role');
  if (role !== 'owner' && role !== 'admin') return c.json({ error: "غير مصرح لك بهذا الإجراء" }, 403);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "بيانات الطلب غير صالحة أو مفقودة" }, 400);
  }

  const inviteSchema = z.object({
    email: z.string().email("البريد الإلكتروني غير صالح"),
    role: z.enum(['admin', 'member'], {
      errorMap: () => ({ message: "الدور يجب أن يكون admin أو member" })
    }).default('member'),
  });

  const validation = inviteSchema.safeParse(body);
  if (!validation.success) {
    const errorMsg = validation.error.errors[0]?.message || "بيانات غير صالحة";
    return c.json({ error: errorMsg }, 400);
  }

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
  } catch (err: unknown) {
    if (err instanceof Error) {
      return c.json({ error: err.message || "فشل إرسال الدعوة" }, 500);
    }
    return c.json({ error: "فشل إرسال الدعوة" }, 500);
  }
});

export default app;
