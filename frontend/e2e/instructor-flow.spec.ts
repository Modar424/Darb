import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  apiLogin,
  expectNoRawServerText,
  loginUi,
  registerApi,
  STUDENT_PASSWORD,
  stamp,
  USERS,
  watchErrors,
} from './helpers';

/**
 * Instructor journey in the real UI: create a course (with validation), build the curriculum, reorder,
 * publish rules, quiz authoring (3 question types + rules), assignment authoring, grading a real student
 * submission (range validation), and the learner roster with progress.
 */
test.describe.serial('instructor journey', () => {
  const s = stamp();
  const courseTitle = `دورة المدرّس ${s}`;
  const L1 = `درس نصي ${s}`;
  const L2 = `درس فيديو ${s}`;
  const quizTitle = `اختبار المدرّس ${s}`;
  const hwTitle = `واجب المدرّس ${s}`;
  const learnerName = `Learner ${s}`;
  const learnerEmail = `e2e.learner.${s}@example.test`;
  let ctx: BrowserContext;
  let page: Page;
  let errors: string[];
  let courseId = '';
  let assessmentId = '';
  let assignmentId = '';

  const dialog = () => page.getByRole('dialog');
  const idFrom = (re: RegExp) => page.url().match(re)?.[1] ?? '';

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
    errors = watchErrors(page);
    await loginUi(page, USERS.instructor);
    await expect(page).toHaveURL(/\/instructor$/);
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test('new-course form validates empty fields in Arabic, then creates a draft', async () => {
    await page.goto('/instructor/courses/new');
    await page.getByRole('button', { name: 'إنشاء الدورة' }).click();
    await expect(page.getByText(/من 3 إلى 160 حرفاً/)).toBeVisible();
    await expect(page.getByText(/من 10 إلى 500 حرف/)).toBeVisible();
    await expect(page.getByText(/لا يقلّ الوصف عن 10 أحرف/)).toBeVisible();

    await page.getByLabel('عنوان الدورة').fill(courseTitle);
    await page.getByLabel('ملخص قصير').fill('ملخص قصير لدورة يبنيها المدرّس من الواجهة.');
    await page
      .getByLabel('الوصف الكامل')
      .fill('وصف كامل للدورة التي تُبنى بالكامل عبر واجهة المدرّس في اختبار المتصفح.');
    await page.getByRole('button', { name: 'إنشاء الدورة' }).click();
    await expect(page.getByText('تم إنشاء الدورة كمسودة')).toBeVisible();
    await expect(page).toHaveURL(/\/instructor\/courses\/[0-9a-f-]{36}$/);
    courseId = idFrom(/courses\/([0-9a-f-]{36})/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(courseTitle);
    await expect(page.getByText('مسودة', { exact: true }).first()).toBeVisible();
  });

  test('publishing a course without lessons is refused with a translated message', async () => {
    await page.getByRole('button', { name: 'نشر الدورة' }).click();
    await expect(page.getByText('أضف درساً واحداً على الأقل قبل نشر الدورة.')).toBeVisible();
    await expectNoRawServerText(page);
  });

  test('builds the curriculum: module, text lesson, video lesson (URL validated)', async () => {
    await page.getByRole('tab', { name: 'المنهج' }).click();
    await page.getByRole('button', { name: 'إضافة وحدة' }).first().click();
    await dialog().getByLabel('عنوان الوحدة').fill('الوحدة الأولى');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByRole('heading', { name: 'الوحدة الأولى' })).toBeVisible();

    await page.getByRole('button', { name: 'إضافة درس' }).click();
    await dialog().getByLabel('عنوان الدرس').fill(L1);
    await dialog().getByLabel('نص الدرس').fill('نص الدرس الأول.');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText(L1)).toBeVisible();

    await page.getByRole('button', { name: 'إضافة درس' }).click();
    await dialog().getByLabel('عنوان الدرس').fill(L2);
    await dialog().getByLabel('نوع المحتوى').selectOption('VIDEO');
    await dialog()
      .getByLabel(/^رابط المحتوى/)
      .fill('javascript:alert(1)');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog().getByText(/أدخل رابطاً صحيحاً/)).toBeVisible();
    await dialog()
      .getByLabel(/^رابط المحتوى/)
      .fill('https://example.com/video');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText(L2)).toBeVisible();
  });

  test('reordering lessons with the move buttons persists after reload', async () => {
    const rows = page.locator('main ul > li');
    await expect(rows.first()).toContainText(L1);
    await rows.filter({ hasText: L1 }).getByRole('button', { name: 'نقل للأسفل' }).click();
    await expect(rows.first()).toContainText(L2);
    await page.reload();
    await page.getByRole('tab', { name: 'المنهج' }).click();
    await expect(page.locator('main ul > li').first()).toContainText(L2);
    await expect(page.locator('main ul > li').nth(1)).toContainText(L1);
  });

  test('publishes the course once it has lessons and it appears in the public catalogue', async () => {
    await page.getByRole('tab', { name: 'التفاصيل' }).click();
    await page.getByRole('button', { name: 'نشر الدورة' }).click();
    await expect(page.getByText('تم نشر الدورة')).toBeVisible();
    await expect(page.getByText('منشورة', { exact: true }).first()).toBeVisible();
    await page.goto('/courses');
    await page.getByLabel('بحث').fill(courseTitle);
    await expect(page.getByRole('link', { name: courseTitle })).toBeVisible();
  });

  test('quiz authoring: settings validation, empty-publish refusal, three question types, publish', async () => {
    await page.goto(`/instructor/courses/${courseId}`);
    await page.getByRole('tab', { name: 'الاختبارات' }).click();
    await page.getByRole('button', { name: 'إنشاء اختبار' }).click();
    await dialog().getByLabel('عنوان الاختبار').fill(quizTitle);
    await dialog()
      .getByLabel(/درجة النجاح/)
      .fill('150');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog().getByText('القيمة خارج النطاق المسموح.')).toBeVisible();
    await dialog()
      .getByLabel(/درجة النجاح/)
      .fill('60');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await page.getByRole('link', { name: quizTitle }).click();
    await expect(page).toHaveURL(/\/instructor\/assessments\//);
    assessmentId = idFrom(/assessments\/([0-9a-f-]{36})/);

    // publishing a quiz with no questions is refused
    await page.getByRole('button', { name: 'نشر', exact: true }).click();
    await expect(page.getByText('أضف سؤالاً واحداً على الأقل قبل النشر.')).toBeVisible();

    // single choice
    await page.getByRole('button', { name: 'إضافة سؤال' }).click();
    await dialog().getByLabel('نص السؤال').fill('اختر الإجابة الصحيحة');
    await dialog().getByRole('textbox', { name: 'الخيار 1', exact: true }).fill('الأولى');
    await dialog().getByRole('textbox', { name: 'الخيار 2', exact: true }).fill('الثانية');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('اختر الإجابة الصحيحة')).toBeVisible();

    // multiple choice: needs at least one correct answer
    await page.getByRole('button', { name: 'إضافة سؤال' }).click();
    await dialog().getByLabel('نوع السؤال').selectOption('MULTIPLE_CHOICE');
    await dialog().getByLabel('نص السؤال').fill('اختر كل ما ينطبق');
    await dialog().getByRole('textbox', { name: 'الخيار 1', exact: true }).fill('أ');
    await dialog().getByRole('textbox', { name: 'الخيار 2', exact: true }).fill('ب');
    await dialog().getByLabel('تعيين الخيار 1 كإجابة صحيحة').uncheck();
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog().getByText('حدّد إجابة صحيحة واحدة على الأقل.')).toBeVisible();
    await dialog().getByLabel('تعيين الخيار 1 كإجابة صحيحة').check();
    await dialog().getByLabel('تعيين الخيار 2 كإجابة صحيحة').check();
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('اختر كل ما ينطبق')).toBeVisible();

    // true / false
    await page.getByRole('button', { name: 'إضافة سؤال' }).click();
    await dialog().getByLabel('نوع السؤال').selectOption('TRUE_FALSE');
    await dialog().getByLabel('نص السؤال').fill('هل الجملة صحيحة؟');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('هل الجملة صحيحة؟')).toBeVisible();

    await page.getByRole('button', { name: 'نشر', exact: true }).click();
    await expect(page.getByText('تم نشر الاختبار')).toBeVisible();
    await expect(page.getByText('منشور', { exact: true }).first()).toBeVisible();
  });

  test('the API (not only the form) enforces "exactly one correct answer" for single choice', async () => {
    const instr = await apiLogin(USERS.instructor);
    const bad = await instr.call('POST', `/assessments/${assessmentId}/questions`, {
      type: 'SINGLE_CHOICE',
      prompt: 'سؤال مخالف',
      options: [
        { id: 'o1', text: 'أ' },
        { id: 'o2', text: 'ب' },
      ],
      correctOptionIds: ['o1', 'o2'],
    });
    expect([400, 409]).toContain(bad.status);
  });

  test('assignment authoring, then grading a real submission (range validated)', async () => {
    await page.goto(`/instructor/courses/${courseId}`);
    await page.getByRole('tab', { name: 'الواجبات' }).click();
    await page.getByRole('button', { name: 'إنشاء واجب' }).click();
    await dialog().getByLabel('عنوان الواجب').fill(hwTitle);
    await dialog().getByLabel('التعليمات').fill('اكتب الحل كاملاً.');
    await dialog().getByRole('button', { name: 'حفظ' }).click();
    await page.getByRole('link', { name: hwTitle }).click();
    await expect(page).toHaveURL(/\/instructor\/assignments\//);
    assignmentId = idFrom(/assignments\/([0-9a-f-]{36})/);
    await page.getByRole('button', { name: 'نشر', exact: true }).click();
    await expect(page.getByText('تم نشر الواجب')).toBeVisible();

    // a real student enrols, completes one lesson and submits
    await registerApi(learnerEmail, learnerName);
    const stu = await apiLogin(learnerEmail, STUDENT_PASSWORD);
    expect([200, 201]).toContain((await stu.call('POST', `/courses/${courseId}/enroll`)).status);
    const cur = await stu.call<{ modules: { lessons: { id: string }[] }[] }>(
      'GET',
      `/courses/${courseId}/curriculum`,
    );
    const firstLesson = cur.data.modules[0]?.lessons[0]?.id as string;
    expect([200, 201]).toContain(
      (await stu.call('POST', `/lessons/${firstLesson}/complete`)).status,
    );
    expect(
      (await stu.call('PUT', `/assignments/${assignmentId}/submission`, { content: 'حل الطالب' }))
        .status,
    ).toBe(200);

    await page.reload();
    const row = page.getByRole('row').filter({ hasText: learnerName });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'تصحيح' }).click();
    await expect(dialog().getByText('حل الطالب')).toBeVisible();
    await dialog()
      .getByLabel(/الدرجة \(من 100\)/)
      .fill('150');
    await dialog().getByRole('button', { name: 'حفظ الدرجة' }).click();
    await expect(dialog().getByText('القيمة خارج النطاق المسموح.')).toBeVisible();
    await dialog()
      .getByLabel(/الدرجة \(من 100\)/)
      .fill('85');
    await dialog().getByLabel('التغذية الراجعة').fill('عمل ممتاز.');
    await dialog().getByRole('button', { name: 'حفظ الدرجة' }).click();
    await expect(page.getByText('تم حفظ الدرجة')).toBeVisible();
    await expect(row).toContainText('85/100');

    // the student sees the grade and feedback
    const gradedFor = await stu.call<{ status: string; grade: number; feedback: string }>(
      'GET',
      `/assignments/${assignmentId}`,
    );
    expect(gradedFor.data).toMatchObject({ mySubmission: { status: 'GRADED', grade: 85 } });
  });

  test('learners tab lists the enrolled student with real progress (1 of 2 lessons = 50%)', async () => {
    await page.goto(`/instructor/courses/${courseId}`);
    await page.getByRole('tab', { name: 'المتعلّمون' }).click();
    const row = page.getByRole('row').filter({ hasText: learnerName });
    await expect(row).toBeVisible();
    await expect(row.getByRole('progressbar', { name: 'التقدّم' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    await expect(row.getByText('جارٍ')).toBeVisible();
  });

  test('no unexpected console errors during the instructor journey', async () => {
    const real = errors.filter((e) => !/status of (400|409)/.test(e));
    expect(real, real.join('\n')).toEqual([]);
  });
});
