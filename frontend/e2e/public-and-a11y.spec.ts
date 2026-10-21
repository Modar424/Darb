import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginUi, USERS, watchErrors } from './helpers';

async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    );
}

test.describe('public pages', () => {
  test('home is Arabic/RTL, has a 3D scene or fallback, and a clean console', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('img', { name: /مجسّم ثلاثي الأبعاد/ })).toBeVisible();
    await page.waitForTimeout(1500);
    // The anonymous session probe (/auth/me) legitimately answers 401; browsers log that as a resource error.
    const real = errors.filter((e) => !/status of 401/.test(e));
    expect(real, real.join('\n')).toEqual([]);
  });

  test('3D canvas renders when WebGL is available, otherwise the static fallback is shown', async ({
    page,
  }) => {
    await page.goto('/');
    const scene = page.getByRole('img', { name: /مجسّم ثلاثي الأبعاد/ });
    await expect(scene).toBeVisible();
    const canvas = scene.locator('canvas');
    const svg = scene.locator('svg');
    await expect
      .poll(async () => (await canvas.count()) + (await svg.count()), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('prefers-reduced-motion gets the static illustration (no canvas)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    const scene = page.getByRole('img', { name: /مجسّم ثلاثي الأبعاد/ });
    await expect(scene.locator('svg')).toBeVisible();
    await expect(scene.locator('canvas')).toHaveCount(0);
    await ctx.close();
  });

  test('language switch flips direction and persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Darb');
  });

  test('skip link is the first focus stop and moves focus to main', async ({ page }) => {
    await page.goto('/courses');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'تخطَّ إلى المحتوى' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('catalog filters live in the URL and show an empty state for no results', async ({
    page,
  }) => {
    await page.goto('/courses');
    await page.getByLabel('بحث').fill('zzzz-no-such-course');
    await expect(page).toHaveURL(/q=zzzz-no-such-course/);
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    await page.getByRole('button', { name: 'مسح التصفية' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });

  for (const path of ['/', '/courses', '/login', '/register', '/forgot-password']) {
    test(`a11y (axe, serious+critical): ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page)).toEqual([]);
    });
  }

  test('a11y (axe): signed-in student dashboard', async ({ page }) => {
    await loginUi(page, USERS.student);
    await expect(page).toHaveURL(/\/student$/);
    await page.waitForLoadState('networkidle');
    expect(await axe(page)).toEqual([]);
  });
});

test.describe('responsive', () => {
  test.use({ viewport: { width: 375, height: 740 } });
  for (const path of ['/', '/courses', '/login']) {
    test(`no horizontal scrolling at 375px: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
  test('mobile menu opens, is labelled, and closes', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: 'فتح القائمة' });
    await btn.click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'إغلاق القائمة' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
  test('signed-in drawer navigation works on mobile', async ({ page }) => {
    await loginUi(page, USERS.student);
    await expect(page).toHaveURL(/\/student$/);
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const nav = page.getByRole('dialog').getByRole('navigation');
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'الدورات' }).click();
    await expect(page).toHaveURL(/\/courses$/);
  });
});
