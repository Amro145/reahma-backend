import { createMiddleware } from "hono/factory";
import { jwt, type JWTPayload } from "hono/jwt";
import { getDb } from "../db/index";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";
import { Bindings, Variables } from "../types";

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "") || c.req.cookie("token");
  
  if (!token) {
    return c.json({ error: "Unauthorized: No token provided" }, 401);
  }

  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
    alg: "HS256",
  });

  await jwtMiddleware(c, async () => {
    try {
      const payload = c.get("jwtPayload") as JWTPayload;
      
      if (!payload || !payload.id) {
        return c.json({ error: "Unauthorized: Invalid token" }, 401);
      }

      const db = getDb(c.env.rahma_db);
      const dbUser = await db.select().from(user).where(eq(user.id, payload.id as string)).get();

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
    } catch (err) {
      console.error('[Auth] Error:', err);
      return c.json({ error: "Unauthorized: Invalid token", details: String(err) }, 401);
    }
  });
});