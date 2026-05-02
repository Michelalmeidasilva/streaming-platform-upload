import { test, expect } from '@playwright/test';

test('anonymous users see sign-in guidance', async ({ page, request }) => {
  const response = await request.get('/api/videos');
  expect(response.status()).toBe(401);

  await page.goto('/');
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
});
