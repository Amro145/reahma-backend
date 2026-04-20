import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from './types';
import { initAuth } from './lib/auth';

// Import routers
import studentsRouter from './routes/students';
import financeRouter from './routes/finance';
import organizationsRouter from './routes/organizations';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Security Middlewares --- //

app.use('*', (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
  
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], 
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", ...origins],
    },
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
  })(c, next);
});

app.use('/api/*', (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
  
  return cors({
    origin: (origin && allowedOrigins.includes(origin)) ? origin : allowedOrigins[0],
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
    const key = `rl:${ip}:${pathPrefix}`; // Should be hashed natively, relying on cf-connecting-ip for now
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

app.use('/api/auth/*', rateLimiterKV(500, 60));
app.use('/api/*', rateLimiterKV(2000, 60));

// --- Auth Handler --- //

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = initAuth(c.env);
  return auth.handler(c.req.raw);
});

app.onError((err, c) => {
  console.error('[GlobalError]', err.message, err.stack);
  return c.json({ error: "حدث خطأ غير متوقع في الخادم، يرجى المحاولة مرة أخرى" }, 500);
});

// --- Core Endpoints --- //

app.route('/api/students', studentsRouter);
app.route('/api/finance', financeRouter);
app.route('/api/organizations', organizationsRouter);

export default app;
