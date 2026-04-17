import { Hono } from 'hono';
import { initAuth } from './lib/auth';

const app = new Hono<{ Bindings: { rahma_db: D1Database } }>();

app.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = initAuth(c.env.rahma_db);
    return auth.handler(c.req.raw);
});

export default app;
