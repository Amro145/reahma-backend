import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb } from "../db/index";
import { member } from "../db/schema";

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
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    const db = getDb(env.rahma_db);
                    try {
                        // Automatically join the headquarters organization as an admin
                        await db.insert(member).values({
                            id: `mem_${crypto.randomUUID()}`,
                            userId: user.id,
                            organizationId: 'org_hq_001',
                            role: 'admin',
                            createdAt: new Date()
                        }).run();
                    } catch (error) {
                        console.error("Failed to auto-join organization:", error);
                    }
                }
            }
        }
    },
    advanced: {
        ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
        }
    }
});