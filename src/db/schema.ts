import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
    image: text("image"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
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
});

// --- جداول النظام المالي ---

// 1. جدول المساهمين
export const shareholders = sqliteTable("shareholders", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull().references(() => user.id), // صاحب الحساب
    name: text("name").notNull(),
    academicYear: text("academic_year").notNull(),
    whatsapp: text("whatsapp"),
    totalContribution: real("total_contribution").default(0),
});

// 2. جدول العمليات (المدخلات والمنصرفات)
export const transactions = sqliteTable("transactions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull().references(() => user.id),
    type: text("type").notNull(), // 'income' | 'expense'
    amount: real("amount").notNull(),
    description: text("description"),
    date: integer("date", { mode: "timestamp" }).notNull(),
});