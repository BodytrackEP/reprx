import { expect, type Page, test } from "@playwright/test";
import { admin, enrolTotp, PASSWORD, signInFully } from "./support";

async function acceptInvite(page: Page, link: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/accept-invite$/);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await enrolTotp(page);
}

test("a new staff member joins from a link, with no email sent", async ({ page, browser }) => {
  await signInFully(page, "admin");
  const run = Date.now();
  const email = `linked-${run}@test.invalid`;
  const name = `Zz Linked ${run}`;

  await page.goto("/admin/staff");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Staff email").fill(email);
  await page.getByRole("button", { name: "Create invite link" }).last().click();

  const link = await page.getByRole("textbox", { name: "Invite link" }).inputValue();
  expect(link).toContain("/auth/confirm?token_hash=");

  const search = await fetch(
    `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  ).then((response) => response.json());
  expect(search.messages_count ?? search.messages?.length ?? 0).toBe(0);

  const context = await browser.newContext();
  const invited = await context.newPage();
  await acceptInvite(invited, link);
  await expect(invited.getByText(`Welcome back, ${name}`)).toBeVisible();
  await context.close();

  await page.reload();
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: /Create invite link/ })).toHaveCount(0);
});

test("a pending staff member gets a link, and it's audited without the link", async ({
  page,
  browser,
}) => {
  await signInFully(page, "admin");
  const run = Date.now();
  const email = `pending-${run}@test.invalid`;
  const name = `Zz Pending ${run}`;

  await page.goto("/admin/staff");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Staff email").fill(email);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(`Invite sent to ${email}.`)).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row.getByText("Invited", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: `Create invite link for ${name}` }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = await dialog.getByRole("textbox", { name: "Invite link" }).inputValue();
  const token = new URL(link).searchParams.get("token_hash")!;

  const context = await browser.newContext();
  await acceptInvite(await context.newPage(), link);
  await context.close();

  const { data: staff } = await admin
    .from("staff")
    .select("id")
    .eq("display_name", name)
    .single();
  await page.goto(`/admin/audit?table=staff&row=${staff!.id}`);
  await expect(page.getByRole("row").filter({ hasText: "invite:link" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(token);
});

test("an existing account can't be invited by link", async ({ page }) => {
  const staff = await signInFully(page, "admin");

  await page.goto("/admin/staff");
  await page.getByLabel("Name").fill("Zz Duplicate");
  await page.getByLabel("Staff email").fill(staff.email);
  await page.getByRole("button", { name: "Create invite link" }).last().click();
  await expect(page.getByText("That email already has an account.")).toBeVisible();
});
