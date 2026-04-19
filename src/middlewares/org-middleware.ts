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

  // Better Auth may internally log errors (e.g. parsing organization metadata)
  // but still resolve the session. We use a resilient try/catch so that
  // internal Better Auth issues don't block valid authenticated requests.
  let sessionResponse;
  try {
    sessionResponse = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
  } catch (err) {
    // Only a hard throw means the session truly failed.
    console.error("[OrgMiddleware] getSession threw:", err);
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!sessionResponse || !sessionResponse.user) {
    console.warn(`[OrgMiddleware] No session for orgId: ${orgId}`);
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
    console.warn(`[OrgMiddleware] User ${userId} is not a member of org ${orgId}`);
    return c.json({ error: "Forbidden: You are not a member of this organization" }, 403);
  }

  // Inject shared context
  c.set("user", {
    id: sessionResponse.user.id,
    email: sessionResponse.user.email,
    name: sessionResponse.user.name,
  });
  c.set("session", {
    id: sessionResponse.session.id,
    activeOrganizationId: sessionResponse.session.activeOrganizationId,
  });
  c.set("orgId", orgId);
  c.set("role", membership.role as "owner" | "admin" | "member");

  await next();
});
