import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  apiLogin,
  createFixtureCourse,
  loginUiWith,
  registerApi,
  STUDENT_PASSWORD,
  stamp,
  USERS,
} from './helpers';

/** Real-browser behaviour of the timed quiz (server time is the source of truth). */
test.describe.serial('timed quiz', () => {
  const s = stamp();
  const email = `e2e.timer.${s}@example.test`;
  let fx: Awaited<ReturnType<typeof createFixtureCourse>>;
  let ctx: BrowserContext;
  let page: Page;

  const open = async (p: Page) => {
    await p.goto(`/learn/${fx.courseId}/assessments/${fx.quizId}`);
    await p
      .getByRole('button', { name: /ابدأ المحاولة|متابعة المحاولة/ })
      .or(p.getByRole('link', { name: 'متابعة المحاولة' }))
      .first()
      .click();
    await expect(p).toHaveURL(/\/attempts\//);
  };
  const seconds = async (p: Page) => {
    const [m, sec] = (await p.getByRole('timer').innerText()).split(':').map(Number);
    return (m as number) * 60 + (sec as number);
  };

  test.beforeAll(async ({ browser }) => {
    const instr = await apiLogin(USERS.instructor);
    fx = await createFixtureCourse(instr, s);
    const r = await instr.call('PATCH', `/assessments/${fx.quizId}`, {
      timeLimitMinutes: 1,
      maxAttempts: 10,
    });
    expect(r.status).toBe(200);
    await registerApi(email, `Timer ${s}`);
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginUiWith(page, email, STUDENT_PASSWORD);
    await expect(page).toHaveURL(/\/student$/);
    await page.goto(`/courses/${fx.slug}`);
    await page.getByRole('button', { name: 'سجّل في الدورة' }).click();
    await expect(page.getByText('تم تسجيلك في الدورة')).toBeVisible();
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test('beforeunload warning only appears when there are unsent answers', async () => {
    await open(page);
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.type());
      void d.accept();
    });
    await page.reload(); // nothing answered -> no warning
    await expect(page.getByRole('timer')).toBeVisible();
    expect(dialogs).toEqual([]);
    await page
      .getByRole('group', { name: /السؤال الأول/ })
      .getByRole('radio', { name: 'القاهرة' })
      .check();
    await page.reload(); // dirty -> warning
    expect(dialogs).toContain('beforeunload');
    page.removeAllListeners('dialog');
  });

  test('closing and reopening continues from the server deadline, not from zero', async () => {
    await expect(page.getByRole('timer')).toBeVisible();
    const before = await seconds(page);
    expect(before).toBeLessThanOrEqual(60);
    await page.waitForTimeout(4000);
    const url = page.url();
    await page.goto('about:blank');
    await page.waitForTimeout(2000);
    await page.goto(url);
    const after = await seconds(page);
    expect(after).toBeLessThan(before - 4);
    expect(after).toBeGreaterThan(0);
  });

  test('the same attempt open in two tabs: second submit is rejected cleanly (no double grading)', async () => {
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await a.goto(page.url());
    await b.goto(page.url());
    for (const p of [a, b]) {
      await p
        .getByRole('group', { name: /السؤال الأول/ })
        .getByRole('radio', { name: 'القاهرة' })
        .check();
    }
    await a.getByRole('button', { name: 'تسليم الإجابات' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'تسليم الآن' }).click();
    await expect(a.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible();

    await b.getByRole('button', { name: 'تسليم الإجابات' }).click();
    await b.getByRole('dialog').getByRole('button', { name: 'تسليم الآن' }).click();
    await expect(b.getByText(/تم إغلاق هذه المحاولة مسبقاً|لا يمكن إتمام الإجراء/)).toBeVisible();
    await expect(b.getByRole('dialog')).toBeHidden();
    await a.close();
    await b.close();
  });

  test('when time runs out the answers are auto-submitted exactly once and the result is shown', async () => {
    test.setTimeout(150_000);
    await open(page);
    const submits: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/attempts\/[^/]+\/submit$/.test(r.url()))
        submits.push(r.url());
    });
    await page
      .getByRole('group', { name: /السؤال الأول/ })
      .getByRole('radio', { name: 'القاهرة' })
      .check();
    await page
      .getByRole('group', { name: /السؤال الثالث/ })
      .getByRole('radio', { name: 'صح' })
      .check();
    page.once('dialog', (d) => void d.accept());
    await expect(page.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('الدرجة 2 من 3')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(submits).toHaveLength(1);
  });

  test('an attempt left open past its deadline is closed by the server: translated message, no hang', async () => {
    test.setTimeout(150_000);
    // Start a fresh attempt through the API and let it expire without any browser involvement.
    const stu = await apiLogin(email, STUDENT_PASSWORD);
    const started = await stu.call<{ attempt: { id: string } }>(
      'POST',
      `/assessments/${fx.quizId}/attempts`,
    );
    expect([200, 201]).toContain(started.status);
    await page.waitForTimeout(67_000);
    await page.goto(`/learn/${fx.courseId}/attempts/${started.data.attempt.id}`);
    await expect(
      page
        .getByText('انتهى وقت هذه المحاولة وأُغلقت دون درجة.')
        .or(page.getByText('منتهية'))
        .first(),
    ).toBeVisible();
  });
});
