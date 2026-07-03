import { test, expect } from "@playwright/test";

// Core-flow E2E: register → dashboard → create project → open sample room.
// Requires a reachable DATABASE_URL (local PG or Neon branch).

const uniq = Date.now();
const EMAIL = `e2e-${uniq}@roomflow.test`;
const PASSWORD = "E2e-test-pass-123";

test.describe.serial("core flows", () => {
  test("landing page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RoomFlow/i);
  });

  test("register a new designer", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/name/i).first().fill("E2E Designer");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /register|create|sign up/i }).click();
    await page.waitForURL(/login|dashboard/, { timeout: 30_000 });
  });

  test("login and see dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /log ?in|sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    // Onboarding seed should have created the sample project.
    await expect(page.getByText(/sample project/i)).toBeVisible({ timeout: 15_000 });
  });

  test("open sample project and its room", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /log ?in|sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.getByText(/sample project/i).first().click();
    await expect(page.getByText(/living room/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(/living room/i).first().click();
    // Room editor toolbar appears (catalog button).
    await expect(page.getByRole("button", { name: /catalog/i })).toBeVisible({ timeout: 30_000 });
  });
});
