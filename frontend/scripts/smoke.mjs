#!/usr/bin/env node
/**
 * Live smoke test: drives the *running* frontend (Next.js) and, through its /api/v1 proxy, the real
 * backend + database. It checks the exact response shapes the UI relies on, the cookie/CSRF flow, the
 * route protection and the RTL/i18n document attributes. Usage:
 *   SMOKE_BASE=http://localhost:3000 SMOKE_PASSWORD=... node scripts/smoke.mjs
 * Requires seeded demo users (admin@example.test, instructor1@example.test, student1@example.test).
 */
const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = process.env.SMOKE_PASSWORD;
if (!PASSWORD) {
  console.error('Set SMOKE_PASSWORD to the seed password.');
  process.exit(2);
}

let passed = 0;
const failures = [];
const check = (name, cond, extra = '') => {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
};
const has = (o, ...keys) => o && keys.every((k) => k in o);

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
    this.csrf = null;
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async req(method, path, { body, csrf = true, headers = {}, redirect = 'manual' } = {}) {
    const h = { Accept: 'application/json', Origin: BASE, ...headers };
    if (this.cookies.size) h.Cookie = this.header();
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (csrf && this.csrf && method !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value === '' || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
      (this.setCookieRaw ??= []).push(line);
    }
    return res;
  }
  async api(method, path, body, opts) {
    const res = await this.req(method, `/api/v1${path}`, { body, ...opts });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json, data: json?.data, meta: json?.meta };
  }
  async login(email) {
    const r = await this.api('POST', '/auth/login', { email, password: PASSWORD });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    this.csrf = r.data.csrfToken;
    this.user = r.data.user;
    return r;
  }
}

