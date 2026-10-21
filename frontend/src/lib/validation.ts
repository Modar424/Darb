import { z } from 'zod';
import type { MessageKey } from '@/i18n/messages/ar';
import type { TFunction } from '@/i18n/translate';

/** Zod messages are translation keys; call `fieldMessage(t, error)` at render time. */
const k = (key: MessageKey) => key;

export const emailSchema = z
  .string()
  .trim()
  .min(1, k('val.required'))
  .max(254)
  .email(k('val.email'));
/** Mirrors the backend length policy (10–128). The server additionally rejects common passwords. */
export const passwordSchema = z.string().min(10, k('val.password')).max(128, k('val.password'));
export const nameSchema = z
  .string()
  .trim()
  .min(2, k('val.nameLength'))
  .max(120, k('val.nameLength'));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, k('val.required')).max(128),
});
export const registerSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: k('val.mismatch') });
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, k('val.required')),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: k('val.mismatch') });
export const profileSchema = z.object({
  fullName: nameSchema,
  bio: z.string().trim().max(1000, k('val.tooLong')),
});

export function fieldMessage(t: TFunction, error?: { message?: string }): string | undefined {
  if (!error?.message) return undefined;
  return t(error.message as MessageKey);
}
