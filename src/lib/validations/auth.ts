import { z } from "zod";

const normalizedEmail = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please enter a valid email address.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password cannot be longer than 72 characters.");

export const loginSchema = z.object({
  email: normalizedEmail,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(50, "Name cannot be longer than 50 characters."),
    email: normalizedEmail,
    studentId: z
      .string()
      .trim()
      .max(30, "Student ID cannot be longer than 30 characters.")
      .optional()
      .transform((value) => value || undefined),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: normalizedEmail,
});

export const resendVerificationSchema = z.object({
  email: normalizedEmail,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Missing reset token."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
