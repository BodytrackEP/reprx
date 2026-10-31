import { expect, test } from "@playwright/test";
import {
  admin,
  createStaff,
  emailLink,
  enrolTotp,
  PASSWORD,
  signInFully,
  signInWithPassword,
  totp,
} from "./support";

test("an anonymous visitor is sent to login", async ({ page }) => {
  await page.goto("/admin/clients");
  await expect(page).toHaveURL(/\/login$/);
});

test("a wrong password is refused", async ({ page }) => {
  const staff = await createStaff("ep");
  await page.goto("/login");
  await page.getByLabel("Email").fill(staff.email);
  await page.getByLabel("Password").fill("not-the-right-one");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("public sign-up is refused", async ({ request }) => {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      data: { email: `stranger-${Date.now()}@test.invalid`, password: PASSWORD },
    },
  );
  expect(response.ok()).toBe(false);
  expect((await response.json()).error_code).toBe("signup_disabled");
});

test("a password alone reaches no staff route or data", async ({ page }) => {
  const staff = await createStaff("admin");
  await signInWithPassword(page, staff.email);
  await expect(page.getByTestId("totp-secret")).toBeVisible();

  for (const path of ["/admin", "/admin/clients", "/admin/staff", "/admin/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/mfa$/);
  }
});

test("TOTP is enrolled on first login and required afterwards", async ({ page }) => {
  const staff = await createStaff("ep");
  await signInWithPassword(page, staff.email);

  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn't work.")).toBeVisible();

  const secret = await enrolTotp(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signInWithPassword(page, staff.email);
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await expect(page.getByTestId("totp-secret")).toHaveCount(0);

  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("an EP cannot open admin-only pages", async ({ page }) => {
  await signInFully(page, "ep");
  await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);

  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/admin$/);
});

test("a deactivated staff member loses access immediately", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  await admin.from("staff").update({ is_active: false }).eq("id", staff.id);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/no-access$/);
});

test("an admin invites a new EP, who sets a password and enrols", async ({
  page,
  browser,
}) => {
  await signInFully(page, "admin");
  const runId = Date.now();
  const email = `invited-${runId}@test.invalid`;
  const name = `Zz Invited ${runId}`;

  await page.goto("/admin/staff");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Staff email").fill(email);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByRole("status")).toContainText("Invite sent");
  await expect(page.getByRole("cell", { name })).toBeVisible();

  const link = await emailLink(email, "invited to RepRx");

  const context = await browser.newContext();
  const invited = await context.newPage();
  await invited.goto(link);
  await invited.getByRole("button", { name: "Continue" }).click();
  await expect(invited).toHaveURL(/\/accept-invite$/);

  await invited.getByLabel("New password").fill("short");
  await invited.getByLabel("Confirm password").fill("short");
  await invited.getByLabel("New password").evaluate((input) => {
    input.removeAttribute("minlength");
  });
  await invited.getByRole("button", { name: "Continue" }).click();
  await expect(invited.getByText("Use at least 12 characters.")).toBeVisible();

  await invited.getByLabel("New password").fill(PASSWORD);
  await invited.getByLabel("Confirm password").fill(PASSWORD);
  await invited.getByRole("button", { name: "Continue" }).click();
  await expect(invited).toHaveURL(/\/mfa$/);

  await enrolTotp(invited);
  await expect(invited.getByText(`Welcome back, ${name}`)).toBeVisible();
  await context.close();
});

test("the signed-in app runs without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });

  await signInFully(page, "admin");
  await page.goto("/admin/staff");
  await expect(page.getByRole("heading", { name: "Staff", exact: true })).toBeVisible();

  expect(violations).toEqual([]);
});

test("pages send a nonce-based CSP and httpOnly session cookies", async ({ page }) => {
  const response = await page.goto("/login");
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-/);
  expect(csp).toContain("frame-ancestors 'none'");

  const staff = await createStaff("ep");
  await signInWithPassword(page, staff.email);
  const cookies = await page.context().cookies();
  const session = cookies.filter((cookie) => cookie.name.includes("auth-token"));
  expect(session.length).toBeGreaterThan(0);
  expect(session.every((cookie) => cookie.httpOnly)).toBe(true);
});
