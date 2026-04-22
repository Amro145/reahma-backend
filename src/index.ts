import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createMiddleware } from 'hono/factory';
import { Bindings, Variables } from './types';

import studentsRouter from './routes/students';
import financeRouter from './routes/finance';
import authRouter from './routes/auth';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', (c, next) => {
  const originsStr = c.env.ALLOWED_ORIGINS || '';
  const origins = originsStr ? originsStr.split(',').map(o => o.trim()) : ['http://localhost:3000'];
  
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
  const originsStr = c.env.ALLOWED_ORIGINS || '';
  const allowedOrigins = originsStr ? originsStr.split(',').map(o => o.trim()) : ['http://localhost:3000'];
  
  return cors({
    origin: (origin && allowedOrigins.includes(origin)) ? origin : allowedOrigins[0],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

app.use('/api/auth/*', rateLimiterKV(500, 60));
app.use('/api/*', rateLimiterKV(2000, 60));

app.route('/api/auth', authRouter);
app.route('/api/students', studentsRouter);
app.route('/api/finance', financeRouter);

app.get('/', (c) => c.json({ status: 'ok', message: 'RAHMA Backend API' }));

app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json({ error: 'Internal Server Error', message: String(err) }, 500);
});

export default app;