import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PasswordResetToken, RoleName, Session, User, UserStatus } from '../src/database/entities';
import { Client, PASSWORD, createApp, createUser, loggedIn, mailOutbox, resetDb } from './helpers';

describe('Authentication & sessions', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);
  });
  beforeEach(async () => {
    await resetDb(app);
    mailOutbox(app).length = 0;
  });
  afterAll(async () => app.close());

  it('registers a STUDENT, sets HttpOnly SameSite cookie, never returns hashes', async () => {
    const res = await request(app.getHttpServer()).post(api('/auth/register')).send({
      email: 'New.User@Example.test',
      password: 'a-long-passphrase-1',
      fullName: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('new.user@example.test');
    expect(res.body.data.user.roles).toEqual(['STUDENT']);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$argon2/);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('lms_sid='),
    )!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const stored = await ds
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :e', { e: 'new.user@example.test' })
      .getOneOrFail();
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('does not allow privilege escalation through registration payload', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({
        email: 'x@example.test',
        password: 'a-long-passphrase-1',
        fullName: 'X Y',
        roles: ['ADMIN'],
      });
    expect(res.status).toBe(400);
  });

  it('rejects weak/common passwords and duplicate e-mails', async () => {
    const weak = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({ email: 'w@example.test', password: 'password123', fullName: 'Weak One' });
    expect(weak.status).toBe(400);
    const short = await request(app.getHttpServer())
      .post(api('/auth/register'))
      .send({ email: 'w@example.test', password: 'short', fullName: 'Weak One' });
    expect(short.status).toBe(400);
    const body = {
      email: 'dup@example.test',
      password: 'a-long-passphrase-1',
      fullName: 'Dup User',
    };
    expect((await request(app.getHttpServer()).post(api('/auth/register')).send(body)).status).toBe(
      201,
    );
    expect((await request(app.getHttpServer()).post(api('/auth/register')).send(body)).status).toBe(
      409,
    );
  });

  it('login uses identical generic errors for unknown user and wrong password', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const a = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: 'nobody@example.test', password: 'whatever-123456' });
    const b = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: u.email, password: 'wrong-password-123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('locks the account after repeated failures, even for the correct password, without revealing it', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: u.email, password: 'wrong-password-123' });
    }
    const res = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: u.email, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    const audits = await ds.query(`SELECT action FROM audit_logs WHERE action = 'ACCOUNT_LOCKED'`);
    expect(audits.length).toBe(1);
  });

  it('starts a fresh failure window once a lock has expired (no instant re-lock)', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: u.email, password: 'wrong-password-123' });
    }
    await ds.getRepository(User).update({ id: u.id }, { lockedUntil: new Date(Date.now() - 1000) });
    const wrong = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: u.email, password: 'wrong-password-123' });
    expect(wrong.status).toBe(401);
    const row = await ds.getRepository(User).findOneOrFail({
      where: { id: u.id },
      select: ['id', 'failedLoginCount', 'lockedUntil'],
    });
    expect(row.failedLoginCount).toBe(1);
    expect(row.lockedUntil).toBeNull();
    const ok = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email: u.email, password: PASSWORD });
    expect(ok.status).toBe(200);
  });

  it('suspended users cannot log in and existing sessions stop working', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const c = await loggedIn(app, u);
    expect((await c.get('/auth/me')).status).toBe(200);
    await ds.getRepository(User).update({ id: u.id }, { status: UserStatus.SUSPENDED });
    expect((await c.get('/auth/me')).status).toBe(401);
    expect((await new Client(app).login(u.email)).status).toBe(401);
  });

  it('/auth/me requires authentication; logout revokes the session server-side', async () => {
    expect((await request(app.getHttpServer()).get(api('/auth/me'))).status).toBe(401);
    const u = await createUser(app, RoleName.STUDENT);
    const c = await loggedIn(app, u);
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.csrfToken).toBe(c.csrf);
    const raw = c.cookieHeader;
    expect((await c.post('/auth/logout')).status).toBe(200);
    expect((await c.get('/auth/me')).status).toBe(401);
    // replaying the old cookie value must fail too (revoked, not just cleared client-side)
    const replay = await request(app.getHttpServer()).get(api('/auth/me')).set('Cookie', raw);
    expect(replay.status).toBe(401);
  });

  it('expired (idle and absolute) sessions are rejected', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const c = await loggedIn(app, u);
    await ds
      .getRepository(Session)
      .update({ userId: u.id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await c.get('/auth/me')).status).toBe(401);
    const c2 = await loggedIn(app, u);
    await ds.getRepository(Session).update(
      { userId: u.id },
      {
        absoluteExpiresAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 100000),
      },
    );
    expect((await c2.get('/auth/me')).status).toBe(401);
  });

  it('CSRF: state-changing requests need the token; foreign Origin is rejected', async () => {
    const u = await createUser(app, RoleName.INSTRUCTOR);
    const c = await loggedIn(app, u);
    const body = { title: 'Course Title', summary: 'Long enough summary', description: 'd' };
    const noToken = await c.agent.post(api('/courses')).send(body);
    expect(noToken.status).toBe(403);
    const badToken = await c.agent.post(api('/courses')).set('X-CSRF-Token', 'nope').send(body);
    expect(badToken.status).toBe(403);
    const evil = await c.agent
      .post(api('/courses'))
      .set('X-CSRF-Token', c.csrf!)
      .set('Origin', 'https://evil.example')
      .send(body);
    expect(evil.status).toBe(403);
    const ok = await c.agent
      .post(api('/courses'))
      .set('X-CSRF-Token', c.csrf!)
      .set('Origin', 'http://localhost:3000')
      .send(body);
    expect(ok.status).toBe(201);
  });

  it('CORS only echoes allowed origins', async () => {
    const ok = await request(app.getHttpServer())
      .options(api('/courses'))
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app.getHttpServer())
      .options(api('/courses'))
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  describe('password recovery', () => {
    it('responds identically for known and unknown addresses and only mails real accounts', async () => {
      const u = await createUser(app, RoleName.STUDENT);
      const known = await request(app.getHttpServer())
        .post(api('/auth/forgot-password'))
        .send({ email: u.email });
      const unknown = await request(app.getHttpServer())
        .post(api('/auth/forgot-password'))
        .send({ email: 'ghost@example.test' });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
      await new Promise((r) => setTimeout(r, 300));
      expect(mailOutbox(app)).toHaveLength(1);
    });

    it('stores only a hash, is single-use, and revokes all sessions on reset', async () => {
      const u = await createUser(app, RoleName.STUDENT);
      const c = await loggedIn(app, u);
      await request(app.getHttpServer())
        .post(api('/auth/forgot-password'))
        .send({ email: u.email });
      await new Promise((r) => setTimeout(r, 300));
      const token = /token=([\w-]+)/.exec(mailOutbox(app)[0].text)![1];
      const rows = await ds.getRepository(PasswordResetToken).find();
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).not.toContain(token);

      const newPw = 'brand-new-passphrase-9';
      const ok = await request(app.getHttpServer())
        .post(api('/auth/reset-password'))
        .send({ token, newPassword: newPw });
      expect(ok.status).toBe(200);
      const again = await request(app.getHttpServer())
        .post(api('/auth/reset-password'))
        .send({ token, newPassword: 'another-passphrase-10' });
      expect(again.status).toBe(400);
      expect((await c.get('/auth/me')).status).toBe(401); // old session revoked
      expect((await new Client(app).login(u.email, PASSWORD)).status).toBe(401);
      expect((await new Client(app).login(u.email, newPw)).status).toBe(200);
    });

    it('rejects expired and malformed tokens and weak new passwords', async () => {
      const u = await createUser(app, RoleName.STUDENT);
      await request(app.getHttpServer())
        .post(api('/auth/forgot-password'))
        .send({ email: u.email });
      await new Promise((r) => setTimeout(r, 300));
      const token = /token=([\w-]+)/.exec(mailOutbox(app)[0].text)![1];
      const weak = await request(app.getHttpServer())
        .post(api('/auth/reset-password'))
        .send({ token, newPassword: 'password123' });
      expect(weak.status).toBe(400);
      await ds.query('UPDATE password_reset_tokens SET expires_at = ?', [
        new Date(Date.now() - 1000),
      ]);
      const expired = await request(app.getHttpServer())
        .post(api('/auth/reset-password'))
        .send({ token, newPassword: 'brand-new-passphrase-9' });
      expect(expired.status).toBe(400);
      const bogus = await request(app.getHttpServer())
        .post(api('/auth/reset-password'))
        .send({ token: 'x'.repeat(43), newPassword: 'brand-new-passphrase-9' });
      expect(bogus.status).toBe(400);
    });
  });

  it('change-password verifies the current password and revokes OTHER sessions only', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const a = await loggedIn(app, u);
    const b = await loggedIn(app, u);
    expect(
      (
        await a.post('/auth/change-password', {
          currentPassword: 'wrong',
          newPassword: 'brand-new-passphrase-9',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await a.post('/auth/change-password', {
          currentPassword: PASSWORD,
          newPassword: 'brand-new-passphrase-9',
        })
      ).status,
    ).toBe(200);
    expect((await a.get('/auth/me')).status).toBe(200);
    expect((await b.get('/auth/me')).status).toBe(401);
  });

  it('audit log never contains credentials or tokens', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    await new Client(app).login(u.email, 'wrong-password-abc');
    await loggedIn(app, u);
    await request(app.getHttpServer()).post(api('/auth/forgot-password')).send({ email: u.email });
    await new Promise((r) => setTimeout(r, 300));
    const dump = JSON.stringify(await ds.query('SELECT * FROM audit_logs'));
    expect(dump).not.toContain('wrong-password-abc');
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toMatch(/\$argon2|token=/);
  });
});

describe('Rate limiting on auth endpoints', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = '3';
    app = await createApp();
  });
  afterAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = '1000';
    await app.close();
  });

  it('returns 429 after the configured number of attempts', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'a@example.test', password: 'wrong-password-123' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
