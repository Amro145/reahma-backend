import { Hono } from 'hono';
import { z } from 'zod';
import { initAuth } from '../lib/auth';
import { orgMiddleware } from '../middlewares/org-middleware';
import { Bindings, Variables } from '../types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.post('/invite', orgMiddleware, async (c) => {
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
  } catch (err: unknown) {
    if (err instanceof Error) {
      return c.json({ error: err.message || "Failed to create invitation" }, 500);
    }
    return c.json({ error: "Failed to create invitation" }, 500);
  }
});

export default app;
