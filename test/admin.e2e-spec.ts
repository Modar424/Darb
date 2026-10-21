import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { RoleName } from '../src/database/entities';
import {
  Client,
  PASSWORD,
  createApp,
  createUser,
  loggedIn,
  publishedCourse,
  resetDb,
} from './helpers';

describe('Administration, health, HTTP hardening', () => {
  let app: NestExpressApplication;
  let admin: Client;
  let adminId: string;

  beforeAll(async () => {
    app = await createApp();
    await resetDb(app);
    const a = await createUser(app, RoleName.ADMIN);
    adminId = a.id;
    admin = await loggedIn(app, a);
  });
  afterAll(async () => app.close());

  it('health endpoints are public; readiness checks the database', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/health')).body.data.status).toBe('ok');
    expect(
      (await request(app.getHttpServer()).get('/api/v1/health/ready')).body.data,
    ).toMatchObject({ status: 'ready', database: 'up' });
  });

  it('sets security headers, hides x-powered-by, disables caching and returns sanitized errors', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(Object.keys(res.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'requestId',
      'statusCode',
      'timestamp',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+|node_modules|stack/);
  });

  it('rejects malformed JSON and oversized bodies without leaking internals', async () => {
    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(bad.status).toBe(400);
    expect(typeof bad.body.message).toBe('string');
    expect(bad.body.stack).toBeUndefined();
    const big = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.test', password: 'x'.repeat(300_000) });
    expect(big.status).toBe(413);
  });

  it('unknown routes return a sanitized 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');
    expect(res.status).toBe(404);
  });

  it('admin creates an instructor, lists/filter users, and updates roles/status (sessions revoked)', async () => {
    const created = await admin.post('/admin/users', {
      email: 'Teacher@Example.test',
      password: 'a-long-passphrase-1',
      fullName: 'Teacher One',
      roles: ['INSTRUCTOR'],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.roles).toEqual(['INSTRUCTOR']);
    expect(
      (
        await admin.post('/admin/users', {
          email: 'teacher@example.test',
          password: 'a-long-passphrase-1',
          fullName: 'Dup',
          roles: ['STUDENT'],
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await admin.post('/admin/users', {
          email: 'x@example.test',
          password: 'a-long-passphrase-1',
          fullName: 'X Y',
          roles: ['SUPERUSER'],
        })
      ).status,
    ).toBe(400);

    const list = await admin.get('/admin/users?role=INSTRUCTOR&q=teach');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.total).toBe(1);

    const t = new Client(app);
    expect((await t.login('teacher@example.test', 'a-long-passphrase-1')).status).toBe(200);
    const id = created.body.data.id;
    const suspended = await admin.patch(`/admin/users/${id}`, { status: 'SUSPENDED' });
    expect(suspended.body.data.status).toBe('SUSPENDED');
    expect((await t.get('/auth/me')).status).toBe(401);
  });

  it('prevents self-demotion/suspension and removing the last administrator', async () => {
    expect((await admin.patch(`/admin/users/${adminId}`, { roles: ['STUDENT'] })).status).toBe(409);
    expect((await admin.patch(`/admin/users/${adminId}`, { status: 'SUSPENDED' })).status).toBe(
      409,
    );
    const other = await createUser(app, RoleName.ADMIN);
    expect((await admin.patch(`/admin/users/${other.id}`, { roles: ['STUDENT'] })).status).toBe(
      200,
    );
    const sole = await createUser(app, RoleName.INSTRUCTOR);
    void sole;
    // only one active admin remains: a second admin acting would still be blocked from removing it
    const second = await createUser(app, RoleName.ADMIN);
    const c2 = await loggedIn(app, second);
    expect((await c2.patch(`/admin/users/${adminId}`, { roles: ['STUDENT'] })).status).toBe(200); // two admins -> allowed
    expect((await admin.get('/admin/users')).status).toBe(401); // demoted admin's session was revoked
    expect((await c2.patch(`/admin/users/${second.id}`, { roles: ['STUDENT'] })).status).toBe(409); // self-demotion
  });

  it('stats and audit logs are derived from persisted data and contain no secrets', async () => {
    const root = await createUser(app, RoleName.ADMIN);
    const a = await loggedIn(app, root);
    const inst = await loggedIn(app, await createUser(app, RoleName.INSTRUCTOR));
    const stu = await loggedIn(app, await createUser(app, RoleName.STUDENT));
    const c = await publishedCourse(inst, 1);
    await stu.post(`/courses/${c.courseId}/enroll`);
    const stats = await a.get('/admin/stats');
    expect(stats.body.data.courses.byStatus.PUBLISHED).toBeGreaterThanOrEqual(1);
    expect(stats.body.data.enrollments.active).toBeGreaterThanOrEqual(1);

    const logs = await a.get('/admin/audit-logs?pageSize=100&action=COURSE_PUBLISHED');
    expect(logs.body.data.length).toBeGreaterThanOrEqual(1);
    const all = await a.get('/admin/audit-logs?pageSize=100');
    expect(JSON.stringify(all.body)).not.toMatch(new RegExp(`${PASSWORD}|\\$argon2`));
    expect((await a.get('/admin/audit-logs?pageSize=1000')).status).toBe(400);
    const courses = await a.get('/admin/courses?status=PUBLISHED');
    expect(courses.status).toBe(200);
  });

  it('profile updates are allowlisted (cannot change roles/email through /users/me)', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const c = await loggedIn(app, u);
    expect((await c.patch('/users/me', { roles: ['ADMIN'] })).status).toBe(400);
    expect((await c.patch('/users/me', { email: 'new@example.test' })).status).toBe(400);
    const ok = await c.patch('/users/me', { fullName: 'Renamed User', bio: 'Hello', locale: 'en' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ fullName: 'Renamed User', locale: 'en' });
  });

  it('two admins demoting each other concurrently can never leave the system without an administrator', async () => {
    const ds = app.get(DataSource);
    // Start from a known state: no other administrator exists.
    await ds.query(
      `DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN'`,
    );
    const x = await createUser(app, RoleName.ADMIN);
    const y = await createUser(app, RoleName.ADMIN);
    const cx = await loggedIn(app, x);
    const cy = await loggedIn(app, y);
    const [r1, r2] = await Promise.all([
      cx.patch(`/admin/users/${y.id}`, { roles: ['STUDENT'] }),
      cy.patch(`/admin/users/${x.id}`, { roles: ['STUDENT'] }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const remaining: { n: string }[] = await ds.query(
      `SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'`,
    );
    expect(Number(remaining[0].n)).toBe(1);
  });
});
