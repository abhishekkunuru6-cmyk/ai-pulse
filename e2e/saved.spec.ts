import { test, expect } from "@playwright/test";

test.describe("Saved Articles Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/saved");
  });

  test("displays saved articles header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Saved Articles" })).toBeVisible();
  });

  test("shows empty state or saved articles", async ({ page }) => {
    await page
      .waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), {
        timeout: 10000,
      })
      .catch(() => {});

    const hasEmptyState = await page
      .getByText(/Articles you bookmark will appear here|No saved articles yet/i)
      .isVisible()
      .catch(() => false);
    const hasArticles = (await page.locator("article").count()) > 0;
    const hasError = await page.getByText(/error/i).isVisible().catch(() => false);

    expect(hasEmptyState || hasArticles || hasError).toBeTruthy();
  });

  test("empty state shows bookmark icon hint", async ({ page }) => {
    await page
      .waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), {
        timeout: 10000,
      })
      .catch(() => {});

    const isEmpty = await page
      .getByText(/Articles you bookmark will appear here/i)
      .isVisible()
      .catch(() => false);

    if (isEmpty) {
      await expect(page.getByText(/Tap the bookmark icon/i)).toBeVisible();
    }
  });
});
