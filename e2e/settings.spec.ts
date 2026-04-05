import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("displays settings header", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Customize your AI Pulse experience")).toBeVisible();
  });

  test("displays theme options (Dark / Light / System)", async ({ page }) => {
    await expect(page.getByText("Theme")).toBeVisible();
    await expect(page.getByRole("button", { name: /Dark/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Light/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /System/i })).toBeVisible();
  });

  test("displays minimum engagement score options", async ({ page }) => {
    await expect(page.getByText("Minimum Engagement Score")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show all" })).toBeVisible();
  });

  test("does NOT show digest article count section (moved to digest page)", async ({ page }) => {
    await expect(page.getByText("Digest Article Count")).not.toBeVisible();
  });

  test("displays ranking weights section with sliders", async ({ page }) => {
    const rankingSection = page.getByText("Ranking Weights").first();
    await rankingSection.scrollIntoViewIfNeeded();
    await expect(rankingSection).toBeVisible();

    await page.getByText("Virality").scrollIntoViewIfNeeded();
    await expect(page.getByText("Virality")).toBeVisible();
    await expect(page.getByText("Recency")).toBeVisible();
    await expect(page.getByText("Research Interest")).toBeVisible();

    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(3);
  });

  test("displays boosted keywords section", async ({ page }) => {
    await expect(page.getByText("Boosted Keywords")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. transformer, RAG, agents")).toBeVisible();
  });

  test("displays blocked keywords section", async ({ page }) => {
    await expect(page.getByText("Blocked Keywords")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. crypto, nft, web3")).toBeVisible();
  });

  test("displays platform visibility toggles", async ({ page }) => {
    await expect(page.getByText("Platform Visibility")).toBeVisible();
  });

  test("displays personalized relevance section with compute button", async ({ page }) => {
    await expect(page.getByText("Personalized Relevance")).toBeVisible();
    await expect(page.getByRole("button", { name: /Compute Relevance Scores/i })).toBeVisible();
  });

  test("displays data ingestion (Fetch Latest) section", async ({ page }) => {
    await expect(page.getByText("Data Ingestion")).toBeVisible();
    await expect(page.getByRole("button", { name: /Fetch Latest/i })).toBeVisible();
  });

  test("displays recompute scores section", async ({ page }) => {
    await expect(page.getByText("Recompute Scores")).toBeVisible();
    await expect(page.getByRole("button", { name: /Recompute All Scores/i })).toBeVisible();
  });

  test("displays backfill historical content section", async ({ page }) => {
    await expect(page.getByText("Backfill Historical Content")).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 1 Month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 3 Months" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 6 Months" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 1 Year" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Backfill/i })).toBeVisible();
  });

  test("can add and remove a boosted keyword", async ({ page }) => {
    const input = page.getByPlaceholder("e.g. transformer, RAG, agents");
    await input.fill("test-keyword");
    await input.press("Enter");

    await expect(page.getByText("test-keyword")).toBeVisible();

    await page.getByRole("button", { name: "Remove test-keyword" }).click();
    await expect(page.getByText("test-keyword")).not.toBeVisible();
  });

  test("can add and remove a blocked keyword", async ({ page }) => {
    const input = page.getByPlaceholder("e.g. crypto, nft, web3");
    await input.fill("spam-keyword");
    await input.press("Enter");

    await expect(page.getByText("spam-keyword")).toBeVisible();

    await page.getByRole("button", { name: "Remove spam-keyword" }).click();
    await expect(page.getByText("spam-keyword")).not.toBeVisible();
  });

  test("can select different backfill periods", async ({ page }) => {
    await page.getByRole("button", { name: "Last 3 Months" }).click();
    await page.getByRole("button", { name: "Last 6 Months" }).click();
    await page.getByRole("button", { name: "Last 1 Year" }).click();
    await page.getByRole("button", { name: "Last 1 Month" }).click();
  });
});
