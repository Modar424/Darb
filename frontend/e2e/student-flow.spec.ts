import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  apiLogin,
  createFixtureCourse,
  expectNoRawServerText,
  loginUiWith,
  registerApi,
  STUDENT_PASSWORD,
  stamp,
  USERS,
  watchErrors,
} from './helpers';

/**
 * Complete student journey against the real stack: register -> catalogue -> enrol -> lessons/progress ->
 * quiz (all 3 question types, auto-grading, review) -> assignment (URL safety) -> course completion,
 * plus the error paths (double enrolment, lesson of a course the student is not enrolled in).
 */
test.describe.serial('student journey', () => {
  const s = stamp();
  const email = `e2e.student.${s}@example.test`;
  let ctx: BrowserContext;
  let page: Page;
  let errors: string[];
  let fx: Awaited<ReturnType<typeof createFixtureCourse>>;

  test.beforeAll(async ({ browser }) => {
    const instr = await apiLogin(USERS.instructor);
    fx = await createFixtureCourse(instr, s);
    ctx = await browser.newContext();
    page = await ctx.newPage();
    errors = watchErrors(page);
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test('registers a new student account and lands on the empty dashboard', async () => {
    await page.goto('/register');
    await page.getByLabel('الاسم الكامل').fill('طالب المتصفح');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('مرحباً');
    await expect(page.getByText('لم تسجّل في أي دورة بعد')).toBeVisible();
  });

  test('finds the course through catalogue search and opens its detail page', async () => {
    await page.goto('/courses');
    await page.getByLabel('بحث').fill(fx.title);
    await expect(page.getByText('عدد النتائج: 1')).toBeVisible(); // wait for the debounced filter to apply
    // The search box updates the URL after a debounce; a click that lands while that replace is in flight can be
    // overridden by it, so retry the click until navigation sticks (what a user would do).
    await expect(async () => {
      await page.getByRole('link', { name: fx.title }).click({ timeout: 2000 });
      await expect
        .poll(() => decodeURIComponent(new URL(page.url()).pathname), { timeout: 3000 })
        .toBe(`/courses/${fx.slug}`);
    }).toPass({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fx.title);
    await expect(page.getByText(fx.lesson1)).toBeVisible();
  });

  test('enrols; a second (stale) tab gets the translated "already enrolled" message', async () => {
    const stale = await ctx.newPage();
    await stale.goto(`/courses/${fx.slug}`);
    await expect(stale.getByRole('button', { name: 'سجّل في الدورة' })).toBeVisible();

    await page.getByRole('button', { name: 'سجّل في الدورة' }).click();
    await expect(page.getByText('تم تسجيلك في الدورة')).toBeVisible();
    await expect(page.getByRole('link', { name: 'متابعة التعلّم' })).toBeVisible();

    await stale.getByRole('button', { name: 'سجّل في الدورة' }).click();
    await expect(stale.getByText('أنت مسجَّل في هذه الدورة بالفعل.')).toBeVisible();
    await expectNoRawServerText(stale);
    await stale.close();
  });

  test('completing lesson 1 moves the progress bar to 50%', async () => {
    await page.getByRole('link', { name: 'متابعة التعلّم' }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${fx.courseId}$`));
    await expect(page.getByRole('progressbar', { name: 'التقدّم' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    await page.getByRole('link', { name: 'ابدأ التعلّم' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fx.lesson1);
    await page.getByRole('button', { name: 'تعيين كمكتمل' }).click();
    await expect(page.getByText('تم تعيين الدرس كمكتمل')).toBeVisible();
    await expect(page.getByRole('button', { name: 'إلغاء الإكمال' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.goto(`/learn/${fx.courseId}`);
    await expect(page.getByRole('progressbar', { name: 'التقدّم' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });

  test('quiz: answers all three question types, is graded server-side and shows the review', async () => {
    await page.goto(`/learn/${fx.courseId}`);
    await page.getByRole('tab', { name: 'الاختبارات' }).click();
    await page.getByRole('link', { name: fx.quizTitle }).click();
    await expect(page.getByRole('button', { name: 'ابدأ المحاولة' })).toBeVisible();
    await page.getByRole('button', { name: 'ابدأ المحاولة' }).click();
    await expect(page).toHaveURL(/\/attempts\//);

    // The answer key must never reach the learner's DOM.
    await expect(page.getByText('القاهرة هي العاصمة.')).toHaveCount(0);

    const q1 = page.getByRole('group', { name: /السؤال الأول/ });
    const q2 = page.getByRole('group', { name: /السؤال الثاني/ });
    const q3 = page.getByRole('group', { name: /السؤال الثالث/ });
    await q1.getByRole('radio', { name: 'القاهرة' }).check(); // correct
    await q2.getByRole('checkbox', { name: 'اثنان' }).check(); // incomplete (needs two) -> wrong, no partial credit
    await expect(page.getByText(/أجبت عن/)).toContainText('2');

    // Unanswered warning in the confirmation dialog, then back to finish.
    await page.getByRole('button', { name: 'تسليم الإجابات' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('لم تجب عن 1 من الأسئلة');
    await dlg.getByRole('button', { name: 'متابعة الحل' }).click();
    await expect(dlg).toBeHidden();

    await q3.getByRole('radio', { name: 'صح' }).check(); // correct
    await page.getByRole('button', { name: 'تسليم الإجابات' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تسليم الآن' }).click();

    await expect(page.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible();
    await expect(page.getByText('الدرجة 2 من 3')).toBeVisible();
    await expect(page.getByText('67%')).toBeVisible();
    await expect(page.getByText('ناجح', { exact: true })).toBeVisible();
    await expect(page.getByText('صحيحة', { exact: true })).toHaveCount(2);
    await expect(page.getByText('خاطئة', { exact: true })).toHaveCount(1);
    await expect(page.getByText('القاهرة هي العاصمة.')).toBeVisible(); // explanation appears only after submission
    await expectNoRawServerText(page);
  });

  test('assignment: javascript: links are rejected in the form, https links are accepted', async () => {
    await page.goto(`/learn/${fx.courseId}`);
    await page.getByRole('tab', { name: 'الواجبات' }).click();
    await page.getByRole('link', { name: fx.hwTitle }).click();
    await page.getByLabel('إجابتك').fill('ملخص الدرس بقلمي.');
    await page.getByLabel(/رابط \(اختياري\)/).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'تسليم', exact: true }).click();
    await expect(page.getByText('أدخل رابطاً صحيحاً')).toBeVisible();
    await expect(page.getByText('تم حفظ التسليم')).toHaveCount(0);

    await page.getByLabel(/رابط \(اختياري\)/).fill('https://example.com/my-work');
    await page.getByRole('button', { name: 'تسليم', exact: true }).click();
    await expect(page.getByText('تم حفظ التسليم')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تسليمك' })).toBeVisible();
    await expect(page.getByText('تم التسليم', { exact: true }).first()).toBeVisible();
  });

  test('completing lesson 2 finishes the course and shows the completion banner', async () => {
    await page.goto(`/learn/${fx.courseId}`);
    await page.getByRole('link', { name: new RegExp(fx.lesson2) }).click();
    await page.getByRole('button', { name: 'تعيين كمكتمل' }).click();
    await expect(page.getByText('تم تعيين الدرس كمكتمل')).toBeVisible();
    await page.goto(`/learn/${fx.courseId}`);
    await expect(page.getByText('أحسنت! أكملت هذه الدورة.')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'التقدّم' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    await page.goto('/student');
    await expect(page.getByRole('link', { name: 'مراجعة الدورة' })).toBeVisible();
  });

  test('a student who is NOT enrolled cannot open the lessons of that course', async ({
    browser,
  }) => {
    const other = `e2e.other.${s}@example.test`;
    await registerApi(other);
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await loginUiWith(p2, other, STUDENT_PASSWORD);
    await expect(p2).toHaveURL(/\/student$/);
    await p2.goto(`/learn/${fx.courseId}/lessons/${fx.lessonIds[0]}`);
    await expect(
      p2.getByText(/ليست لديك صلاحية|الصفحة غير موجودة|سجّل في الدورة للوصول/).first(),
    ).toBeVisible();
    await expect(p2.getByText('محتوى الدرس الأول.')).toHaveCount(0);
    await expectNoRawServerText(p2);
    await c2.close();
  });

  test('no unexpected console errors during the whole journey', async () => {
    const real = errors.filter((e) => !/status of (403|404|409)/.test(e));
    expect(real, real.join('\n')).toEqual([]);
  });
});
