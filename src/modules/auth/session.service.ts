import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { Session, User, UserStatus } from '../../database/entities';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { randomToken, sha256Hex } from '../../common/utils/crypto';
import type { AuthUser, RequestMeta } from '../../common/types';

const TOUCH_INTERVAL_MS = 60_000;
const PURGE_INTERVAL_MS = 60 * 60_000;

/** CSRF token derived from the (HttpOnly) session token: unguessable without the cookie, no extra storage. */
export const deriveCsrfToken = (sessionToken: string): string =>
  sha256Hex(`csrf-v1:${sessionToken}`);

@Injectable()
export class SessionService {
  private lastPurge = 0;

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(
    userId: string,
    meta: RequestMeta,
  ): Promise<{ token: string; csrfToken: string; session: Session }> {
    const token = randomToken(32);
    const now = Date.now();
    const absolute = new Date(now + this.config.session.absoluteTtlHours * 3_600_000);
    const idle = new Date(
      Math.min(now + this.config.session.ttlMinutes * 60_000, absolute.getTime()),
    );
    const session = await this.sessions.save(
      this.sessions.create({
        tokenHash: sha256Hex(token),
        userId,
        expiresAt: idle,
        absoluteExpiresAt: absolute,
        lastSeenAt: new Date(now),
        revokedAt: null,
        ipAddress: meta.ip?.slice(0, 45) ?? null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      }),
    );
    void this.purgeExpired();
    return { token, csrfToken: deriveCsrfToken(token), session };
  }

  /** Resolves a cookie token to the authenticated principal, or null when invalid/expired/revoked. */
  async authenticate(token: string): Promise<AuthUser | null> {
    const session = await this.sessions.findOne({ where: { tokenHash: sha256Hex(token) } });
    if (!session || session.revokedAt) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now)
      return null;

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) return null;

    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      const idle = Math.min(
        now + this.config.session.ttlMinutes * 60_000,
        session.absoluteExpiresAt.getTime(),
      );
      await this.sessions.update(
        { id: session.id },
        { lastSeenAt: new Date(now), expiresAt: new Date(idle) },
      );
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((r) => r.name),
      sessionId: session.id,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeByToken(token: string): Promise<void> {
    await this.sessions.update(
      { tokenHash: sha256Hex(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Revokes every active session of a user, optionally keeping one (e.g. the current session). */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const where = exceptSessionId
      ? { userId, revokedAt: IsNull(), id: Not(exceptSessionId) }
      : { userId, revokedAt: IsNull() };
    await this.sessions.update(where, { revokedAt: new Date() });
  }

  private async purgeExpired(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPurge < PURGE_INTERVAL_MS) return;
    this.lastPurge = now;
    const cutoff = new Date(now - 24 * 3_600_000);
    try {
      await this.sessions.delete({ absoluteExpiresAt: LessThan(cutoff) });
    } catch {
      /* housekeeping only */
    }
  }
}
