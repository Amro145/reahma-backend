import { createMiddleware } from "hono/factory";
import { jwt } from "hono/jwt";
import { getDb } from "../db/index";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";
import { Bindings, Variables } from "../types";

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
    cookie: "token",
  });

  await jwtMiddleware(c, async () => {
    const payload = c.get("jwtPayload");
    
    if (!payload || !payload.id) {
      return c.json({ error: "Unauthorized: Invalid token" }, 401);
    }

    const db = getDb(c.env.rahma_db);
    const dbUser = await db.select().from(user).where(eq(user.id, payload.id)).get();

    if (!dbUser) {
      return c.json({ error: "Unauthorized: User not found" }, 401);
    }

    c.set("user", {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    });

    await next();
  });
});