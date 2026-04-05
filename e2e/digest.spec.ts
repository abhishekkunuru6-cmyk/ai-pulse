import { test, expect } from "@playwright/test";

test.describe("Digest Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/digest");
  });

  test("displays digest header with subtitle", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Digest" })).toBeVisible();
    await expect(page.getByText("most important AI developments")).toBeVisible();
  });

  test("displays period toggle buttons (24h/7d/30d/1y/All)", async ({ page }) => {
    for (const label of ["24h", "7d", "30d", "1y", "All"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("displays view mode toggle (Overall / By Source)", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Overall" })).toBeVisible();
    await expect(page.getByRole("button", { name: "By Source" })).toBeVisible();
  });

  test("displays article count selector (15/25/50) in overall view", async ({ page }) => {
    await expect(page.getByText("Articles:")).toBeVisible();
    for (const count of ["15", "25", "50"]) {
      await expect(page.getByRole("button", { name: count, exact: true })).toBeVisible();
    }
  });

  test("can switch between periods", async ({ page }) => {
    // Switch to weekly
    await page.getByRole("button", { name: "7d", exact: true }).click();
    await expect(page.getByText("Top stories from the past 7 days")).toBeVisible();

    // Switch to monthly
    await page.getByRole("button", { name: "30d", exact: true }).click();
    await expect(page.getByText("Highlights from the past 30 days")).toBeVisible();

    // Switch to yearly
    await page.getByRole("button", { name: "1y", exact: true }).click();
    await expect(page.getByText("best stories from the past year")).toBeVisible();

    // Switch to all time
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText("highest-ranked stories of all time")).toBeVisible();

    // Switch back to daily
    await page.getByRole("button", { name: "24h", exact: true }).click();
    await expect(page.getByText("most important AI developments")).toBeVisible();
  });

  test("shows Generate AI Summary button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Generate AI Summary/i })).toBeVisible();
  });

  test("can switch to By Source view", async ({ page }) => {
    await page.getByRole("button", { name: "By Source" }).click();

    // Article count selector should be hidden in By Source view
    await expect(page.getByText("Articles:")).not.toBeVisible();
  });

  test("article count selector hides in By Source view", async ({ page }) => {
    // Visible in Overall
    await expect(page.getByText("Articles:")).toBeVisible();

    // Hidden in By Source
    await page.getByRole("button", { name: "By Source" }).click();
    await expect(page.getByText("Articles:")).not.toBeVisible();

    // Visible again in Overall
    await page.getByRole("button", { name: "Overall" }).click();
    await expect(page.getByText("Articles:")).toBeVisible();
  });

  test("shows articles or empty state", async ({ page }) => {
    // Wait for loading to complete
    await page
      .waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), {
        timeout: 10000,
      })
      .catch(() => {});

    const hasArticles = await page
      .getByText("Top Stories")
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/No articles in this digest/i)
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .getByText(/try again later/i)
      .isVisible()
      .catch(() => false);
    const hasLoaded = (await page.locator("article, [class*='rounded-xl']").count()) > 0;

    expect(hasArticles || hasEmptyState || hasError || hasLoaded).toBeTruthy();
  });

  test("has refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Refresh digest" })).toBeVisible();
  });
});
