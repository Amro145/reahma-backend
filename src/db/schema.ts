import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
    image: text("image"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
    platform: text("platform"), // المنصة
});

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id),
    activeOrganizationId: text("activeOrganizationId"),
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
});

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
});

export const organization = sqliteTable("organization", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    logo: text("logo"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    metadata: text("metadata")
});

export const member = sqliteTable("member", {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull().references(() => organization.id),
    userId: text("userId").notNull().references(() => user.id),
    role: text("role").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
});

export const invitation = sqliteTable("invitation", {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull().references(() => organization.id),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    inviterId: text("inviterId").notNull().references(() => user.id)
});



// --- جداول إدارة النظام ---

export const students = sqliteTable("students", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: text("organizationId").notNull().references(() => organization.id),
    name: text("name").notNull(),
    whatsapp: text("whatsapp"),
    requiredAmount: real("requiredAmount").notNull(),
    status: text("status", { enum: ["paid", "pending"] }).default("pending").notNull(), // legacy, consider dropping later
    enrollmentDate: integer("enrollmentDate", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const auditLogs = sqliteTable("auditLogs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: text("organizationId").notNull().references(() => organization.id),
    userId: text("userId").notNull().references(() => user.id),
    action: text("action").notNull(), // e.g. 'UPDATE_STUDENT', 'DELETE_STUDENT'
    details: text("details"), // JSON string of changes
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const studentSubscriptions = sqliteTable("studentSubscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("studentId").notNull().references(() => students.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    status: text("status", { enum: ["paid", "pending"] }).notNull().default("pending"),
    monthIndex: integer("monthIndex").notNull(), // 1-12
    academicYear: integer("academicYear").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
    unq: unique().on(t.studentId, t.monthIndex, t.academicYear)
}));

export const financeLogs = sqliteTable("financeLogs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: text("organizationId").notNull().references(() => organization.id),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});