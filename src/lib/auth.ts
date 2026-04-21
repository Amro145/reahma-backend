import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb } from "../db/index";

type Env = {
  rahma_db: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_ORIGINS: string;
};

export const initAuth = (env: Env) => betterAuth({
    database: drizzleAdapter(getDb(env.rahma_db), {
        provider: "sqlite",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "https://backend.amroaltayeb14.workers.dev",
    trustedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || [],
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
    },
    emailAndPassword: {
        enabled: true
    },
    plugins: [
        organization()
    ],
    advanced: {
        ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
        },
        // Prevent Better Auth from making internal fetch requests to itself
        // (which fail in Workers environment because there's no BETTER_AUTH_URL)
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
        },
    },
    session: {
        // Shorter cache to ensure fresh session data
        cookieCache: {
            enabled: false,
        }
    }
});