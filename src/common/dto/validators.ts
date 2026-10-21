import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'iloveyou1',
  'admin12345',
  'welcome123',
  'letmein123',
  '12345678910',
  'abc123456789',
  'passw0rd123',
  'changeme123',
  'qwerty123456',
  '111111111111',
  'administrator',
]);

export function isAcceptablePasswordValue(value: unknown, email?: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < 10 || value.length > 128) return false;
  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  if (typeof email === 'string') {
    const local = email.split('@')[0].toLowerCase();
    if (local.length >= 4 && lower.includes(local)) return false;
  }
  return true;
}

/**
 * Length-based policy (NIST SP 800-63B style): 10–128 characters, no forced composition,
 * but reject very common passwords and passwords containing the e-mail local part.
 */
export function IsAcceptablePassword(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAcceptablePassword',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'Password must be 10-128 characters and must not be a common or e-mail-derived password',
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          return isAcceptablePasswordValue(value, (args.object as { email?: unknown }).email);
        },
      },
    });
  };
}
