import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(100, "كلمة المرور يجب أن لا تتجاوز 100 حرف"),
  name: z.string().min(2, "اسم المستخدم يجب أن يكون حرفين على الأقل").max(100, "اسم المستخدم يجب أن لا يتجاوز 100 حرف"),
  whatsapp: z.string().regex(/^\+?\d+$/, "رقم الهاتف غير صالح").min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل").max(25, "رقم الهاتف يجب أن لا يتجاوز 25 رقم").optional(),
  requiredAmount: z.number().positive("المبلغ المطلوب يجب أن يكون أكبر من 0").max(10000000, "المبلغ المطلوب يجب أن لا يتجاوز 10000000"),
  faculty: z.enum(['medicine', 'dentistry', 'engineering', 'other']),
  semester: z.enum(['1', '2', '3', '4', '5', '6']),
});

export const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const studentSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100, "الاسم يجب أن لا يتجاوز 100 حرف"),
  whatsapp: z.string().regex(/^\+?\d+$/, "رقم الهاتف غير صالح").min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل").max(25, "رقم الهاتف يجب أن لا يتجاوز 25 رقم").optional(),
  requiredAmount: z.number().positive("المبلغ المطلوب يجب أن يكون أكبر من 0").max(10000000, "المبلغ المطلوب يجب أن لا يتجاوز 10000000"),
  faculty: z.enum(['medicine', 'dentistry', 'engineering', 'other'] as const),
  semester: z.enum(['1', '2', '3', '4', '5', '6'] as const),
});

export const paymentSchema = z.object({
  monthIndex: z.number().min(1, "الشهر يجب أن يكون بين 1 و 12").max(12, "الشهر يجب أن يكون بين 1 و 12"),
  academicYear: z.number().min(2024, "السنة الأكاديمية غير صالحة").max(2100, "السنة الأكاديمية غير صالحة"),
  amount: z.number().nonnegative("المبلغ يجب أن يكون صفر أو أكبر"),
});

export const donationSchema = z.object({
  donorName: z.string().min(1, "اسم المتبرع مطلوب").max(100, "اسم المتبرع يجب أن لا يتجاوز 100 حرف"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من 0"),
});

export const financeLogSchema = z.object({
  type: z.enum(['income', 'expense'] as const),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من 0"),
  category: z.string().min(1, "التصنيف مطلوب"),
  description: z.string().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'management', 'student'] as const),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type DonationInput = z.infer<typeof donationSchema>;
export type FinanceLogInput = z.infer<typeof financeLogSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