async function pages() {
  console.log('\n[pages, anonymous]');
  const anon = new Session('anon');
  for (const p of ['/', '/courses', '/login', '/register', '/forgot-password']) {
    const res = await anon.req('GET', p, { headers: { Accept: 'text/html' } });
    check(`GET ${p} -> 200`, res.status === 200, `(got ${res.status})`);
    if (p === '/') {
      const html = await res.text();
      check('home is Arabic + RTL by default', /<html[^>]*lang="ar"[^>]*dir="rtl"/.test(html));
      check('home has one <h1>', (html.match(/<h1[ >]/g) ?? []).length === 1);
      check('skip link present', html.includes('href="#main"'));
      check('CSP header', (res.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"));
      check('X-Frame-Options DENY', res.headers.get('x-frame-options') === 'DENY');
      check('nosniff', res.headers.get('x-content-type-options') === 'nosniff');
      check('no X-Powered-By', !res.headers.has('x-powered-by'));
    }
  }
  const en = await anon.req('GET', '/', { headers: { Accept: 'text/html', Cookie: 'lms_locale=en' } });
  const enHtml = await en.text();
  check('lms_locale=en -> lang="en" dir="ltr"', /<html[^>]*lang="en"[^>]*dir="ltr"/.test(enHtml));
  for (const p of ['/student', '/instructor/courses/new', '/admin', '/learn/abc', '/profile']) {
    const res = await anon.req('GET', p, { headers: { Accept: 'text/html' } });
    const loc = res.headers.get('location') ?? '';
    check(`protected ${p} without cookie -> redirect to /login?next=`, [307, 308].includes(res.status) && loc.includes('/login?next='), `(got ${res.status} ${loc})`);
  }
  const nf = await anon.req('GET', '/definitely-not-a-page', { headers: { Accept: 'text/html' } });
  check('unknown route -> 404', nf.status === 404);
}

async function authFlow() {
  console.log('\n[auth through the proxy: cookie + CSRF]');
  const s = new Session('student');
  const bad = await s.api('POST', '/auth/login', { email: 'student1@example.test', password: 'wrong-password-xx' });
  check('wrong password -> 401 with generic message', bad.status === 401 && bad.json?.message === 'Invalid email or password');
  const r = await s.login('student1@example.test');
  check('login -> user + csrfToken', has(r.data, 'user', 'csrfToken') && has(r.data.user, 'id', 'email', 'fullName', 'roles', 'locale', 'status'));
  const raw = (s.setCookieRaw ?? []).find((l) => /lms_sid/.test(l)) ?? '';
  check('session cookie is HttpOnly + SameSite', /HttpOnly/i.test(raw) && /SameSite=(Lax|Strict)/i.test(raw), raw);
  check('session cookie is first-party (no Domain attribute)', !/Domain=/i.test(raw));
  const me = await s.api('GET', '/auth/me');
  check('GET /auth/me -> user + csrfToken', me.status === 200 && has(me.data, 'user', 'csrfToken'));
  s.csrf = me.data.csrfToken;
  const noCsrf = await s.api('POST', '/auth/logout', undefined, { csrf: false });
  check('mutating request without CSRF header -> 403', noCsrf.status === 403, `(got ${noCsrf.status})`);
  const forged = await s.req('POST', '/api/v1/auth/logout', { headers: { Origin: 'https://evil.example' } });
  check('mutating request from a foreign Origin is rejected', forged.status === 403, `(got ${forged.status})`);
  const adminOnly = await s.api('GET', '/admin/stats');
  check('student cannot read /admin/stats -> 403', adminOnly.status === 403);
  const anon = new Session('anon');
  const unauth = await anon.api('GET', '/enrollments/me');
  check('unauthenticated protected API -> 401', unauth.status === 401);
}

async function domain() {
  console.log('\n[domain flow: instructor builds, student learns, instructor grades]');
  const ins = new Session('instructor');
  await ins.login('instructor1@example.test');
  const stu = new Session('student');
  await stu.login('student2@example.test');
  const adm = new Session('admin');
  await adm.login('admin@example.test');
  const tag = Date.now();

  const c = await ins.api('POST', '/courses', { title: `Smoke course ${tag}`, summary: 'A smoke-test course summary.', description: 'A long enough description for the smoke test.', level: 'BEGINNER', language: 'en' });
  check('create course', c.status === 201 && has(c.data, 'id', 'slug', 'status', 'canManage') && c.data.status === 'DRAFT', JSON.stringify(c.json));
  const course = c.data;
  const pubEarly = await ins.api('POST', `/courses/${course.id}/publish`);
  check('publish without lessons is refused with a mapped message', pubEarly.status >= 400 && pubEarly.status < 500, `(got ${pubEarly.status} ${pubEarly.json?.message})`);

  const m = await ins.api('POST', `/courses/${course.id}/modules`, { title: 'Module 1', description: 'First' });
  check('create module', m.status === 201 && m.data?.id);
  const l1 = await ins.api('POST', `/modules/${m.data.id}/lessons`, { title: 'Lesson A', contentType: 'TEXT', content: 'Hello learners', durationMinutes: 5 });
  const l2 = await ins.api('POST', `/modules/${m.data.id}/lessons`, { title: 'Lesson B', contentType: 'VIDEO', contentUrl: 'https://example.com/v', durationMinutes: 7, isPreview: true });
  check('create lessons (TEXT, VIDEO)', l1.status === 201 && l2.status === 201, JSON.stringify([l1.json, l2.json]));
  const reorder = await ins.api('PUT', `/modules/${m.data.id}/lessons/order`, { ids: [l2.data.id, l1.data.id] });
  check('reorder lessons', reorder.status === 200, JSON.stringify(reorder.json));
  const pub = await ins.api('POST', `/courses/${course.id}/publish`);
  check('publish course', pub.status === 200 || pub.status === 201, JSON.stringify(pub.json));

  const cat = await stu.api('GET', '/courses?q=Smoke%20course&pageSize=5');
  check('catalog list shape (items + meta)', cat.status === 200 && Array.isArray(cat.data) && has(cat.meta, 'page', 'pageSize', 'total', 'totalPages'));
  const row = cat.data.find((x) => x.id === course.id);
  check('catalog item shape', !!row && has(row, 'title', 'slug', 'summary', 'level', 'language', 'instructor', 'lessonCount', 'learnerCount'));
  const bySlug = await stu.api('GET', `/courses/by-slug/${course.slug}`);
  check('by-slug detail shape (enrollment null before enrolling)', bySlug.status === 200 && has(bySlug.data, 'description', 'canManage', 'enrollment') && bySlug.data.enrollment === null && bySlug.data.canManage === false);

  const blocked = await stu.api('GET', `/lessons/${l1.data.id}`);
  check('lesson is blocked before enrolling (non-preview)', blocked.status === 403 || blocked.status === 404, `(got ${blocked.status})`);
  const en = await stu.api('POST', `/courses/${course.id}/enroll`);
  check('enroll', en.status === 201 || en.status === 200, JSON.stringify(en.json));
  const again = await stu.api('POST', `/courses/${course.id}/enroll`);
  check('double enroll -> 409 with known message', again.status === 409 && again.json?.message === 'Already enrolled in this course', JSON.stringify(again.json));

  const cur = await stu.api('GET', `/courses/${course.id}/curriculum`);
  const lessons = cur.data?.modules?.[0]?.lessons ?? [];
  check('curriculum shape with completion flags', cur.status === 200 && lessons.length === 2 && has(lessons[0], 'id', 'title', 'contentType', 'durationMinutes', 'isPreview', 'position', 'completed'));
  check('curriculum respects the new order (Lesson B first)', lessons[0]?.title === 'Lesson B');
  const les = await stu.api('GET', `/lessons/${l1.data.id}`);
  check('lesson shape', les.status === 200 && has(les.data, 'id', 'courseId', 'title', 'contentType', 'content', 'contentUrl'));
  const done = await stu.api('POST', `/lessons/${l1.data.id}/complete`);
  check('complete lesson -> progress snapshot', has(done.data, 'completed', 'percent', 'completedLessons', 'totalLessons') && done.data.percent === 50, JSON.stringify(done.json));
  const prog = await stu.api('GET', `/courses/${course.id}/progress`);
  check('course progress shape', has(prog.data, 'percent', 'completedLessonIds', 'enrollmentStatus') && prog.data.completedLessonIds.includes(l1.data.id));
  const mine = await stu.api('GET', '/enrollments/me?pageSize=50');
  const mineRow = mine.data?.find((e) => e.course.id === course.id);
  check('my enrollments shape (course + progress)', !!mineRow && has(mineRow, 'status', 'enrolledAt', 'course', 'progress') && has(mineRow.course, 'title', 'instructor'));
  const sum = await stu.api('GET', '/progress/me/summary');
  check('progress summary shape', has(sum.data, 'enrolledCourses', 'completedCourses', 'inProgressCourses', 'averageProgressPercent', 'recentActivity') && sum.data.recentActivity.length >= 1);
  const undone = await stu.api('DELETE', `/lessons/${l1.data.id}/complete`);
  check('un-complete lesson', undone.status === 200 && undone.data.completed === false);

  // --- assessment ---
  const a = await ins.api('POST', `/courses/${course.id}/assessments`, { title: 'Smoke quiz', instructions: 'Answer all', maxAttempts: 2, passingPercent: 50, timeLimitMinutes: 10, reviewPolicy: 'AFTER_SUBMISSION' });
  check('create assessment', a.status === 201 && a.data?.status === 'DRAFT', JSON.stringify(a.json));
  const q1 = await ins.api('POST', `/assessments/${a.data.id}/questions`, { type: 'SINGLE_CHOICE', prompt: '2 + 2 = ?', options: [{ id: 'o1', text: '3' }, { id: 'o2', text: '4' }], correctOptionIds: ['o2'], points: 2, explanation: 'Basic maths' });
  const q2 = await ins.api('POST', `/assessments/${a.data.id}/questions`, { type: 'MULTIPLE_CHOICE', prompt: 'Primes?', options: [{ id: 'o1', text: '2' }, { id: 'o2', text: '4' }, { id: 'o3', text: '5' }], correctOptionIds: ['o1', 'o3'], points: 3 });
  const q3 = await ins.api('POST', `/assessments/${a.data.id}/questions`, { type: 'TRUE_FALSE', prompt: 'The sky is green', options: [{ id: 'o1', text: 'True' }, { id: 'o2', text: 'False' }], correctOptionIds: ['o2'], points: 1 });
  check('add 3 question types', [q1, q2, q3].every((x) => x.status === 201), JSON.stringify([q1.json, q2.json, q3.json]));
  const staffView = await ins.api('GET', `/assessments/${a.data.id}`);
  check('staff view exposes correctOptionIds', has(staffView.data?.questions?.[0] ?? {}, 'correctOptionIds', 'options', 'points', 'type'));
  const apub = await ins.api('POST', `/assessments/${a.data.id}/publish`);
  check('publish assessment', apub.status === 200 || apub.status === 201, JSON.stringify(apub.json));

  const sList = await stu.api('GET', `/courses/${course.id}/assessments`);
  const sRow = sList.data?.find((x) => x.id === a.data.id);
  check('learner assessment list shape', !!sRow && has(sRow, 'title', 'passingPercent', 'questionCount', 'myProgress') && has(sRow.myProgress, 'attemptsUsed', 'bestPercent', 'passed'), JSON.stringify(sRow));
  const sGet = await stu.api('GET', `/assessments/${a.data.id}`);
  check('learner assessment detail has attempt counters and no questions', has(sGet.data, 'attemptsRemaining', 'maxAttempts', 'timeLimitMinutes') && !('questions' in sGet.data));
  const start = await stu.api('POST', `/assessments/${a.data.id}/attempts`);
  check('start attempt shape (attempt + questions)', start.status === 201 || start.status === 200, JSON.stringify(start.json));
  const attempt = start.data?.attempt;
  const qs = start.data?.questions ?? [];
  check('attempt has deadline and learner-safe questions', has(attempt, 'id', 'attemptNumber', 'status', 'deadlineAt') && attempt.deadlineAt && qs.length === 3 && !JSON.stringify(qs).includes('correctOptionIds') && !JSON.stringify(qs).includes('explanation'));
  const resumed = await stu.api('POST', `/assessments/${a.data.id}/attempts`);
  check('starting again resumes the same attempt', resumed.data?.attempt?.id === attempt.id && resumed.data?.resumed === true);
  const inprog = await stu.api('GET', `/attempts/${attempt.id}`);
  check('GET in-progress attempt exposes questions (needed for refresh/resume)', Array.isArray(inprog.data?.questions) && inprog.data.questions.length === 3, JSON.stringify(Object.keys(inprog.data ?? {})));
  const answers = Object.fromEntries(qs.map((q) => [q.id, q.prompt.startsWith('2') ? ['o2'] : q.prompt.startsWith('Primes') ? ['o1', 'o3'] : ['o1']]));
  const sub = await stu.api('POST', `/attempts/${attempt.id}/submit`, { answers });
  check('submit -> graded result', sub.status === 200 || sub.status === 201, JSON.stringify(sub.json));
  check('result: score 5/6, percent, passed, review[]', sub.data?.score === 5 && sub.data?.maxScore === 6 && Math.round(sub.data?.percent) === 83 && sub.data?.passed === true && Array.isArray(sub.data?.review) && sub.data.review.length === 3, JSON.stringify(sub.data));
  const rv = sub.data?.review?.[0] ?? {};
  check('review item shape', has(rv, 'questionId', 'prompt', 'options', 'selectedOptionIds', 'correctOptionIds', 'correct', 'pointsAwarded', 'points'));
  const again2 = await stu.api('POST', `/attempts/${attempt.id}/submit`, { answers });
  check('double submit is rejected', again2.status >= 400 && again2.status < 500, `(got ${again2.status})`);
  const fetched = await stu.api('GET', `/attempts/${attempt.id}`);
  check('GET submitted attempt keeps review', fetched.data?.status === 'SUBMITTED' && Array.isArray(fetched.data?.review));
  const aList = await stu.api('GET', `/assessments/${a.data.id}/attempts`);
  check('attempts list (own) shape', Array.isArray(aList.data) && has(aList.data[0], 'attemptNumber', 'status', 'percent', 'passed'));
  const staffAttempts = await ins.api('GET', `/assessments/${a.data.id}/attempts`);
  check('staff attempts list includes student name', staffAttempts.data?.[0]?.student?.fullName);

  // --- assignment ---
  const asg = await ins.api('POST', `/courses/${course.id}/assignments`, { title: 'Smoke assignment', instructions: 'Write something', maxPoints: 20, allowLate: false });
  check('create assignment', asg.status === 201 && asg.data?.status === 'DRAFT', JSON.stringify(asg.json));
  const asgPub = await ins.api('POST', `/assignments/${asg.data.id}/publish`);
  check('publish assignment', asgPub.status === 200 || asgPub.status === 201);
  const sub1 = await stu.api('PUT', `/assignments/${asg.data.id}/submission`, { content: 'My answer', linkUrl: 'https://example.com/doc' });
  check('submit assignment shape', (sub1.status === 200 || sub1.status === 201) && has(sub1.data, 'id', 'status', 'content', 'submittedAt', 'isLate') && sub1.data.status === 'SUBMITTED', JSON.stringify(sub1.json));
  const badLink = await stu.api('PUT', `/assignments/${asg.data.id}/submission`, { content: 'x', linkUrl: 'javascript:alert(1)' });
  check('javascript: link rejected by the API too (defence in depth)', badLink.status === 400);
  const aListS = await stu.api('GET', `/courses/${course.id}/assignments`);
  const aRow = aListS.data?.find((x) => x.id === asg.data.id);
  check('learner assignment list has mySubmission', aRow?.mySubmission?.id === sub1.data.id && aRow.mySubmission.status === 'SUBMITTED', JSON.stringify(aRow));
  const subsStaff = await ins.api('GET', `/assignments/${asg.data.id}/submissions?status=SUBMITTED`);
  check('staff submissions list shape', subsStaff.status === 200 && subsStaff.data?.[0]?.student?.fullName && has(subsStaff.meta, 'total'));
  const bad = await ins.api('PUT', `/submissions/${sub1.data.id}/grade`, { grade: 999, feedback: 'too high' });
  check('grade above max is rejected', bad.status >= 400 && bad.status < 500, `(got ${bad.status})`);
  const gr = await ins.api('PUT', `/submissions/${sub1.data.id}/grade`, { grade: 18, feedback: 'Good work' });
  check('grade submission', (gr.status === 200 || gr.status === 201) && gr.data?.status === 'GRADED' && gr.data?.grade === 18, JSON.stringify(gr.json));
  const mineSub = await stu.api('GET', `/submissions/${sub1.data.id}`);
  check('student sees grade + feedback', mineSub.data?.grade === 18 && mineSub.data?.feedback === 'Good work');
  const locked = await stu.api('PUT', `/assignments/${asg.data.id}/submission`, { content: 'tamper' });
  check('graded submission is locked', locked.status === 409 && locked.json?.message === 'Graded submissions cannot be changed', JSON.stringify(locked.json));

  // --- learners & completion ---
  const learners = await ins.api('GET', `/courses/${course.id}/learners`);
  check('instructor learners list shape', learners.status === 200 && has(learners.data?.[0] ?? {}, 'enrollmentId', 'status', 'student', 'enrolledAt'), JSON.stringify(learners.json));
  await stu.api('POST', `/lessons/${l1.data.id}/complete`);
  const fin = await stu.api('POST', `/lessons/${l2.data.id}/complete`);
  check('completing all lessons completes the course', fin.data?.percent === 100 && fin.data?.courseStatus === 'COMPLETED', JSON.stringify(fin.data));
  const noDrop = await stu.api('DELETE', `/courses/${course.id}/enroll`);
  check('completed course cannot be dropped (known message)', noDrop.status === 409 && noDrop.json?.message === 'Completed courses cannot be dropped', JSON.stringify(noDrop.json));

  // --- role checks ---
  const stuMgr = await stu.api('POST', `/courses`, { title: 'Hack', summary: 'x'.repeat(12), description: 'y'.repeat(12) });
  check('student cannot create courses -> 403', stuMgr.status === 403);
  const stuEdit = await stu.api('PATCH', `/courses/${course.id}`, { title: 'Hijacked' });
  check('student cannot edit a course -> 403', stuEdit.status === 403);

  // --- admin ---
  const st = await adm.api('GET', '/admin/stats');
  check('admin stats shape', has(st.data, 'users', 'courses', 'enrollments', 'assessmentAttempts', 'assignmentSubmissions') && has(st.data.users, 'total', 'byRole'));
  const us = await adm.api('GET', '/admin/users?pageSize=5&q=student');
  check('admin users list shape', us.status === 200 && has(us.data?.[0] ?? {}, 'id', 'email', 'roles', 'status', 'lastLoginAt') && has(us.meta, 'total'));
  const cs = await adm.api('GET', '/admin/courses?pageSize=5');
  check('admin courses list shape', cs.status === 200 && has(cs.data?.[0] ?? {}, 'title', 'instructor', 'lessonCount', 'status'));
  const au = await adm.api('GET', '/admin/audit-logs?pageSize=5');
  check('audit log shape', au.status === 200 && has(au.data?.[0] ?? {}, 'action', 'createdAt', 'entityType'));
  const self = await adm.api('PATCH', `/admin/users/${adm.user.id}`, { status: 'SUSPENDED' });
  check('admin cannot suspend themselves (mapped message)', self.status === 409 || self.status === 400 || self.status === 403, `(got ${self.status} ${self.json?.message})`);

  // --- logout ---
  const out = await stu.api('POST', '/auth/logout');
  check('logout', out.status === 200 || out.status === 201);
  const after = await stu.api('GET', '/auth/me');
  check('session is invalid after logout', after.status === 401);
}

try {
  await pages();
  await authFlow();
  await domain();
} catch (e) {
  failures.push('exception: ' + e.message);
  console.error(e);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(1);
}
