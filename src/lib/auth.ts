import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb } from "../db/index";

export const initAuth = (env: any) => betterAuth({
    database: drizzleAdapter(getDb(env.rahma_db), {
        provider: "sqlite",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "https://backend.amroaltayeb14.workers.dev",
    trustedOrigins: ["https://client.amroaltayeb14.workers.dev", "http://localhost:3000"],
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    plugins: [
        organization()
    ],
    advanced: {
        ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
        }
    }
});