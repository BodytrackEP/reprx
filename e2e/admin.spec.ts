import { expect, test } from "@playwright/test";
import { admin, signInFully } from "./support";

test("settings are saved and audited", async ({ page }) => {
  await signInFully(page, "admin");

  await page.goto("/admin/settings");
  await page.getByLabel("Warn above reps").fill("5");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Warn above reps")).toHaveValue("5");

  await page.goto("/admin/audit?table=app_settings");
  await expect(page.getByText("rm_warn_above_reps").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Zz admin" }).first()).toBeVisible();

  await page.goto("/admin/settings");
  await page.getByLabel("Warn above reps").fill("6");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});

test("a class move shows in the audit log with who did it", async ({ page }) => {
  const staff = await signInFully(page, "admin");
  const run = Date.now();

  const { data: classes } = await admin
    .from("classes")
    .insert(
      ["From", "To"].map((name) => ({
        name: `Zz ${name} ${run}`,
        category_code: "GENERAL",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
      })),
    )
    .select("id, name");
  const [from, to] = classes!.sort((a, b) => a.id - b.id);

  const { data: client } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: `Audit${run}`, is_test: true })
    .select("id, first_name, last_name")
    .single();
  const name = `${client!.first_name} ${client!.last_name}`;
  await admin
    .from("class_members")
    .insert({ class_id: from.id, client_id: client!.id, added_by: staff.id });

  await page.goto(`/admin/classes/${from.id}`);
  await page.getByLabel(`Move ${name} to class`).selectOption({ label: to.name });
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Members (0)" })).toBeVisible();

  for (const [classId, action] of [
    [from.id, "DELETE"],
    [to.id, "INSERT"],
  ] as const) {
    await page.goto(`/admin/audit?table=class_members&row=${classId}:${client!.id}`);
    const row = page.getByRole("row").filter({ hasText: action });
    await expect(row.getByRole("cell", { name: "Zz admin" })).toBeVisible();
  }
});

test("an EP cannot open settings or audit", async ({ page }) => {
  await signInFully(page, "ep");

  for (const path of ["/admin/settings", "/admin/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin$/);
  }
});
