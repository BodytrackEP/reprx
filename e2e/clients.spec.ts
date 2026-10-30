import { expect, type Page, test } from "@playwright/test";
import { admin, signInFully } from "./support";

const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function makeClass(capacity: number | null = null) {
  const name = unique("Zz Class ");
  const { data, error } = await admin
    .from("classes")
    .insert({
      name,
      category_code: "GENERAL",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
      max_capacity: capacity,
    })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function makeClient(isTest = true) {
  const lastName = unique("Zztest");
  const { data, error } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: lastName, is_test: isTest })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, name: `Zz ${lastName}` };
}

async function addTo(classId: number, clientId: number, addedBy: string) {
  const { error } = await admin
    .from("class_members")
    .insert({ class_id: classId, client_id: clientId, added_by: addedBy });
  if (error) throw error;
}

const memberRow = (page: Page, name: string) =>
  page.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });

test("a client is created with names only, and flagged as test data here", async ({ page }) => {
  await signInFully(page, "ep");
  const lastName = unique("Zznew");

  await page.goto("/admin/clients");
  await page.getByRole("button", { name: "+ New Client" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveCount(3);
  await dialog.getByLabel("First name").fill("Zz");
  await dialog.getByLabel("Last name").fill(lastName);
  await dialog.getByLabel("Preferred name (optional)").fill("Zed");
  await dialog.getByRole("button", { name: "Create client" }).click();

  await expect(
    page.getByRole("heading", { name: `Zz ${lastName} (Zed)` }),
  ).toBeVisible();
  await expect(page.getByText("Test", { exact: true })).toBeVisible();
  await expect(page.getByText("Not linked to Cliniko")).toHaveCount(0);

  await page.goto(`/admin/clients?q=${lastName}&kind=test`);
  await expect(page.getByRole("link", { name: `Zz ${lastName} (Zed)` })).toBeVisible();
  await page.goto(`/admin/clients?q=${lastName}&kind=real`);
  await expect(page.getByText("No clients match your filters.")).toBeVisible();
});

test("an unlinked real client shows the Cliniko chip", async ({ page }) => {
  await signInFully(page, "ep");
  const client = await makeClient(false);
  await page.goto(`/admin/clients/${client.id}`);
  await expect(page.getByText("Not linked to Cliniko")).toBeVisible();

  await admin.from("clients").delete().eq("id", client.id);
});

test("members are added, moved one at a time and moved in bulk", async ({ page }) => {
  await signInFully(page, "ep");
  const from = await makeClass();
  const to = await makeClass();
  const [one, two, three] = [await makeClient(), await makeClient(), await makeClient()];

  await page.goto(`/admin/classes/${from.id}`);
  await page.getByRole("button", { name: "+ Add Members" }).click();
  const dialog = page.getByRole("dialog");
  for (const client of [one, two, three]) {
    await dialog.getByLabel("Search clients").fill(client.name);
    await dialog.getByLabel(client.name).check();
  }
  await dialog.getByRole("button", { name: "Add 3 to class" }).click();
  await expect(page.getByRole("heading", { name: "Members (3)" })).toBeVisible();

  const row = memberRow(page, one.name);
  await row.getByLabel(`Move ${one.name} to class`).selectOption({ label: to.name });
  await row.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Members (2)" })).toBeVisible();

  await page.getByLabel(`Select ${two.name}`).check();
  await page.getByLabel(`Select ${three.name}`).check();
  await page.getByLabel("Move selected clients to class").selectOption({ label: to.name });
  await page
    .getByText("2 selected")
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Members (0)" })).toBeVisible();

  await page.goto(`/admin/classes/${to.id}`);
  await expect(page.getByRole("heading", { name: "Members (3)" })).toBeVisible();
});

test("a full class refuses a move; an admin can override", async ({ page }) => {
  const staff = await signInFully(page, "admin");
  const from = await makeClass();
  const full = await makeClass(1);
  const [occupant, mover] = [await makeClient(), await makeClient()];
  await addTo(full.id, occupant.id, staff.id);
  await addTo(from.id, mover.id, staff.id);

  await page.goto(`/admin/classes/${from.id}`);
  const row = memberRow(page, mover.name);
  await row.getByLabel(`Move ${mover.name} to class`).selectOption({ label: full.name });
  await row.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText(`${full.name} is full (1 of 1 places taken).`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Members (1)" })).toBeVisible();

  await page.getByLabel("Allow over capacity").check();
  await row.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Members (0)" })).toBeVisible();

  await page.goto(`/admin/classes/${full.id}`);
  await expect(page.getByRole("heading", { name: "Members (2/1)" })).toBeVisible();
});

test("classes are changed from a client's page, atomically", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const open = await makeClass();
  const full = await makeClass(1);
  const [occupant, client] = [await makeClient(), await makeClient()];
  await addTo(full.id, occupant.id, staff.id);

  await page.goto(`/admin/clients/${client.id}`);
  await expect(page.getByRole("heading", { name: "Classes (0)" })).toBeVisible();

  await page.getByRole("button", { name: "Change classes" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(open.name).check();
  await dialog.getByLabel(full.name).check();
  await dialog.getByRole("button", { name: "Save classes" }).click();
  await expect(dialog.getByText("is full")).toBeVisible();

  await dialog.getByLabel(full.name).uncheck();
  await dialog.getByRole("button", { name: "Save classes" }).click();
  await expect(page.getByRole("heading", { name: "Classes (1)" })).toBeVisible();
});

test("a soft-deleted client leaves the list and can be restored", async ({ page }) => {
  await signInFully(page, "ep");
  const client = await makeClient();
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(`/admin/clients/${client.id}`);
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted", { exact: true })).toBeVisible();

  await page.goto(`/admin/clients?q=${encodeURIComponent(client.name)}`);
  await expect(page.getByText("No clients match your filters.")).toBeVisible();
  await page.goto(`/admin/clients?q=${encodeURIComponent(client.name)}&status=deleted`);
  await page.getByRole("link", { name: client.name }).click();

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Deleted", { exact: true })).toHaveCount(0);
});
