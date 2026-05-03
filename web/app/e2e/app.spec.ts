import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Nodi')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('text=Home')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'wrong');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL(/\/$/);
  });

  test('dashboard shows file list or empty state', async ({ page }) => {
    await expect(page.locator('text=Upload')).toBeVisible();
    await expect(page.locator('text=New Folder')).toBeVisible();
    // Either files or empty state
    await expect(page.locator('text=Home').first()).toBeVisible();
  });

  test('theme toggle works', async ({ page }) => {
    await page.click('[title^="Theme:"]');
    await expect(page.locator('html.dark')).toBeAttached();
  });

  test('logout redirects to login', async ({ page }) => {
    await page.click('.avatar-button');
    await page.click('text=Sign out');
    await expect(page).toHaveURL(/\/login/);
  });
});
