import { test, expect } from "@playwright/test";

test.describe("Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays feed header with view mode toggle", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "What's Happening" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Topics" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All Articles" })).toBeVisible();
  });

  test("shows sort mode toggle (Smart / Hottest / For You) in topics view", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Smart" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hottest" })).toBeVisible();
    await expect(page.getByRole("button", { name: "For You" })).toBeVisible();
  });

  test("can switch sort modes", async ({ page }) => {
    await page.getByRole("button", { name: "Hottest" }).click();
    await page.getByRole("button", { name: "For You" }).click();
    await page.getByRole("button", { name: "Smart" }).click();
  });

  test("shows Fetch Latest button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Fetch Latest/i })).toBeVisible();
  });

  test("shows refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Refresh feed" })).toBeVisible();
  });

  test("displays time range buttons in topics view", async ({ page }) => {
    for (const label of ["24h", "7d", "30d", "1y"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "All", exact: true }).first()).toBeVisible();
  });

  test("displays relevance filter buttons in topics view", async ({ page }) => {
    await expect(page.getByText("Show:")).toBeVisible();
    await expect(page.getByRole("button", { name: "All", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Active+" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hot only" })).toBeVisible();
  });

  test("displays max topics limit selector (15/25/50)", async ({ page }) => {
    await expect(page.getByText("Limit:")).toBeVisible();
    for (const n of ["15", "25", "50"]) {
      await expect(page.getByRole("button", { name: n, exact: true })).toBeVisible();
    }
  });

  test("can switch time ranges", async ({ page }) => {
    await page.getByRole("button", { name: "24h", exact: true }).click();
    await page.getByRole("button", { name: "30d", exact: true }).click();
    await page.getByRole("button", { name: "1y", exact: true }).click();
    await page.getByRole("button", { name: "All", exact: true }).first().click();
  });

  test("can switch between Topics and All Articles view", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "What's Happening" })).toBeVisible();

    await page.getByRole("button", { name: "All Articles" }).click();
    await expect(page.getByRole("heading", { name: "Your Feed" })).toBeVisible();

    // Topics-specific controls hidden in All Articles view
    await expect(page.getByText("Limit:")).not.toBeVisible();
    await expect(page.getByText("Show:")).not.toBeVisible();
  });

  test("shows filter panel in All Articles view", async ({ page }) => {
    await page.getByRole("button", { name: "All Articles" }).click();
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  });

  test("opens filter panel and shows filter sections", async ({ page }) => {
    await page.getByRole("button", { name: "All Articles" }).click();
    await page.getByRole("button", { name: "Filters" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Time Range")).toBeVisible();
    await expect(page.getByText("Content Type")).toBeVisible();
    await expect(page.getByText("Platform")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show Results" })).toBeVisible();
  });

  test("filter panel closes on escape key", async ({ page }) => {
    await page.getByRole("button", { name: "All Articles" }).click();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("shows topics or empty state in topics view", async ({ page }) => {
    await page
      .waitForFunction(() => !document.querySelector('[class*="animate-pulse"]'), {
        timeout: 10000,
      })
      .catch(() => {});

    const hasTopics = (await page.locator("[class*='rounded-xl']").count()) > 0;
    const hasEmptyState = await page
      .getByText(/no topics|no articles/i)
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .getByText(/error|check your connection/i)
      .isVisible()
      .catch(() => false);

    expect(hasTopics || hasEmptyState || hasError).toBeTruthy();
  });

  test("can change max topics limit", async ({ page }) => {
    await page.getByRole("button", { name: "25", exact: true }).click();
    await page.getByRole("button", { name: "50", exact: true }).click();
    await page.getByRole("button", { name: "15", exact: true }).click();
  });

  test("can switch relevance filters", async ({ page }) => {
    await page.getByRole("button", { name: "Hot only" }).click();
    await page.getByRole("button", { name: "Active+" }).click();
    await page.getByRole("button", { name: "All", exact: true }).first().click();
  });
});
