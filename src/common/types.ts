import type { Request } from 'express';
import { RoleName } from '../database/entities/enums';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleName[];
  sessionId: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  /** Raw opaque session token from the cookie (never logged or persisted). */
  sessionToken?: string;
  requestId?: string;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  requestId?: string;
}

export const isAdmin = (u: Pick<AuthUser, 'roles'>): boolean => u.roles.includes(RoleName.ADMIN);
export const isInstructor = (u: Pick<AuthUser, 'roles'>): boolean =>
  u.roles.includes(RoleName.INSTRUCTOR);
export const isStudent = (u: Pick<AuthUser, 'roles'>): boolean =>
  u.roles.includes(RoleName.STUDENT);
