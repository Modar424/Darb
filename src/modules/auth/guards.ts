import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY, SKIP_CSRF_KEY } from '../../common/decorators';
import { safeEqualHex } from '../../common/utils/crypto';
import type { AuthedRequest } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { deriveCsrfToken, SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Resolves the session cookie. Routes are deny-by-default unless marked @Public(). */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const raw: unknown = (req.cookies as Record<string, unknown> | undefined)?.[
      this.config.cookie.name
    ];
    if (typeof raw === 'string' && raw.length >= 20 && raw.length <= 128) {
      req.sessionToken = raw;
      const user = await this.sessions.authenticate(raw);
      if (user) req.user = user;
    }
    if (!req.user && !isPublic) throw new UnauthorizedException('Authentication required');
    return true;
  }
}

/** Origin allowlist + synchronizer-style CSRF token for cookie-authenticated state-changing requests. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (typeof origin === 'string' && !this.config.corsOrigins.includes(origin)) {
      throw new ForbiddenException('Origin not allowed');
    }
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip || !req.user || !req.sessionToken) return true;

    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqualHex(header, deriveCsrfToken(req.sessionToken))) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user || !required.some((r) => req.user!.roles.includes(r))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
