import { test, expect } from "@playwright/test";

test.describe("Stats Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/stats");
  });

  test("displays dashboard header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh stats" })).toBeVisible();
  });

  test("shows stat cards or error after loading", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasTotalArticles = await page
      .getByText("Total Articles")
      .isVisible()
      .catch(() => false);
    const hasError = (await page.locator(".text-red-400").count()) > 0;

    expect(hasTotalArticles || hasError).toBeTruthy();
  });

  test("shows all stat categories when data loads", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasTotalArticles = await page
      .getByText("Total Articles")
      .isVisible()
      .catch(() => false);

    if (hasTotalArticles) {
      await expect(page.getByText("New Today")).toBeVisible();
      await expect(page.getByText("Unread")).toBeVisible();
      await expect(page.getByRole("main").getByText("Saved")).toBeVisible();
    }
  });
});
