import { Hono } from 'hono';
import { initAuth } from './lib/auth';
import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: { rahma_db: D1Database } }>();

app.get('/', (c) => c.json({ status: 'ok', message: 'RAHMA API is running' }));

app.use('/api/*', cors({
  origin: ['https://client.amroaltayeb14.workers.dev', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = initAuth(c.env);
    return auth.handler(c.req.raw);
});

export default app;
