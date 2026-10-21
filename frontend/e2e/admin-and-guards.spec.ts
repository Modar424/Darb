import { expect, test } from '@playwright/test';
import {
  apiLogin,
  expectNoRawServerText,
  loginUi,
  loginUiWith,
  PASSWORD,
  registerApi,
  STUDENT_PASSWORD,
  stamp,
  USERS,
} from './helpers';

test.describe('admin console', () => {
  const s = stamp();
  const email = `e2e.managed.${s}@example.test`;
  const name = `Managed ${s}`;

  test('stats page loads and the users list supports search and role filter', async ({ page }) => {
    await loginUi(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'لوحة الإدارة' })).toBeVisible();
    await expect(page.getByText('إجمالي المستخدمين')).toBeVisible();

    await page.goto('/admin/users');
    await expect(page.getByRole('row').nth(1)).toBeVisible(); // list is paginated; filtering/search is asserted below
    await page.getByLabel('الأدوار').selectOption('ADMIN');
    await expect(page).toHaveURL(/role=ADMIN/);
    await expect(page.getByRole('row').filter({ hasText: USERS.admin })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: USERS.student })).toHaveCount(0);
    await page.getByLabel('الأدوار').selectOption('');
    await page.getByLabel('بحث').fill('student3@');
    await expect(page.getByRole('row').filter({ hasText: USERS.student })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'student1@' })).toHaveCount(0);
  });

  test('creates a user, then edits their role', async ({ page }) => {
    await loginUi(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'إضافة مستخدم' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('الاسم الكامل').fill(name);
    await dlg.getByLabel('البريد الإلكتروني').fill(email);
    await dlg.getByLabel('كلمة المرور').fill(STUDENT_PASSWORD);
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('تمت إضافة المستخدم')).toBeVisible();

    await page.getByLabel('بحث').fill(email);
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText('طالب', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: `تعديل ${name}` }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'مدرّس' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('تم الحفظ')).toBeVisible();
    await expect(row.getByText('مدرّس', { exact: true })).toBeVisible();
  });

  test('an admin cannot demote themselves: translated message, nothing changes', async ({
    page,
  }) => {
    await loginUi(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/users');
    await page.getByLabel('بحث').fill(USERS.admin);
    const row = page.getByRole('row').filter({ hasText: USERS.admin });
    await row.getByRole('button', { name: /^تعديل/ }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText(/هذا حسابك/)).toBeVisible();
    await expect(dlg.getByLabel('الحالة')).toBeDisabled();
    await dlg.getByRole('checkbox', { name: 'طالب' }).check();
    await dlg.getByRole('checkbox', { name: 'مدير' }).uncheck();
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(dlg.getByText('لا يمكن للمدير خفض صلاحياته أو تعليق حسابه بنفسه.')).toBeVisible();
    await expectNoRawServerText(page);
    const admin = await apiLogin(USERS.admin);
    const me = await admin.call<{ user: { roles: string[] } }>('GET', '/auth/me');
    expect(me.data.user.roles).toContain('ADMIN');
  });
});

test.describe('role guards, redirects, sessions', () => {
  test('students see the forbidden state on /admin and /instructor', async ({ page }) => {
    await loginUi(page, USERS.student);
    await expect(page).toHaveURL(/\/student$/);
    for (const path of ['/admin', '/instructor']) {
      await page.goto(path);
      await expect(page.getByText('ليست لديك صلاحية')).toBeVisible();
    }
  });

  test('the API itself enforces roles: a student gets 403 on /admin/stats and /admin/users', async () => {
    const stu = await apiLogin(USERS.student);
    expect((await stu.call('GET', '/admin/stats')).status).toBe(403);
    expect((await stu.call('GET', '/admin/users')).status).toBe(403);
    expect(
      (
        await stu.call('POST', '/courses', {
          title: 'x',
          summary: 'xxxxxxxxxx',
          description: 'xxxxxxxxxx',
        })
      ).status,
    ).toBe(403);
    const anon = await (
      await import('@playwright/test')
    ).request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' });
    expect((await anon.get('/api/v1/admin/stats')).status()).toBe(401);
    await anon.dispose();
  });

  test('anonymous visitors are sent to /login?next= and return after signing in', async ({
    page,
  }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login\?next=%2Fstudent/);
    await page.getByLabel('البريد الإلكتروني').fill(USERS.student);
    await page.getByLabel('كلمة المرور').fill(PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('an external ?next= is never followed (open redirect)', async ({ page }) => {
    await loginUi(page, USERS.student, 'https://evil.example/phish');
    await expect(page).toHaveURL(/localhost:3000\/student$/);
    await page.context().clearCookies();
    await loginUi(page, USERS.student, '//evil.example');
    await expect(page).toHaveURL(/localhost:3000\/student$/);
  });

  test('a server-side revoked session redirects to /login with the "session expired" message', async ({
    browser,
  }) => {
    const s = stamp();
    const email = `e2e.expire.${s}@example.test`;
    await registerApi(email, `Expire ${s}`);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginUiWith(page, email, STUDENT_PASSWORD);
    await expect(page).toHaveURL(/\/student$/);

    const admin = await apiLogin(USERS.admin);
    const found = await admin.call<{ id: string }[]>(
      'GET',
      `/admin/users?q=${encodeURIComponent(email)}`,
    );
    const id = found.data[0]?.id as string;
    expect((await admin.call('PATCH', `/admin/users/${id}`, { status: 'SUSPENDED' })).status).toBe(
      200,
    );

    // The page is still open with a now-dead session. The next API call (a background refetch or a user
    // action such as opening the profile) must lead to /login with the "session expired" message.
    await page
      .getByRole('link', { name: 'الملف الشخصي' })
      .first()
      .click({ timeout: 3000 })
      .catch(() => undefined);
    await expect(page).toHaveURL(/\/login\?expired=1/);
    await expect(page.getByText('انتهت جلستك، سجّل الدخول للمتابعة.')).toBeVisible();
    await ctx.close();
  });

  test('after logout a protected page cannot be reached again, including with the back button', async ({
    page,
  }) => {
    await loginUi(page, USERS.student);
    await expect(page).toHaveURL(/\/student$/);
    await page.getByRole('button', { name: 'تسجيل الخروج' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/^مرحباً/)).toHaveCount(0);
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
