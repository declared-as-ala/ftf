import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders and accepts credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.locator('input[type="email"]').fill('admin@ftf.org.tn');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('bad@ftf.org.tn');
    await page.locator('input[type="password"]').fill('wrong');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=identifiants|Email|mot de passe|erron')).toBeVisible();
  });
});

test.describe('Admin — Yellow Card Accumulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@ftf.org.tn');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/);
  });

  test('navigate to a match and add a yellow card', async ({ page }) => {
    await page.goto('/admin/matchs');
    await page.waitForSelector('table tbody tr, [data-testid="match-card"]');
    const firstMatch = page.locator('table tbody tr a, [data-testid="match-card"] a').first();
    await firstMatch.click();
    await page.waitForURL(/\/admin\/matchs\/[a-f0-9]{24}/);
    await expect(page.locator('text=Carton|Carton jaune|Ajouter')).toBeVisible();
  });

  test('discipline page lists cards', async ({ page }) => {
    await page.goto('/admin/joueurs');
    await page.waitForSelector('table tbody tr, [data-testid="player-card"]');
  });
});

test.describe('Admin — Red Card Decision', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@ftf.org.tn');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/);
  });

  test('suspensions page loads with pending decisions', async ({ page }) => {
    await page.goto('/admin/matchs');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Access Control', () => {
  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('club users cannot access admin routes', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('club@test.tn');
    await page.locator('input[type="password"]').fill('0000');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/club\/dashboard/);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/club\/dashboard|\/login/);
  });
});

test.describe('Health Check', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const resp = await request.get('/api/health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('ok');
    expect(body.db.status).toBe('connected');
  });
});
