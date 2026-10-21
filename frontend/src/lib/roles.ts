import type { Role, User } from './api/types';

export const hasRole = (u: Pick<User, 'roles'> | null | undefined, ...roles: Role[]): boolean =>
  !!u && roles.some((r) => u.roles.includes(r));
export const isStaff = (u: Pick<User, 'roles'> | null | undefined): boolean =>
  hasRole(u, 'INSTRUCTOR', 'ADMIN');

/** Landing page after login. Priority: admin > instructor > student. */
export function homeFor(u: Pick<User, 'roles'> | null | undefined): string {
  if (hasRole(u, 'ADMIN')) return '/admin';
  if (hasRole(u, 'INSTRUCTOR')) return '/instructor';
  return '/student';
}

/** Only same-origin relative paths are accepted as post-login redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\'))
    return fallback;
  return next;
}
