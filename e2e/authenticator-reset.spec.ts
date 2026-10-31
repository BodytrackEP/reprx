import { expect, test } from "@playwright/test";
import { enrolTotp, signInFully, signInWithPassword } from "./support";

test("an admin resets a lost authenticator, and the reset is audited", async ({
  page,
  browser,
}) => {
  await signInFully(page, "admin");

  const context = await browser.newContext();
  const staffPage = await context.newPage();
  const staff = await signInFully(staffPage, "ep");

  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/staff");
  const row = page.getByRole("row").filter({ hasText: staff.email });
  await expect(row.getByText("Set up", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Reset authenticator" }).click();

  await expect(page.getByText("Authenticator reset.")).toBeVisible();
  await expect(row.getByText("Not set up")).toBeVisible();
  await expect(row.getByRole("button", { name: "Reset authenticator" })).toHaveCount(0);

  // A fresh sign-in gets the set-up screen, with a different secret.
  await staffPage.context().clearCookies();
  await signInWithPassword(staffPage, staff.email);
  await expect(staffPage.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  const secret = await enrolTotp(staffPage);
  expect(secret).not.toBe(staff.secret);
  await context.close();

  await page.goto(`/admin/audit?table=staff&row=${staff.id}`);
  const entry = page.getByRole("row").filter({ hasText: "mfa:reset" });
  await expect(entry.getByText("Zz admin")).toBeVisible();
});

test("an admin has no reset button on their own row", async ({ page }) => {
  const admin = await signInFully(page, "admin");

  await page.goto("/admin/staff");
  const row = page.getByRole("row").filter({ hasText: admin.email });
  await expect(row.getByText("You", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Reset authenticator" })).toHaveCount(0);
});
