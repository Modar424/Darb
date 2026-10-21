import { expect, test, type Page } from '@playwright/test';
import { apiLogin, createFixtureCourse, loginUi, stamp, USERS } from './helpers';

/** Keyboard-only behaviour (automated stand-in for a manual keyboard pass; not a screen-reader test). */

async function focusedIsVisiblyIndicated(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, why: 'no focus' };
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== 'none';
    const ring = el.matches(':focus-visible');
    return {
      ok: ring && (outline || shadow),
      why: `${el.tagName} outline=${cs.outlineStyle}/${cs.outlineWidth} shadow=${cs.boxShadow}`,
    };
  });
}

test('login works with the keyboard only; skip link is first and moves focus to the content', async ({
  page,
}) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'تخطَّ إلى المحتوى' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!document.activeElement?.closest('main') ||
          document.activeElement?.id === 'main-content',
      ),
    )
    .toBe(true);

  await page.getByLabel('البريد الإلكتروني').focus();
  await page.keyboard.type(USERS.student);
  await page.keyboard.press('Tab');
  await page.keyboard.type(process.env.E2E_PASSWORD ?? '');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/student$/);
});

test('every control reached with Tab shows a visible focus indicator (public pages)', async ({
  page,
}) => {
  for (const path of ['/login', '/courses', '/']) {
    await page.goto(path);
    const bad: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const r = await focusedIsVisiblyIndicated(page);
      if (r.why === 'no focus') break; // tabbed past the last control of the document
      if (!r.ok) bad.push(`${path} #${i}: ${r.why}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  }
});

test('modal dialogs trap focus, close with Escape and return focus to the opener', async ({
  page,
}) => {
  await loginUi(page, USERS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/users');
  const opener = page.getByRole('button', { name: 'إضافة مستخدم' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  // The native modal makes the page behind inert: Tab may leave the document (browser UI) but must never
  // land on a control behind the dialog.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'outside-document';
      return el.closest('dialog') ? 'dialog' : `behind:${el.tagName}`;
    });
    expect(['dialog', 'outside-document'], `Tab #${i + 1} reached ${where}`).toContain(where);
  }
  await dlg.getByRole('button', { name: 'حفظ' }).focus();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(opener).toBeFocused();
});

test('the question dialog (instructor) also returns focus to its opener', async ({ page }) => {
  const s = stamp();
  const instr = await apiLogin(USERS.instructor);
  const fx = await createFixtureCourse(instr, s);
  await loginUi(page, USERS.instructor);
  await expect(page).toHaveURL(/\/instructor$/);
  await page.goto(`/instructor/assessments/${fx.quizId}`);
  const opener = page.getByRole('button', { name: 'إضافة سؤال' });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(opener).toBeFocused();
});

test('quiz options are operable by keyboard (radio group with arrow keys, space to choose)', async ({
  page,
}) => {
  const s = stamp();
  const instr = await apiLogin(USERS.instructor);
  const fx = await createFixtureCourse(instr, s);
  await loginUi(page, USERS.student);
  await expect(page).toHaveURL(/\/student$/);
  await page.goto(`/courses/${fx.slug}`);
  await page.getByRole('button', { name: 'سجّل في الدورة' }).click();
  await expect(page.getByText('تم تسجيلك في الدورة')).toBeVisible();
  await page.goto(`/learn/${fx.courseId}/assessments/${fx.quizId}`);
  await page.getByRole('button', { name: 'ابدأ المحاولة' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/attempts\//);
  const q1 = page.getByRole('group', { name: /السؤال الأول/ });
  await q1.getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await expect(q1.getByRole('radio').first()).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(q1.getByRole('radio').nth(1)).toBeChecked();
});
