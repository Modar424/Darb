import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema, registerSchema, resetSchema } from './validation';

const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe('validation schemas', () => {
  it('requires a valid e-mail and a non-empty password on login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(msgs(loginSchema.safeParse({ email: 'nope', password: '' }))).toEqual(
      expect.arrayContaining(['val.email', 'val.required']),
    );
  });
  it('enforces the 10–128 password policy on registration', () => {
    const base = { fullName: 'سارة أحمد', email: 'sara@example.com' };
    expect(registerSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(129) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'long-enough-pass' }).success).toBe(true);
  });
  it('checks the confirmation matches', () => {
    expect(
      msgs(resetSchema.safeParse({ password: 'long-enough-pass', confirm: 'different-pass1' })),
    ).toContain('val.mismatch');
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        password: 'long-enough-pass',
        confirm: 'long-enough-pass',
      }).success,
    ).toBe(true);
  });
});
