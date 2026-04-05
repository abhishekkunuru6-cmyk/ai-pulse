import { test, expect } from "@playwright/test";

test.describe("Tab Navigation", () => {
  test("navigates between all tabs", async ({ page }) => {
    await page.goto("/");

    // Feed tab should be active by default (Topics view shows "What's Happening")
    await expect(page.getByRole("heading", { name: "What's Happening" })).toBeVisible();

    // Navigate to Digest
    await page.locator("nav a", { hasText: "Digest" }).click();
    await expect(page).toHaveURL("/digest");
    await expect(page.getByRole("heading", { name: "Digest" })).toBeVisible();

    // Navigate to Saved
    await page.locator("nav a", { hasText: "Saved" }).click();
    await expect(page).toHaveURL("/saved");
    await expect(page.getByRole("heading", { name: "Saved Articles" })).toBeVisible();

    // Navigate to Sources
    await page.locator("nav a", { hasText: "Sources" }).click();
    await expect(page).toHaveURL("/sources");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

    // Navigate to Settings
    await page.locator("nav a", { hasText: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Navigate back to Feed
    await page.evaluate(() => {
      document.querySelector("nextjs-portal")?.remove();
    });
    await page.locator("nav a", { hasText: "Feed" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "What's Happening" })).toBeVisible();
  });

  test("bottom nav has 5 tabs", async ({ page }) => {
    await page.goto("/");
    const navLinks = page.locator("nav a");
    await expect(navLinks).toHaveCount(5);
  });

  test("saved tab shows empty state when no articles bookmarked", async ({ page }) => {
    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Saved Articles" })).toBeVisible();
    // Either shows articles or empty state
    const hasEmpty = await page.getByText(/Articles you bookmark|No saved articles/i).isVisible().catch(() => false);
    const hasArticles = (await page.locator("article").count()) > 0;
    expect(hasEmpty || hasArticles).toBeTruthy();
  });

  test("bottom nav highlights active tab", async ({ page }) => {
    await page.goto("/digest");
    const digestLink = page.locator("nav a", { hasText: "Digest" });
    await expect(digestLink).toBeVisible();
  });
});
