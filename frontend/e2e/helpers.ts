import { expect, type APIRequestContext, type Page, request } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD ?? '';
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export const USERS = {
  admin: 'admin@example.test',
  instructor: 'instructor1@example.test',
  student: 'student3@example.test',
} as const;

/** UI login. Arabic labels are the default locale. */
export async function loginUi(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
}

export interface ApiSession {
  ctx: APIRequestContext;
  csrf: string;
  call: <T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; data: T }>;
}
/** API session through the Next.js proxy, used only to arrange test data quickly. */
export async function apiLogin(email: string, password: string = PASSWORD): Promise<ApiSession> {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const res = await ctx.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  const csrf = (await res.json()).data.csrfToken as string;
  return {
    ctx,
    csrf,
    async call(method, path, body) {
      const r = await ctx.fetch(`/api/v1${path}`, {
        method,
        data: body,
        headers: { 'X-CSRF-Token': csrf },
      });
      let json: { data?: unknown } = {};
      try {
        json = await r.json();
      } catch {
        /* empty body */
      }
      return { status: r.status(), data: json.data as never };
    },
  };
}

export const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/**
 * Collects console errors so tests can assert a clean page. The anonymous session probe
 * (`GET /auth/me` -> 401) is expected for signed-out visitors and is logged by the browser as a resource
 * error, so that single message is ignored; everything else (including every `pageerror`) is kept.
 */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const loc = m.location().url ?? '';
    if (/status of 401/.test(text) && /\/auth\/me/.test(loc + text)) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Registers a brand-new student through the API (used to arrange data / second actors). */
export async function registerApi(email: string, fullName = 'طالب اختبار') {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const res = await ctx.post('/api/v1/auth/register', {
    data: { email, password: STUDENT_PASSWORD, fullName, locale: 'ar' },
  });
  expect(res.status(), `register ${email}`).toBe(201);
  await ctx.dispose();
}
export const STUDENT_PASSWORD = 'Ex4mple-Learner-Pass!77';

export async function loginUiWith(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
}

/** The UI must never show raw English server text: fail if a known backend message leaks. */
export async function expectNoRawServerText(page: Page) {
  const text = await page.locator('body').innerText();
  const leaked = text.match(
    /\b(already enrolled|forbidden|unauthorized|not found|must be|cannot be|is required|invalid or expired|internal server error|bad request|conflict)\b/i,
  );
  expect(leaked?.[0] ?? null, 'raw English server text leaked into the UI').toBeNull();
}

/** Creates a published course with 1 module, 2 text lessons, a 3-question quiz and an assignment (via API). */
export async function createFixtureCourse(instr: ApiSession, label: string) {
  const mk = async <T>(method: string, path: string, body?: unknown) => {
    const r = await instr.call<T>(method, path, body);
    expect([200, 201], `${method} ${path} -> ${r.status}`).toContain(r.status);
    return r.data;
  };
  const course = await mk<{ id: string; slug: string }>('POST', '/courses', {
    title: `دورة ${label}`,
    summary: 'ملخص دورة مخصصة لاختبارات المتصفح الشاملة.',
    description: 'وصف تفصيلي لدورة اختبار المتصفح، يحتوي على وحدة ودرسين واختبار وواجب.',
    level: 'BEGINNER',
    language: 'ar',
  });
  const mod = await mk<{ id: string }>('POST', `/courses/${course.id}/modules`, {
    title: 'الوحدة الأولى',
  });
  const l1 = await mk<{ id: string }>('POST', `/modules/${mod.id}/lessons`, {
    title: `الدرس الأول ${label}`,
    contentType: 'TEXT',
    content: 'محتوى الدرس الأول.',
    durationMinutes: 5,
  });
  const l2 = await mk<{ id: string }>('POST', `/modules/${mod.id}/lessons`, {
    title: `الدرس الثاني ${label}`,
    contentType: 'TEXT',
    content: 'محتوى الدرس الثاني.',
    durationMinutes: 5,
  });
  const quiz = await mk<{ id: string }>('POST', `/courses/${course.id}/assessments`, {
    title: `اختبار ${label}`,
    passingPercent: 60,
    maxAttempts: 3,
    reviewPolicy: 'AFTER_SUBMISSION',
  });
  await mk('POST', `/assessments/${quiz.id}/questions`, {
    type: 'SINGLE_CHOICE',
    prompt: 'السؤال الأول',
    options: [
      { id: 'o1', text: 'الإسكندرية' },
      { id: 'o2', text: 'القاهرة' },
      { id: 'o3', text: 'أسوان' },
    ],
    correctOptionIds: ['o2'],
    points: 1,
    explanation: 'القاهرة هي العاصمة.',
  });
  await mk('POST', `/assessments/${quiz.id}/questions`, {
    type: 'MULTIPLE_CHOICE',
    prompt: 'السؤال الثاني',
    options: [
      { id: 'o1', text: 'اثنان' },
      { id: 'o2', text: 'ثلاثة' },
      { id: 'o3', text: 'أربعة' },
    ],
    correctOptionIds: ['o1', 'o3'],
    points: 1,
  });
  await mk('POST', `/assessments/${quiz.id}/questions`, {
    type: 'TRUE_FALSE',
    prompt: 'السؤال الثالث',
    options: [
      { id: 'o1', text: 'صح' },
      { id: 'o2', text: 'خطأ' },
    ],
    correctOptionIds: ['o1'],
    points: 1,
  });
  await mk('POST', `/assessments/${quiz.id}/publish`, undefined);
  const hw = await mk<{ id: string }>('POST', `/courses/${course.id}/assignments`, {
    title: `واجب ${label}`,
    instructions: 'اكتب ملخصاً عن الدرس.',
    maxPoints: 20,
  });
  await mk('POST', `/assignments/${hw.id}/publish`, undefined);
  await mk('POST', `/courses/${course.id}/publish`, undefined);
  return {
    courseId: course.id,
    slug: course.slug,
    lessonIds: [l1.id, l2.id],
    quizId: quiz.id,
    assignmentId: hw.id,
    title: `دورة ${label}`,
    lesson1: `الدرس الأول ${label}`,
    lesson2: `الدرس الثاني ${label}`,
    quizTitle: `اختبار ${label}`,
    hwTitle: `واجب ${label}`,
  };
}
