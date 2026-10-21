import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AssessmentAttempt, RoleName } from '../src/database/entities';
import { Client, createApp, createUser, loggedIn, publishedCourse, resetDb } from './helpers';

describe('Domain workflows (courses, progress, quizzes, assignments)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let inst: Client;
  let stu: Client;
  let stu2: Client;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);
  });
  beforeEach(async () => {
    await resetDb(app);
    inst = await loggedIn(app, await createUser(app, RoleName.INSTRUCTOR));
    stu = await loggedIn(app, await createUser(app, RoleName.STUDENT));
    stu2 = await loggedIn(app, await createUser(app, RoleName.STUDENT));
  });
  afterAll(async () => app.close());

  describe('courses', () => {
    it('cannot publish an empty course; publishing makes it public; lifecycle rules hold', async () => {
      const c = await inst.post('/courses', {
        title: 'Lifecycle course',
        summary: 'Summary long enough',
        description: 'd',
      });
      const id = c.body.data.id;
      expect((await inst.post(`/courses/${id}/publish`)).status).toBe(409);
      const m = await inst.post(`/courses/${id}/modules`, { title: 'M1' });
      await inst.post(`/modules/${m.body.data.id}/lessons`, { title: 'L1', content: 'x' });
      expect((await inst.post(`/courses/${id}/publish`)).status).toBe(200);
      expect((await inst.post(`/courses/${id}/publish`)).status).toBe(409);
      expect((await inst.delete(`/courses/${id}`)).status).toBe(409); // published
      expect((await inst.post(`/courses/${id}/unpublish`)).status).toBe(200);
      expect((await inst.delete(`/courses/${id}`)).status).toBe(200);
      expect((await inst.get(`/courses/${id}`)).status).toBe(404);
    });

    it('validates input: unknown fields, bad enums, bad URLs, content rules', async () => {
      expect(
        (
          await inst.post('/courses', {
            title: 'Valid title',
            summary: 'Summary long enough',
            description: 'd',
            status: 'PUBLISHED',
          })
        ).status,
      ).toBe(400);
      expect(
        (await inst.post('/courses', { title: 'ab', summary: 'short', description: '' })).status,
      ).toBe(400);
      const c = await inst.post('/courses', {
        title: 'Valid title',
        summary: 'Summary long enough',
        description: 'd',
      });
      const m = await inst.post(`/courses/${c.body.data.id}/modules`, { title: 'M1' });
      expect(
        (
          await inst.post(`/modules/${m.body.data.id}/lessons`, {
            title: 'Video',
            contentType: 'VIDEO',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await inst.post(`/modules/${m.body.data.id}/lessons`, {
            title: 'Video',
            contentType: 'VIDEO',
            contentUrl: 'javascript:alert(1)',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await inst.post(`/modules/${m.body.data.id}/lessons`, {
            title: 'Video',
            contentType: 'VIDEO',
            contentUrl: 'https://example.com/v.mp4',
          })
        ).status,
      ).toBe(201);
      expect(
        (await inst.post(`/modules/${m.body.data.id}/lessons`, { title: 'Text only' })).status,
      ).toBe(400);
    });

    it('pagination is bounded and sorting/filtering is allowlisted', async () => {
      await publishedCourse(inst);
      const pub = (q: string) => request(app.getHttpServer()).get(`/api/v1/courses${q}`);
      expect((await pub('?pageSize=101')).status).toBe(400);
      expect((await pub('?page=0')).status).toBe(400);
      expect((await pub('?sort=passwordHash:asc')).status).toBe(400);
      expect((await pub('?sort=title:sideways')).status).toBe(400);
      const ok = await pub('?sort=title:asc&pageSize=5&q=Test');
      expect(ok.status).toBe(200);
      expect(ok.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 1 });
      const inj = await pub(`?q=${encodeURIComponent("' OR 1=1 --")}`);
      expect(inj.status).toBe(200);
      expect(inj.body.data).toHaveLength(0);
      expect((await pub(`?q=${encodeURIComponent('%')}`)).body.data).toHaveLength(0); // wildcard escaped
    });

    it('structure with learners cannot be deleted; reorder validates exact id set', async () => {
      const c = await publishedCourse(inst, 2);
      expect(
        (
          await inst.put(`/modules/${c.moduleId}/lessons/order`, {
            ids: [...c.lessonIds].reverse(),
          })
        ).status,
      ).toBe(200);
      expect(
        (await inst.put(`/modules/${c.moduleId}/lessons/order`, { ids: [c.lessonIds[0]] })).status,
      ).toBe(400);
      await stu.post(`/courses/${c.courseId}/enroll`);
      expect((await inst.delete(`/lessons/${c.lessonIds[0]}`)).status).toBe(409);
      expect((await inst.delete(`/modules/${c.moduleId}`)).status).toBe(409);
      expect((await inst.post(`/courses/${c.courseId}/unpublish`)).status).toBe(409);
      expect((await inst.post(`/courses/${c.courseId}/archive`)).status).toBe(200);
      expect((await stu.post(`/courses/${c.courseId}/enroll`)).status).toBe(404); // archived: no new enrolments
      expect((await stu.get(`/lessons/${c.lessonIds[1]}`)).status).toBe(200); // existing learner keeps access
    });
  });

  describe('enrollment & progress', () => {
    it('enrols once (409 on duplicate), tracks progress from persisted data, completes the course', async () => {
      const c = await publishedCourse(inst, 3);
      expect((await stu.post(`/courses/${c.courseId}/enroll`)).status).toBe(201);
      expect((await stu.post(`/courses/${c.courseId}/enroll`)).status).toBe(409);

      const r1 = await stu.post(`/lessons/${c.lessonIds[0]}/complete`);
      expect(r1.body.data).toMatchObject({
        completedLessons: 1,
        totalLessons: 3,
        percent: 33,
        courseStatus: 'ACTIVE',
      });
      const again = await stu.post(`/lessons/${c.lessonIds[0]}/complete`); // idempotent
      expect(again.body.data.completedLessons).toBe(1);
      await stu.post(`/lessons/${c.lessonIds[1]}/complete`);
      const done = await stu.post(`/lessons/${c.lessonIds[2]}/complete`);
      expect(done.body.data).toMatchObject({ percent: 100, courseStatus: 'COMPLETED' });

      const prog = await stu.get(`/courses/${c.courseId}/progress`);
      expect(prog.body.data).toMatchObject({ enrollmentStatus: 'COMPLETED', percent: 100 });
      expect(prog.body.data.completedAt).not.toBeNull();
      const summary = await stu.get('/progress/me/summary');
      expect(summary.body.data).toMatchObject({
        enrolledCourses: 1,
        completedCourses: 1,
        averageProgressPercent: 100,
        lessonsCompleted: 3,
      });
      const un = await stu.delete(`/lessons/${c.lessonIds[2]}/complete`);
      expect(un.body.data).toMatchObject({ courseStatus: 'ACTIVE', percent: 67 });
      expect((await stu.delete(`/courses/${c.courseId}/enroll`)).status).toBe(200);
    });

    it('adding a lesson re-opens completed enrollments so status matches progress', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const done = await stu.post(`/lessons/${c.lessonIds[0]}/complete`);
      expect(done.body.data.courseStatus).toBe('COMPLETED');
      const add = await inst.post(`/modules/${c.moduleId}/lessons`, {
        title: 'Late addition',
        content: 'More',
      });
      expect(add.status).toBe(201);
      const prog = await stu.get(`/courses/${c.courseId}/progress`);
      expect(prog.body.data).toMatchObject({
        enrollmentStatus: 'ACTIVE',
        totalLessons: 2,
        percent: 50,
      });
      expect(prog.body.data.completedAt).toBeNull();
    });

    it('instructor sees learners with progress; learners cannot', async () => {
      const c = await publishedCourse(inst, 2);
      await stu.post(`/courses/${c.courseId}/enroll`);
      await stu.post(`/lessons/${c.lessonIds[0]}/complete`);
      const learners = await inst.get(`/courses/${c.courseId}/learners`);
      expect(learners.status).toBe(200);
      expect(learners.body.data[0].progress).toMatchObject({ completedLessons: 1, percent: 50 });
      const studentId = learners.body.data[0].student.id;
      expect((await inst.get(`/courses/${c.courseId}/learners/${studentId}/progress`)).status).toBe(
        200,
      );
      expect((await stu.get(`/courses/${c.courseId}/learners`)).status).toBe(403);
    });

    it('concurrent duplicate enrolments yield exactly one enrollment row', async () => {
      const c = await publishedCourse(inst, 1);
      const results = await Promise.all(
        Array.from({ length: 6 }, () => stu.post(`/courses/${c.courseId}/enroll`)),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(5);
      const [{ n }] = await ds.query('SELECT COUNT(*) n FROM enrollments');
      expect(Number(n)).toBe(1);
    });

    it('re-enrolling after dropping restores access without duplicating rows', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      await stu.delete(`/courses/${c.courseId}/enroll`);
      expect((await stu.get(`/courses/${c.courseId}/progress`)).status).toBe(404);
      expect((await stu.post(`/courses/${c.courseId}/enroll`)).status).toBe(201);
      const [{ n }] = await ds.query('SELECT COUNT(*) n FROM enrollments');
      expect(Number(n)).toBe(1);
    });
  });

  describe('assessments', () => {
    async function setupQuiz(course: { courseId: string }, over: object = {}) {
      const a = await inst.post(`/courses/${course.courseId}/assessments`, {
        title: 'Quiz',
        maxAttempts: 2,
        passingPercent: 50,
        ...over,
      });
      const id = a.body.data.id;
      const q1 = await inst.post(`/assessments/${id}/questions`, {
        type: 'SINGLE_CHOICE',
        prompt: 'Q1',
        points: 2,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['b'],
        explanation: 'because',
      });
      const q2 = await inst.post(`/assessments/${id}/questions`, {
        type: 'MULTIPLE_CHOICE',
        prompt: 'Q2',
        points: 2,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
        ],
        correctOptionIds: ['a', 'c'],
      });
      expect((await inst.post(`/assessments/${id}/publish`)).status).toBe(200);
      return { id, q1: q1.body.data.id as string, q2: q2.body.data.id as string };
    }

    it('validates question definitions', async () => {
      const c = await publishedCourse(inst, 1);
      const a = await inst.post(`/courses/${c.courseId}/assessments`, { title: 'Quiz' });
      const base = {
        type: 'SINGLE_CHOICE',
        prompt: 'Q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      };
      expect(
        (
          await inst.post(`/assessments/${a.body.data.id}/questions`, {
            ...base,
            correctOptionIds: ['zzz'],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await inst.post(`/assessments/${a.body.data.id}/questions`, {
            ...base,
            correctOptionIds: ['a', 'b'],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await inst.post(`/assessments/${a.body.data.id}/questions`, {
            ...base,
            options: [
              { id: 'a', text: 'A' },
              { id: 'a', text: 'dup' },
            ],
            correctOptionIds: ['a'],
          })
        ).status,
      ).toBe(400);
      expect((await inst.post(`/assessments/${a.body.data.id}/publish`)).status).toBe(409); // no questions
    });

    it('never leaks the answer key to students; grades server-side; enforces attempts and review policy', async () => {
      const c = await publishedCourse(inst, 1);
      const quiz = await setupQuiz(c);
      await stu.post(`/courses/${c.courseId}/enroll`);

      const meta = await stu.get(`/assessments/${quiz.id}`);
      expect(meta.status).toBe(200);
      expect(JSON.stringify(meta.body)).not.toMatch(/correctOptionIds|explanation/);
      expect(meta.body.data.questions).toBeUndefined();

      const start = await stu.post(`/assessments/${quiz.id}/attempts`);
      expect(start.status).toBe(201);
      expect(JSON.stringify(start.body)).not.toMatch(/correctOptionIds|explanation|because/);
      expect(start.body.data.questions).toHaveLength(2);
      const attemptId = start.body.data.attempt.id;
      // resuming returns the same attempt
      const resume = await stu.post(`/assessments/${quiz.id}/attempts`);
      expect(resume.body.data.attempt.id).toBe(attemptId);
      // while in progress the GET must not leak the key either
      expect(JSON.stringify((await stu.get(`/attempts/${attemptId}`)).body)).not.toMatch(
        /correctOptionIds|because/,
      );

      // invalid answers rejected, attempt stays open
      expect(
        (await stu.post(`/attempts/${attemptId}/submit`, { answers: { [quiz.q1]: ['nope'] } }))
          .status,
      ).toBe(400);
      expect(
        (await stu.post(`/attempts/${attemptId}/submit`, { answers: { [quiz.q1]: ['a', 'b'] } }))
          .status,
      ).toBe(400);
      expect(
        (
          await stu.post(`/attempts/${attemptId}/submit`, {
            answers: { '00000000-0000-4000-8000-000000000000': ['a'] },
          })
        ).status,
      ).toBe(400);

      const res = await stu.post(`/attempts/${attemptId}/submit`, {
        answers: { [quiz.q1]: ['b'], [quiz.q2]: ['a'] },
      }); // q2 partially right => 0
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'SUBMITTED',
        score: 2,
        maxScore: 4,
        percent: 50,
        passed: true,
      });
      expect(res.body.data.review).toHaveLength(2);
      expect(res.body.data.review[0]).toMatchObject({
        correct: true,
        correctOptionIds: ['b'],
        explanation: 'because',
      });

      expect((await stu.post(`/attempts/${attemptId}/submit`, { answers: {} })).status).toBe(409); // no double submit
      // second attempt allowed, third not
      const s2 = await stu.post(`/assessments/${quiz.id}/attempts`);
      expect(s2.status).toBe(201);
      await stu.post(`/attempts/${s2.body.data.attempt.id}/submit`, { answers: {} });
      expect((await stu.post(`/assessments/${quiz.id}/attempts`)).status).toBe(409);
      const list = await stu.get(`/assessments/${quiz.id}/attempts`);
      expect(list.body.data).toHaveLength(2);
    });

    it('passingPercent is frozen once attempts exist (stored results stay consistent)', async () => {
      const c = await publishedCourse(inst, 1);
      const quiz = await setupQuiz(c);
      expect((await inst.patch(`/assessments/${quiz.id}`, { passingPercent: 70 })).status).toBe(
        200,
      );
      await stu.post(`/courses/${c.courseId}/enroll`);
      expect((await stu.post(`/assessments/${quiz.id}/attempts`)).status).toBe(201);
      expect((await inst.patch(`/assessments/${quiz.id}`, { passingPercent: 10 })).status).toBe(
        409,
      );
      expect((await inst.patch(`/assessments/${quiz.id}`, { passingPercent: 70 })).status).toBe(
        200,
      );
    });

    it('review policy NEVER hides answers from students but not from staff', async () => {
      const c = await publishedCourse(inst, 1);
      const quiz = await setupQuiz(c, { reviewPolicy: 'NEVER' });
      await stu.post(`/courses/${c.courseId}/enroll`);
      const start = await stu.post(`/assessments/${quiz.id}/attempts`);
      const res = await stu.post(`/attempts/${start.body.data.attempt.id}/submit`, {
        answers: { [quiz.q1]: ['b'] },
      });
      expect(res.body.data.percent).toBe(25 * 2);
      expect(res.body.data.review).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/correctOptionIds|because/);
      const staff = await inst.get(`/attempts/${start.body.data.attempt.id}`);
      expect(staff.body.data.review).toHaveLength(2);
    });

    it('enforces time limit server-side and closes expired attempts without a score', async () => {
      const c = await publishedCourse(inst, 1);
      const quiz = await setupQuiz(c, { timeLimitMinutes: 5 });
      await stu.post(`/courses/${c.courseId}/enroll`);
      const start = await stu.post(`/assessments/${quiz.id}/attempts`);
      const id = start.body.data.attempt.id;
      await ds
        .getRepository(AssessmentAttempt)
        .update({ id }, { deadlineAt: new Date(Date.now() - 60_000) });
      const late = await stu.post(`/attempts/${id}/submit`, { answers: { [quiz.q1]: ['b'] } });
      expect(late.status).toBe(409);
      const row = await ds.getRepository(AssessmentAttempt).findOneByOrFail({ id });
      expect(row.status).toBe('EXPIRED');
      expect(row.score).toBe(0);
      expect(row.answers).toBeNull();
    });

    it('closed windows block starts; questions are frozen once attempts exist; concurrent double submit scores once', async () => {
      const c = await publishedCourse(inst, 1);
      const closed = await setupQuiz(c, {
        availableFrom: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await stu.post(`/courses/${c.courseId}/enroll`);
      expect((await stu.post(`/assessments/${closed.id}/attempts`)).status).toBe(409);

      const quiz = await setupQuiz(c);
      const start = await stu.post(`/assessments/${quiz.id}/attempts`);
      expect(
        (
          await inst.post(`/assessments/${quiz.id}/questions`, {
            type: 'TRUE_FALSE',
            prompt: 'x',
            options: [
              { id: 't', text: 'T' },
              { id: 'f', text: 'F' },
            ],
            correctOptionIds: ['t'],
          })
        ).status,
      ).toBe(409);
      expect((await inst.delete(`/assessments/${quiz.id}`)).status).toBe(409);
      const attemptId = start.body.data.attempt.id;
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          stu.post(`/attempts/${attemptId}/submit`, { answers: { [quiz.q1]: ['b'] } }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });

    it('concurrent start requests create a single attempt', async () => {
      const c = await publishedCourse(inst, 1);
      const quiz = await setupQuiz(c);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const rs = await Promise.all(
        Array.from({ length: 5 }, () => stu.post(`/assessments/${quiz.id}/attempts`)),
      );
      expect(rs.every((r) => r.status === 201)).toBe(true);
      const [{ n }] = await ds.query('SELECT COUNT(*) n FROM assessment_attempts');
      expect(Number(n)).toBe(1);
    });

    it('draft assessments are invisible to students', async () => {
      const c = await publishedCourse(inst, 1);
      const a = await inst.post(`/courses/${c.courseId}/assessments`, { title: 'Draft quiz' });
      await stu.post(`/courses/${c.courseId}/enroll`);
      expect((await stu.get(`/assessments/${a.body.data.id}`)).status).toBe(404);
      expect((await stu.get(`/courses/${c.courseId}/assessments`)).body.data).toHaveLength(0);
      expect((await stu2.post(`/assessments/${a.body.data.id}/attempts`)).status).toBe(404);
    });
  });

  describe('assignments', () => {
    it('submit, resubmit before grading, grade within range, lock after grading, student sees feedback', async () => {
      const c = await publishedCourse(inst, 1);
      const a = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Essay',
        instructions: 'Write it',
        maxPoints: 50,
      });
      const id = a.body.data.id;
      await stu.post(`/courses/${c.courseId}/enroll`);
      expect((await stu.put(`/assignments/${id}/submission`, { content: 'early' })).status).toBe(
        404,
      ); // still draft
      await inst.post(`/assignments/${id}/publish`);

      const s1 = await stu.put(`/assignments/${id}/submission`, { content: 'v1' });
      expect(s1.status).toBe(200);
      const s2 = await stu.put(`/assignments/${id}/submission`, {
        content: 'v2',
        linkUrl: 'https://example.com/work',
      });
      expect(s2.body.data.id).toBe(s1.body.data.id);
      expect(s2.body.data.content).toBe('v2');
      expect(
        (await stu.put(`/assignments/${id}/submission`, { content: 'x', linkUrl: 'ftp://bad' }))
          .status,
      ).toBe(400);

      expect((await inst.put(`/submissions/${s1.body.data.id}/grade`, { grade: 51 })).status).toBe(
        400,
      );
      expect((await inst.put(`/submissions/${s1.body.data.id}/grade`, { grade: -1 })).status).toBe(
        400,
      );
      const g = await inst.put(`/submissions/${s1.body.data.id}/grade`, {
        grade: 45,
        feedback: 'Well done',
      });
      expect(g.status).toBe(200);
      expect(g.body.data).toMatchObject({ status: 'GRADED', grade: 45 });

      expect(
        (await stu.put(`/assignments/${id}/submission`, { content: 'sneaky change' })).status,
      ).toBe(409);
      const mine = await stu.get(`/submissions/${s1.body.data.id}`);
      expect(mine.body.data).toMatchObject({ grade: 45, feedback: 'Well done', status: 'GRADED' });
      const list = await inst.get(`/assignments/${id}/submissions?status=GRADED`);
      expect(list.body.data).toHaveLength(1);
      expect((await inst.patch(`/assignments/${id}`, { maxPoints: 10 })).status).toBe(409);
    });

    it("assignment detail returns the learner's own submission summary (and never another learner's)", async () => {
      const c = await publishedCourse(inst, 1);
      const a = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Detail',
        instructions: 'Write it',
        maxPoints: 10,
      });
      const id = a.body.data.id;
      await stu.post(`/courses/${c.courseId}/enroll`);
      await inst.post(`/assignments/${id}/publish`);
      const before = await stu.get(`/assignments/${id}`);
      expect(before.status).toBe(200);
      expect(before.body.data.mySubmission).toBeNull();
      const sub = await stu.put(`/assignments/${id}/submission`, { content: 'mine' });
      const after = await stu.get(`/assignments/${id}`);
      expect(after.body.data.mySubmission).toEqual({
        id: sub.body.data.id,
        status: 'SUBMITTED',
        grade: null,
      });
      // Staff view has no learner-specific field.
      const staff = await inst.get(`/assignments/${id}`);
      expect(staff.body.data.mySubmission).toBeUndefined();
    });

    it('enforces deadlines: rejects late when disallowed, flags late when allowed', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const past = new Date(Date.now() - 3_600_000).toISOString();
      const strict = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Strict',
        instructions: 'x',
        dueAt: past,
      });
      const lenient = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Lenient',
        instructions: 'x',
        dueAt: past,
        allowLate: true,
      });
      await inst.post(`/assignments/${strict.body.data.id}/publish`);
      await inst.post(`/assignments/${lenient.body.data.id}/publish`);
      expect(
        (await stu.put(`/assignments/${strict.body.data.id}/submission`, { content: 'late' }))
          .status,
      ).toBe(409);
      const ok = await stu.put(`/assignments/${lenient.body.data.id}/submission`, {
        content: 'late',
      });
      expect(ok.status).toBe(200);
      expect(ok.body.data.isLate).toBe(true);
    });

    it('changing the deadline recomputes lateness of ungraded submissions', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const past = new Date(Date.now() - 3_600_000).toISOString();
      const a = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Moving deadline',
        instructions: 'x',
        dueAt: past,
        allowLate: true,
      });
      const id = a.body.data.id;
      await inst.post(`/assignments/${id}/publish`);
      const sub = await stu.put(`/assignments/${id}/submission`, { content: 'work' });
      expect(sub.body.data.isLate).toBe(true);
      const future = new Date(Date.now() + 3_600_000).toISOString();
      expect((await inst.patch(`/assignments/${id}`, { dueAt: future })).status).toBe(200);
      const after = await stu.get(`/submissions/${sub.body.data.id}`);
      expect(after.body.data.isLate).toBe(false);
    });

    it('grading and concurrent resubmission are serialised (graded work is never overwritten)', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const a = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Race',
        instructions: 'x',
      });
      const id = a.body.data.id;
      await inst.post(`/assignments/${id}/publish`);
      const sub = await stu.put(`/assignments/${id}/submission`, { content: 'original' });
      const [g, r] = await Promise.all([
        inst.put(`/submissions/${sub.body.data.id}/grade`, { grade: 80 }),
        stu.put(`/assignments/${id}/submission`, { content: 'changed' }),
      ]);
      expect(g.status).toBe(200);
      expect([200, 409]).toContain(r.status);
      const final = await inst.get(`/submissions/${sub.body.data.id}`);
      expect(final.body.data.status).toBe('GRADED');
      // Whatever order won, the stored content must match what the response to the student implied.
      expect(final.body.data.content).toBe(r.status === 200 ? 'changed' : 'original');
    });

    it('concurrent first submissions leave exactly one row', async () => {
      const c = await publishedCourse(inst, 1);
      await stu.post(`/courses/${c.courseId}/enroll`);
      const a = await inst.post(`/courses/${c.courseId}/assignments`, {
        title: 'Race',
        instructions: 'x',
      });
      await inst.post(`/assignments/${a.body.data.id}/publish`);
      const rs = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          stu.put(`/assignments/${a.body.data.id}/submission`, { content: `v${i}` }),
        ),
      );
      expect(rs.every((r) => r.status === 200)).toBe(true);
      const [{ n }] = await ds.query('SELECT COUNT(*) n FROM assignment_submissions');
      expect(Number(n)).toBe(1);
    });
  });

  it('responses never contain sensitive columns', async () => {
    const c = await publishedCourse(inst, 1);
    await stu.post(`/courses/${c.courseId}/enroll`);
    const dumps = [
      await stu.get('/users/me'),
      await inst.get(`/courses/${c.courseId}/learners`),
      await inst.get('/courses/mine'),
      await request(app.getHttpServer()).get('/api/v1/courses'),
      await stu.get('/enrollments/me'),
    ];
    for (const d of dumps)
      expect(JSON.stringify(d.body)).not.toMatch(
        /passwordHash|password_hash|failedLoginCount|lockedUntil|tokenHash/,
      );
  });
});
