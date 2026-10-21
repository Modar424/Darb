import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '../../database/entities/enums';
import type { AuthedRequest, AuthUser, RequestMeta } from '../types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const SKIP_CSRF_KEY = 'skipCsrf';

/** Marks a route as not requiring authentication. All other routes are deny-by-default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
/** Restricts a route to the listed roles (any authenticated user when omitted). */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
/** CSRF token is not required (pre-session endpoints such as login). Origin checks still apply. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new Error('CurrentUser used on a route without authentication');
    return req.user;
  },
);

export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().user ?? null;
  },
);

export const Meta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 255) : null,
    requestId: req.requestId,
  };
});

const envInt = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Strict per-IP limit for credential endpoints (configurable through env). */
export const AuthThrottle = () =>
  Throttle({
    default: {
      limit: () => envInt('AUTH_THROTTLE_LIMIT', 10),
      ttl: () => envInt('THROTTLE_TTL_SECONDS', 60) * 1000,
    },
  });

import { Param, ParseUUIDPipe } from '@nestjs/common';
/** Path parameter that must be a UUID (400 otherwise). */
export const UuidParam = (name = 'id') => Param(name, new ParseUUIDPipe());
