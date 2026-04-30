import { test, expect } from '@playwright/test';

const baseUrl =
  process.env.TASKY_BASE_URL && process.env.TASKY_BASE_URL.length > 0
    ? process.env.TASKY_BASE_URL
    : 'http://localhost';

test('create task → reload → task is still visible', async ({ page }) => {
  // (a) Navigate to the app
  await page.goto(baseUrl);

  // (b) Generate a unique description to avoid collisions across runs
  const description = `smoke-test-${Date.now()}`;

  // (c)/(d) Locate the input and type the description
  const input = page.getByRole('textbox', { name: 'Task description' });
  await input.fill(description);

  // (e) Submit via Enter (the form's native submit path)
  await input.press('Enter');

  // (f) Wait for the task to appear
  const taskRow = page.getByRole('listitem').filter({ hasText: description });
  await expect(taskRow).toBeVisible({ timeout: 5000 });

  // (g) Reload — the durability test
  await page.reload();

  // (h) The task MUST still be visible after reload (proves server persistence)
  await expect(taskRow).toBeVisible({ timeout: 5000 });

  // (i) Cleanup: delete the task and assert removal
  const deleteButton = taskRow.getByRole('button', { name: 'Delete' });
  await deleteButton.click();
  await expect(taskRow).toHaveCount(0, { timeout: 5000 });
});
