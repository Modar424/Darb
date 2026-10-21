import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import {
  apiLogin,
  BASE,
  createFixtureCourse,
  loginUi,
  loginUiWith,
  registerApi,
  STUDENT_PASSWORD,
  stamp,
  USERS,
} from './helpers';

/**
 * Sweep over every important page, per role: axe (WCAG 2.1 A/AA incl. colour contrast, serious+critical),
 * no horizontal overflow at 375/768/1280 px, and screenshots (saved to e2e/screenshots, git-ignored).
 */
const SHOTS = process.env.E2E_SHOTS === '1';
const WIDTHS = [375, 768, 1280] as const;
const s = stamp();
type Role = 'public' | 'student' | 'instructor' | 'admin';
interface Target {
  role: Role;
  name: string;
  path: string;
}
let fx: Awaited<ReturnType<typeof createFixtureCourse>>;
let attemptId = '';
const studentEmail = `e2e.visual.${s}@example.test`;

function targets(): Target[] {
  const c = fx.courseId;
  return [
    { role: 'public', name: 'home', path: '/' },
    { role: 'public', name: 'catalog', path: '/courses' },
    { role: 'public', name: 'course-detail', path: `/courses/${fx.slug}` },
    { role: 'public', name: 'login', path: '/login' },
    { role: 'public', name: 'register', path: '/register' },
    { role: 'public', name: 'forgot', path: '/forgot-password' },
    { role: 'student', name: 'student-dashboard', path: '/student' },
    { role: 'student', name: 'learn-home', path: `/learn/${c}` },
    { role: 'student', name: 'lesson', path: `/learn/${c}/lessons/${fx.lessonIds[0]}` },
    { role: 'student', name: 'quiz-intro', path: `/learn/${c}/assessments/${fx.quizId}` },
    { role: 'student', name: 'quiz-attempt', path: `/learn/${c}/attempts/${attemptId}` },
    { role: 'student', name: 'assignment', path: `/learn/${c}/assignments/${fx.assignmentId}` },
    { role: 'student', name: 'profile', path: '/profile' },
    { role: 'instructor', name: 'instructor-dashboard', path: '/instructor' },
    { role: 'instructor', name: 'new-course', path: '/instructor/courses/new' },
    { role: 'instructor', name: 'course-manage', path: `/instructor/courses/${c}` },
    { role: 'instructor', name: 'assessment-editor', path: `/instructor/assessments/${fx.quizId}` },
    {
      role: 'instructor',
      name: 'assignment-manager',
      path: `/instructor/assignments/${fx.assignmentId}`,
    },
    { role: 'admin', name: 'admin-overview', path: '/admin' },
    { role: 'admin', name: 'admin-users', path: '/admin/users' },
    { role: 'admin', name: 'admin-courses', path: '/admin/courses' },
    { role: 'admin', name: 'admin-audit', path: '/admin/audit' },
  ];
}

async function ctxFor(
  browser: Browser,
  role: Role,
  locale: 'ar' | 'en',
  width: number,
  theme: 'light' | 'dark' = 'light',
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 740 : 900 } });
  await ctx.addCookies([
    { name: 'lms_locale', value: locale, url: BASE },
    { name: 'lms_theme', value: theme, url: BASE },
  ]);
  const page = await ctx.newPage();
  if (role !== 'public') {
    if (locale === 'ar') {
      if (role === 'student') await loginUiWith(page, studentEmail, STUDENT_PASSWORD);
      else await loginUi(page, role === 'admin' ? USERS.admin : USERS.instructor);
    } else {
      await page.goto('/login');
      await page
        .getByLabel('Email')
        .fill(
          role === 'student' ? studentEmail : role === 'admin' ? USERS.admin : USERS.instructor,
        );
      await page
        .getByLabel('Password')
        .fill(role === 'student' ? STUDENT_PASSWORD : (process.env.E2E_PASSWORD ?? ''));
      await page.getByRole('button', { name: 'Sign in' }).click();
    }
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  }
  return { ctx, page };
}

test.describe('visual + a11y sweep', () => {
  test.setTimeout(600_000);
  test.beforeAll(async () => {
    const instr = await apiLogin(USERS.instructor);
    fx = await createFixtureCourse(instr, s);
    await registerApi(studentEmail, `Visual ${s}`);
    const stu = await apiLogin(studentEmail, STUDENT_PASSWORD);
    await stu.call('POST', `/courses/${fx.courseId}/enroll`);
    const a = await stu.call<{ attempt: { id: string } }>(
      'POST',
      `/assessments/${fx.quizId}/attempts`,
    );
    attemptId = a.data.attempt.id;
    if (SHOTS) fs.mkdirSync('e2e/screenshots', { recursive: true });
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const locale of ['ar', 'en'] as const) {
      for (const width of WIDTHS) {
        if (theme === 'dark' && width === 768) continue;
        test(`${theme} ${locale} @ ${width}px: no overflow, no serious/critical axe violations`, async ({
          browser,
        }) => {
          const problems: string[] = [];
          const roles: Role[] = ['public', 'student', 'instructor', 'admin'];
          for (const role of roles) {
            const { ctx, page } = await ctxFor(browser, role, locale, width, theme);
            for (const t of targets().filter((x) => x.role === role)) {
              await page.goto(t.path);
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(400);
              const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
              );
              if (overflow > 0) problems.push(`[${t.name}] horizontal overflow ${overflow}px`);
              const r = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();
              for (const v of r.violations.filter(
                (x) => x.impact === 'serious' || x.impact === 'critical',
              )) {
                problems.push(
                  `[${t.name}] ${v.id}: ${v.nodes
                    .slice(0, 2)
                    .map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.message ?? ''))
                    .join(' | ')}`,
                );
              }
              if (SHOTS)
                await page.screenshot({
                  path: `e2e/screenshots/${theme}-${locale}-${width}-${t.name}.png`,
                  fullPage: true,
                });
            }
            await ctx.close();
          }
          expect(problems, problems.join('\n')).toEqual([]);
        });
      }
    }
  }
});
