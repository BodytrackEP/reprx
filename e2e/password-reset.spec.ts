import { expect, type Page, test } from "@playwright/test";
import { createStaff, emailLink, PASSWORD, signInFully, signInWithPassword, totp } from "./support";

const NEW_PASSWORD = "another-long-passphrase";
const SENT = "If that email has an account, a reset link is on its way.";

async function requestReset(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(SENT)).toBeVisible();
}

async function fillPassword(page: Page, password: string) {
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
}

test("an unknown email gets the same reply as a real one", async ({ page }) => {
  await requestReset(page, `nobody-${Date.now()}@test.invalid`);
});

test("a staff member with TOTP resets their password, and the code is required", async ({
  page,
  context,
}) => {
  const staff = await signInFully(page, "ep");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await requestReset(page, staff.email);
  const link = await emailLink(staff.email, "Reset your RepRx password");

  // Opening the link spends nothing: a mail scanner would stop here.
  await page.goto(link);
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);

  // The reset session has no access yet.
  await page.goto("/admin/clients");
  await expect(page).toHaveURL(/\/mfa$/);
  await page.goto("/reset-password");

  await fillPassword(page, NEW_PASSWORD);
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("That code didn't work.")).toBeVisible();

  await fillPassword(page, NEW_PASSWORD);
  await page.getByLabel("6-digit code").fill(totp(staff.secret));
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await context.clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(staff.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();

  await signInWithPassword(page, staff.email, NEW_PASSWORD);
});

test("a staff member who never enrolled goes on to set up TOTP", async ({ page }) => {
  const staff = await createStaff("ep");

  await requestReset(page, staff.email);
  await page.goto(await emailLink(staff.email, "Reset your RepRx password"));
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("6-digit code")).toHaveCount(0);
  await fillPassword(page, NEW_PASSWORD);
  await page.getByRole("button", { name: "Save new password" }).click();

  await expect(page).toHaveURL(/\/mfa$/);
  await expect(page.getByTestId("totp-secret")).toBeVisible();
});

test("a reset link works only once", async ({ page, context }) => {
  const staff = await createStaff("ep");

  await requestReset(page, staff.email);
  const link = await emailLink(staff.email, "Reset your RepRx password");
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);

  await context.clearCookies();
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/reason=link-expired/);
  await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
});

test("the reset page needs a session", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login$/);
});
