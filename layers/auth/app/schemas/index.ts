import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(2).max(64),
  lastName: z.string().min(2).max(64),
});

export const forceChangePasswordSchema = z.object({
  email: z.email(),
  temporaryPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type ForceChangePasswordSchema = z.infer<typeof forceChangePasswordSchema>;
