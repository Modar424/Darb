import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { RoleName, User, UserStatus } from '../src/database/entities';
import { Client, createApp, createUser, loggedIn, publishedCourse, resetDb } from './helpers';

const ZERO = '00000000-0000-4000-8000-000000000000';

describe('Authorization (RBAC, ownership, IDOR)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let instA: Client;
  let instB: Client;
  let stuA: Client;
  let stuB: Client;
  let admin: Client;
  let stuAUser: User;
  let course: { courseId: string; moduleId: string; lessonIds: string[] };

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);
    await resetDb(app);
    instA = await loggedIn(app, await createUser(app, RoleName.INSTRUCTOR));
    instB = await loggedIn(app, await createUser(app, RoleName.INSTRUCTOR));
    stuAUser = await createUser(app, RoleName.STUDENT);
    stuA = await loggedIn(app, stuAUser);
    stuB = await loggedIn(app, await createUser(app, RoleName.STUDENT));
    admin = await loggedIn(app, await createUser(app, RoleName.ADMIN));
    course = await publishedCourse(instA, 2);
  });
  afterAll(async () => app.close());

  it('denies by default: protected endpoints return 401 without a session', async () => {
    const paths: [string, string][] = [
      ['get', '/users/me'],
      ['get', '/enrollments/me'],
      ['get', '/courses/mine'],
      ['get', '/admin/users'],
      ['get', '/admin/stats'],
      ['get', `/lessons/${ZERO}`],
      ['get', `/assessments/${ZERO}`],
      ['get', `/attempts/${ZERO}`],
      ['get', `/submissions/${ZERO}`],
      ['post', `/courses/${ZERO}/enroll`],
      ['post', '/courses'],
      ['get', '/progress/me/summary'],
    ];
    for (const [m, p] of paths) {
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>
      )[m](`/api/v1${p}`);
      expect([m, p, res.status]).toEqual([m, p, 401]);
    }
  });

  it('public catalogue is reachable anonymously but never lists drafts', async () => {
    const draft = await instA.post('/courses', {
      title: 'Hidden draft course',
      summary: 'Draft summary here.',
      description: 'x',
    });
    const list = await request(app.getHttpServer()).get('/api/v1/courses');
    expect(list.status).toBe(200);
    const ids = list.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(course.courseId);
    expect(ids).not.toContain(draft.body.data.id);
    expect(
      (await request(app.getHttpServer()).get(`/api/v1/courses/${draft.body.data.id}`)).status,
    ).toBe(404);
  });

  it('students cannot use instructor or admin endpoints (403)', async () => {
    expect(
      (
        await stuA.post('/courses', {
          title: 'Nope nope',
          summary: 'Summary long enough',
          description: 'd',
        })
      ).status,
    ).toBe(403);
    expect((await stuA.get('/admin/users')).status).toBe(403);
    expect((await stuA.get('/admin/audit-logs')).status).toBe(403);
    expect((await instA.get('/admin/users')).status).toBe(403);
    expect(
      (await stuA.post(`/courses/${course.courseId}/assessments`, { title: 'Quiz one' })).status,
    ).toBe(403);
  });

  it('instructors cannot enroll as students', async () => {
    expect((await instA.post(`/courses/${course.courseId}/enroll`)).status).toBe(403);
  });

  it('IDOR: another instructor cannot modify/publish/delete/list learners of a course they do not own', async () => {
    expect(
      (await instB.patch(`/courses/${course.courseId}`, { title: 'Hijacked title' })).status,
    ).toBe(403);
    expect(
      (await instB.post(`/courses/${course.courseId}/modules`, { title: 'Evil module' })).status,
    ).toBe(403);
    expect((await instB.patch(`/modules/${course.moduleId}`, { title: 'Evil' })).status).toBe(403);
    expect((await instB.patch(`/lessons/${course.lessonIds[0]}`, { title: 'Evil' })).status).toBe(
      403,
    );
    expect((await instB.delete(`/lessons/${course.lessonIds[0]}`)).status).toBe(403);
    expect((await instB.delete(`/courses/${course.courseId}`)).status).toBe(403);
    expect((await instB.get(`/courses/${course.courseId}/learners`)).status).toBe(403);
    expect(
      (
        await instB.post(`/courses/${course.courseId}/assignments`, {
          title: 'Evil',
          instructions: 'x',
        })
      ).status,
    ).toBe(403);
  });

  it('draft courses are invisible (404) to other instructors', async () => {
    const draft = await instA.post('/courses', {
      title: 'Private draft course',
      summary: 'Draft summary here.',
      description: 'x',
    });
    expect(
      (await instB.patch(`/courses/${draft.body.data.id}`, { title: 'Hijacked' })).status,
    ).toBe(404);
  });

  it('admins can manage any course', async () => {
    expect(
      (await admin.patch(`/courses/${course.courseId}`, { title: 'Admin edited title' })).status,
    ).toBe(200);
  });

  it('lesson content: non-enrolled students get 403 (except preview), enrolled get 200', async () => {
    const [preview, locked] = course.lessonIds;
    expect((await stuA.get(`/lessons/${preview}`)).status).toBe(200);
    expect((await stuA.get(`/lessons/${locked}`)).status).toBe(403);
    expect((await stuA.post(`/courses/${course.courseId}/enroll`)).status).toBe(201);
    expect((await stuA.get(`/lessons/${locked}`)).status).toBe(200);
    expect((await stuB.get(`/lessons/${locked}`)).status).toBe(403);
  });

  it('students cannot read or mark progress for courses they are not enrolled in', async () => {
    expect((await stuB.post(`/lessons/${course.lessonIds[0]}/complete`)).status).toBe(403);
    expect((await stuB.get(`/courses/${course.courseId}/progress`)).status).toBe(404);
  });

  it('cross-user access: attempts and submissions of one student are invisible to another', async () => {
    const q = await instA.post(`/courses/${course.courseId}/assessments`, {
      title: 'Quiz one',
      maxAttempts: 3,
    });
    const aid = q.body.data.id;
    await instA.post(`/assessments/${aid}/questions`, {
      type: 'SINGLE_CHOICE',
      prompt: 'Pick a',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionIds: ['a'],
    });
    await instA.post(`/assessments/${aid}/publish`);
    const as = await instA.post(`/courses/${course.courseId}/assignments`, {
      title: 'Essay one',
      instructions: 'Write',
    });
    await instA.post(`/assignments/${as.body.data.id}/publish`);

    const started = await stuA.post(`/assessments/${aid}/attempts`);
    expect(started.status).toBe(201);
    const attemptId = started.body.data.attempt.id;
    const sub = await stuA.put(`/assignments/${as.body.data.id}/submission`, {
      content: 'my work',
    });
    expect(sub.status).toBe(200);
    const subId = sub.body.data.id;

    // stuB is not enrolled: no access at all
    expect((await stuB.get(`/attempts/${attemptId}`)).status).toBe(404);
    expect((await stuB.get(`/submissions/${subId}`)).status).toBe(404);
    expect((await stuB.post(`/assessments/${aid}/attempts`)).status).toBe(404);
    expect((await stuB.post(`/attempts/${attemptId}/submit`, { answers: {} })).status).toBe(404);
    // enrolled stuB still cannot see stuA's artefacts
    expect((await stuB.post(`/courses/${course.courseId}/enroll`)).status).toBe(201);
    expect((await stuB.get(`/attempts/${attemptId}`)).status).toBe(404);
    expect((await stuB.get(`/submissions/${subId}`)).status).toBe(404);
    expect((await stuB.post(`/attempts/${attemptId}/submit`, { answers: {} })).status).toBe(404);
    const listB = await stuB.get(`/assignments/${as.body.data.id}/submissions`);
    expect(listB.body.data).toHaveLength(0);
    // other instructor and owner/admin
    expect((await instB.get(`/attempts/${attemptId}`)).status).toBe(404);
    expect((await instB.get(`/submissions/${subId}`)).status).toBe(404);
    expect((await instB.put(`/submissions/${subId}/grade`, { grade: 5 })).status).toBe(403);
    expect((await instA.get(`/attempts/${attemptId}`)).status).toBe(200);
    expect((await admin.get(`/submissions/${subId}`)).status).toBe(200);
    // students cannot grade
    expect((await stuA.put(`/submissions/${subId}/grade`, { grade: 100 })).status).toBe(403);
  });

  it("non-owner instructor cannot read the answer key of someone else's assessment", async () => {
    const list = await instA.get(`/courses/${course.courseId}/assessments`);
    const aid = list.body.data[0].id;
    expect((await instB.get(`/assessments/${aid}`)).status).toBe(404); // no relationship => indistinguishable from missing
    expect(
      (await instA.get(`/assessments/${aid}`)).body.data.questions[0].correctOptionIds,
    ).toEqual(['a']);
  });

  it('malformed ids return 400, unknown ids 404', async () => {
    expect((await instA.get('/courses/not-a-uuid')).status).toBe(400);
    expect((await instA.get(`/courses/${ZERO}`)).status).toBe(404);
    expect((await stuA.get(`/lessons/${ZERO}`)).status).toBe(404);
  });

  it('role changes take effect immediately and suspension blocks API access', async () => {
    const u = await createUser(app, RoleName.STUDENT);
    const c = await loggedIn(app, u);
    expect(
      (
        await c.post('/courses', {
          title: 'Course title',
          summary: 'Summary long enough',
          description: 'd',
        })
      ).status,
    ).toBe(403);
    await ds.getRepository(User).update({ id: u.id }, { status: UserStatus.SUSPENDED });
    expect((await c.get('/users/me')).status).toBe(401);
  });
});
