import { test, expect } from "@playwright/test";

test.describe("Search Page", () => {
  test("navigates to search page", async ({ page }) => {
    await page.goto("/search");

    // Search input should be visible and focused
    const input = page.getByPlaceholder("Search articles...");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("shows placeholder text before searching", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText("Search across all your articles")).toBeVisible();
  });

  test("shows results or no results after typing", async ({ page }) => {
    await page.goto("/search");

    const input = page.getByPlaceholder("Search articles...");
    await input.fill("AI");

    // Wait for debounce + request
    await page.waitForTimeout(1000);

    const hasResults = (await page.locator("[class*='space-y-3']").count()) > 0;
    const hasNoResults = await page
      .getByText("No results found")
      .isVisible()
      .catch(() => false);

    expect(hasResults || hasNoResults).toBeTruthy();
  });

  test("back button returns to feed", async ({ page }) => {
    await page.goto("/search");

    // The back link is an icon-only link to "/", find it by href
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL("/");
  });
});
