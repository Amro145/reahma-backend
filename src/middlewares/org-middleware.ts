import { createMiddleware } from "hono/factory";
import { initAuth } from "../lib/auth";
import { getDb } from "../db/index";
import { member } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { Bindings, Variables } from "../types";

/**
 * Strict Tenant Isolation Middleware
 * Enforces that the request has a valid x-organization-id header 
 * and that the user is a member of said organization.
 */
export const orgMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const orgId = c.req.header("x-organization-id");
  
  if (!orgId) {
    return c.json({ error: "Missing x-organization-id header" }, 400);
  }

  const auth = initAuth(c.env);
  const sessionResponse = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionResponse || !sessionResponse.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb(c.env.rahma_db);
  const userId = sessionResponse.user.id;

  // Verify membership and fetch role
  const membership = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, orgId),
        eq(member.userId, userId)
      )
    )
    .get();

  if (!membership) {
    return c.json({ error: "Forbidden: You are not a member of this organization" }, 403);
  }

  // Inject shared context
  c.set("user", sessionResponse.user as any);
  c.set("session", sessionResponse.session as any);
  c.set("orgId", orgId);
  c.set("role", membership.role as 'owner' | 'admin' | 'member');

  await next();
});
