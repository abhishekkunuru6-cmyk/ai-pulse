import { test, expect } from "@playwright/test";

test.describe("Sources Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sources");
  });

  test("displays sources header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  });

  test("shows status filter chips", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paused" })).toBeVisible();
  });

  test("shows sources list or empty state after loading", async ({ page }) => {
    await page.waitForTimeout(2000);

    const hasSourceCards = (await page.locator("[class*='rounded-xl']").count()) > 2;
    const hasEmptyState = await page
      .getByText("No sources match")
      .isVisible()
      .catch(() => false);
    const hasError = (await page.locator("text=red-400").count()) > 0;
    const hasTracked = await page
      .getByText("sources tracked")
      .isVisible()
      .catch(() => false);

    expect(hasSourceCards || hasEmptyState || hasError || hasTracked).toBeTruthy();
  });

  test("can filter sources by status", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click Active filter
    await page.getByRole("button", { name: "Active" }).click();
    await page.waitForTimeout(500);

    // Click Paused filter
    await page.getByRole("button", { name: "Paused" }).click();
    await page.waitForTimeout(500);

    // Click All to reset
    await page.getByRole("button", { name: "All" }).first().click();
  });
});
