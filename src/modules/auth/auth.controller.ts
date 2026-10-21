import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { AuthThrottle, CurrentUser, Meta, Public, SkipCsrf } from '../../common/decorators';
import type { AuthedRequest, AuthUser, RequestMeta } from '../../common/types';
import { Inject } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { AuthResult, AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';
import { SessionService } from './session.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private cookieBase(): CookieOptions {
    return {
      secure: this.config.cookie.secure,
      sameSite: 'lax',
      path: '/',
      ...(this.config.cookie.domain ? { domain: this.config.cookie.domain } : {}),
    };
  }

  private setCookies(res: Response, result: AuthResult): void {
    const maxAge = Math.max(0, result.expiresAt.getTime() - Date.now());
    res.cookie(this.config.cookie.name, result.token, {
      ...this.cookieBase(),
      httpOnly: true,
      maxAge,
    });
    // Readable copy of the CSRF token for same-site SPAs (double-submit convenience).
    res.cookie(this.config.cookie.csrfName, result.csrfToken, {
      ...this.cookieBase(),
      httpOnly: false,
      maxAge,
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie(this.config.cookie.name, { ...this.cookieBase(), httpOnly: true });
    res.clearCookie(this.config.cookie.csrfName, { ...this.cookieBase(), httpOnly: false });
  }

  @Public()
  @SkipCsrf()
  @AuthThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Register a new student account and start a session' })
  async register(
    @Body() dto: RegisterDto,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
    @Req() req: AuthedRequest,
  ) {
    if (req.sessionToken) await this.sessions.revokeByToken(req.sessionToken);
    const result = await this.auth.register(dto, meta);
    this.setCookies(res, result);
    return { user: result.user, csrfToken: result.csrfToken };
  }

  @Public()
  @SkipCsrf()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in; sets HttpOnly session cookie and returns the CSRF token' })
  async login(
    @Body() dto: LoginDto,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
    @Req() req: AuthedRequest,
  ) {
    // Session-fixation defence: drop any pre-existing session before issuing a fresh one.
    if (req.sessionToken) await this.sessions.revokeByToken(req.sessionToken);
    const result = await this.auth.login(dto, meta);
    this.setCookies(res, result);
    return { user: result.user, csrfToken: result.csrfToken };
  }

  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user, meta);
    this.clearCookies(res);
    return { success: true };
  }

  @ApiCookieAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user; also returns the CSRF token to send as X-CSRF-Token' })
  me(@CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    return this.auth.me(user, req.sessionToken as string);
  }

  @Public()
  @SkipCsrf()
  @AuthThrottle()
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset e-mail (always responds identically)' })
  async forgot(@Body() dto: ForgotPasswordDto, @Meta() meta: RequestMeta) {
    await this.auth.forgotPassword(dto, meta);
    return { message: 'If an account exists for this address, a reset link has been sent.' };
  }

  @Public()
  @SkipCsrf()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async reset(
    @Body() dto: ResetPasswordDto,
    @Meta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.resetPassword(dto, meta);
    this.clearCookies(res);
    return { success: true };
  }

  @ApiCookieAuth()
  @AuthThrottle()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async change(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Meta() meta: RequestMeta,
  ) {
    await this.auth.changePassword(user, dto, meta);
    return { success: true };
  }
}
