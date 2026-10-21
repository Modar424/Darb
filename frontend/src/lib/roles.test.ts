import { describe, expect, it } from 'vitest';
import { hasRole, homeFor, isStaff, safeNext } from './roles';

describe('roles', () => {
  it('routes by highest role', () => {
    expect(homeFor({ roles: ['STUDENT'] })).toBe('/student');
    expect(homeFor({ roles: ['STUDENT', 'INSTRUCTOR'] })).toBe('/instructor');
    expect(homeFor({ roles: ['INSTRUCTOR', 'ADMIN'] })).toBe('/admin');
    expect(homeFor(null)).toBe('/student');
  });
  it('checks roles safely', () => {
    expect(hasRole({ roles: ['STUDENT'] }, 'ADMIN')).toBe(false);
    expect(hasRole(null, 'ADMIN')).toBe(false);
    expect(isStaff({ roles: ['INSTRUCTOR'] })).toBe(true);
    expect(isStaff({ roles: ['STUDENT'] })).toBe(false);
  });
  it('only accepts same-origin relative redirects', () => {
    expect(safeNext('/learn/1', '/x')).toBe('/learn/1');
    expect(safeNext('https://evil.example', '/x')).toBe('/x');
    expect(safeNext('//evil.example', '/x')).toBe('/x');
    expect(safeNext('/\\evil', '/x')).toBe('/x');
    expect(safeNext(null, '/x')).toBe('/x');
  });
});
