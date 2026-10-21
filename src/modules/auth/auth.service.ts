import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import {
  PasswordResetToken,
  Role,
  RoleName,
  Session,
  User,
  UserStatus,
} from '../../database/entities';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { isAcceptablePasswordValue } from '../../common/dto/validators';
import { randomToken, sha256Hex } from '../../common/utils/crypto';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { toUserDto, UserDto } from '../users/user.mapper';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';
import { PasswordService } from './password.service';
import { deriveCsrfToken, SessionService } from './session.service';

export interface AuthResult {
  user: UserDto;
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const PASSWORD_POLICY_ERROR =
  'Password must be 10-128 characters and must not be a common or e-mail-derived password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    // Public registration only ever creates STUDENT accounts; privileged roles are granted by admins.
    const studentRole = await this.roles.findOneByOrFail({ name: RoleName.STUDENT });
    const exists = await this.users.exist({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Registration could not be completed');

    const passwordHash = await this.passwords.hash(dto.password);
    let user: User;
    try {
      user = await this.users.save(
        this.users.create({
          email: dto.email,
          passwordHash,
          fullName: cleanText(dto.fullName),
          locale: dto.locale ?? 'ar',
          status: UserStatus.ACTIVE,
          roles: [studentRole],
          passwordChangedAt: new Date(),
          lastLoginAt: new Date(),
        }),
      );
    } catch (err) {
      // Unique-constraint race between the exist() check and the insert.
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new ConflictException('Registration could not be completed');
      throw err;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      meta,
    });
    const loaded = await this.users.findOneByOrFail({ id: user.id });
    return this.startSession(loaded, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .addSelect(['u.passwordHash', 'u.failedLoginCount', 'u.lockedUntil'])
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
      await this.passwords.burn(dto.password);
      await this.audit.record({
        action: 'LOGIN_FAILED',
        metadata: { reason: 'unknown_account' },
        meta,
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    // Always verify, even for locked/suspended accounts, so timing and responses do not reveal their state.
    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    const locked = !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();

    if (!valid || locked || user.status !== UserStatus.ACTIVE) {
      if (!valid && !locked) await this.registerFailure(user);
      await this.audit.record({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          reason: locked
            ? 'locked'
            : user.status !== UserStatus.ACTIVE
              ? 'suspended'
              : 'bad_credentials',
        },
        meta,
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const update: Partial<User> = {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    };
    if (this.passwords.needsRehash(user.passwordHash))
      update.passwordHash = await this.passwords.hash(dto.password);
    await this.users.update({ id: user.id }, update);

    await this.audit.record({
      actorId: user.id,
      action: 'LOGIN_SUCCEEDED',
      entityType: 'User',
      entityId: user.id,
      meta,
    });
    return this.startSession(user, meta);
  }

  private async registerFailure(user: User): Promise<void> {
    // A lock that has already expired starts a fresh counting window; otherwise the stale counter
    // (>= max) would re-lock the account on the very first wrong password after the lock ends.
    if (user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
      await this.users.update({ id: user.id }, { failedLoginCount: 0, lockedUntil: null });
    }
    await this.users.increment({ id: user.id }, 'failedLoginCount', 1);
    const fresh = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.failedLoginCount'])
      .where('u.id = :id', { id: user.id })
      .getOne();
    if (fresh && fresh.failedLoginCount >= this.config.login.maxFailures) {
      const lockedUntil = new Date(Date.now() + this.config.login.lockMinutes * 60_000);
      await this.users.update({ id: user.id }, { lockedUntil });
      await this.audit.record({
        actorId: user.id,
        action: 'ACCOUNT_LOCKED',
        entityType: 'User',
        entityId: user.id,
        metadata: { until: lockedUntil.toISOString() },
      });
    }
  }

  private async startSession(user: User, meta: RequestMeta): Promise<AuthResult> {
    const { token, csrfToken, session } = await this.sessions.create(user.id, meta);
    return { user: toUserDto(user), token, csrfToken, expiresAt: session.absoluteExpiresAt };
  }

  async logout(actor: AuthUser, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(actor.sessionId);
    await this.audit.record({
      actorId: actor.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: actor.id,
      meta,
    });
  }

  async me(actor: AuthUser, sessionToken: string): Promise<{ user: UserDto; csrfToken: string }> {
    const user = await this.users.findOneByOrFail({ id: actor.id });
    return { user: toUserDto(user), csrfToken: deriveCsrfToken(sessionToken) };
  }

  /**
   * Always resolves identically so callers cannot learn whether an address is registered.
   * Only the (single) account lookup runs before the response; token creation, audit and mail are
   * performed in the background so the response time does not depend on whether the account exists.
   */
  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta): Promise<void> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user || user.status !== UserStatus.ACTIVE) return;
    void this.issueResetToken(user, meta).catch((err: unknown) =>
      this.logger.error(
        'Failed to issue password reset token',
        err instanceof Error ? err.stack : undefined,
      ),
    );
  }

  private async issueResetToken(user: User, meta: RequestMeta): Promise<void> {
    // Housekeeping: expired tokens are never reusable, so they can be removed.
    await this.resetTokens.delete({ expiresAt: LessThan(new Date()) });
    await this.resetTokens.delete({ userId: user.id, usedAt: IsNull() });
    const token = randomToken(32);
    await this.resetTokens.save(
      this.resetTokens.create({
        userId: user.id,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + this.config.passwordResetTtlMinutes * 60_000),
        usedAt: null,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      meta,
    });
    const link = `${this.config.publicUrl}/reset-password?token=${token}`;
    const ttl = this.config.passwordResetTtlMinutes;
    const arabic = user.locale === 'ar';
    await this.mail.send({
      to: user.email,
      subject: arabic ? 'إعادة تعيين كلمة المرور' : 'Password reset',
      text: arabic
        ? `استخدم هذا الرابط لإعادة تعيين كلمة المرور (صالح لمدة ${ttl} دقيقة، ولمرة واحدة فقط):\n${link}`
        : `Use this link to reset your password (valid for ${ttl} minutes, single use):\n${link}`,
    });
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta): Promise<void> {
    const tokenHash = sha256Hex(dto.token);
    const invalid = () => new BadRequestException('Invalid or expired reset token');

    await this.dataSource.transaction(async (em) => {
      const record = await em
        .getRepository(PasswordResetToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.tokenHash = :tokenHash', { tokenHash })
        .getOne();
      if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw invalid();

      const user = await em.getRepository(User).findOne({ where: { id: record.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) throw invalid();
      if (!isAcceptablePasswordValue(dto.newPassword, user.email))
        throw new BadRequestException(PASSWORD_POLICY_ERROR);

      const passwordHash = await this.passwords.hash(dto.newPassword);
      await em
        .getRepository(User)
        .update(
          { id: user.id },
          { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
        );
      await em.getRepository(PasswordResetToken).update({ id: record.id }, { usedAt: new Date() });
      await em.getRepository(PasswordResetToken).delete({ userId: user.id, usedAt: IsNull() });
      await em
        .getRepository(Session)
        .update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: user.id,
          meta,
        },
        em,
      );
    });
  }

  async changePassword(actor: AuthUser, dto: ChangePasswordDto, meta: RequestMeta): Promise<void> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: actor.id })
      .getOne();
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.audit.record({
        actorId: actor.id,
        action: 'PASSWORD_CHANGE_FAILED',
        entityType: 'User',
        entityId: actor.id,
        meta,
      });
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (!isAcceptablePasswordValue(dto.newPassword, user.email))
      throw new BadRequestException(PASSWORD_POLICY_ERROR);

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.dataSource.transaction(async (em) => {
      await em
        .getRepository(User)
        .update({ id: user.id }, { passwordHash, passwordChangedAt: new Date() });
      // Credential change invalidates every other session; the current one stays signed in.
      await em
        .getRepository(Session)
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('user_id = :uid AND revoked_at IS NULL AND id <> :sid', {
          uid: user.id,
          sid: actor.sessionId,
        })
        .execute();
      await this.audit.record(
        {
          actorId: user.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: user.id,
          meta,
        },
        em,
      );
    });
  }
}
