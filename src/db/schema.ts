import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).default(false).notNull(),
    password: text("password").notNull(),
    role: text("role", { enum: ["admin", "management", "student"] }).default("student").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});


export const students = sqliteTable("students", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").unique().references(() => user.id),
    name: text("name").notNull(),
    whatsapp: text("whatsapp"),
    requiredAmount: real("requiredAmount").notNull(),
    status: text("status", { enum: ["paid", "pending"] }).default("pending").notNull(),
    faculty: text("faculty", { enum: ["medicine", "dentistry", "engineering", "other"] }).notNull(),
    semester: text("semester", { enum: ["1", "2", "3", "4", "5", "6"] }).notNull(),
    enrollmentDate: integer("enrollmentDate", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const auditLogs = sqliteTable("auditLogs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull().references(() => user.id),
    action: text("action").notNull(),
    details: text("details"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const studentSubscriptions = sqliteTable("studentSubscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("studentId").notNull().references(() => students.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    status: text("status", { enum: ["paid", "pending"] }).notNull().default("pending"),
    monthIndex: integer("monthIndex").notNull(),
    academicYear: integer("academicYear").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
}, (t) => ({
    unq: unique().on(t.studentId, t.monthIndex, t.academicYear)
}));

export const financeLogs = sqliteTable("financeLogs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});
export const specialDonations = sqliteTable("specialDonations", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorName: text("donorName").notNull(),
    amount: real("amount").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});
