import { expect, test } from '@playwright/test';

test('theme toggle switches to dark, persists across reloads (server-rendered, no flash) and back', async ({
  page,
}) => {
  await page.goto('/courses');
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: 'تبديل المظهر (فاتح / داكن)' }).first();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)'
        ? getComputedStyle(document.documentElement).backgroundColor
        : getComputedStyle(document.body).backgroundColor,
    ),
  ).toBe('rgb(10, 20, 30)');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark'); // rendered by the server from the cookie
  await page.getByRole('button', { name: 'تبديل المظهر (فاتح / داكن)' }).first().click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('first visit follows the OS dark preference', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto('/courses');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await ctx.close();
});
