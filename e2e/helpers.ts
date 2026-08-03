import { Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@reos.com";
export const ADMIN_PASSWORD = "Admin@123!";
export const BASE = "http://localhost:3001";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 10_000 });
}

export async function apiLogin(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  return res;
}
