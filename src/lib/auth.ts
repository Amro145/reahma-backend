import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "../db/index";

export const initAuth = (d1: D1Database) => betterAuth({
    database: drizzleAdapter(getDb(d1), {
        provider: "sqlite",
    }),
    trustedOrigins: ["https://client.amroaltayeb14.workers.dev", "http://localhost:3000"],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
    },
});