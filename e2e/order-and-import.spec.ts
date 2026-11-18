import { expect, test } from "@playwright/test";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `Zz${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function classWithMembers(staffId: string, surnames: string[]) {
  const { data: exercise } = await admin
    .from("exercises")
    .insert({ name: unique("Order Lift ") })
    .select("id")
    .single();
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: unique("Order Class "),
      category_code: "GENERAL",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id, name")
    .single();
  await programForClass(classRow!.id, [
    { exercise_id: exercise!.id, sets: 3, reps: "10", rm_percentage: 0.5 },
  ]);
  const { data: clients } = await admin
    .from("clients")
    .insert(surnames.map((last_name) => ({ first_name: "Zz", last_name, is_test: true })))
    .select("id, first_name, last_name");
  await admin.from("class_members").insert(
    clients!.map((client) => ({ class_id: classRow!.id, client_id: client.id, added_by: staffId })),
  );
  return classRow!;
}

test("staff set the client order for a class, and every session keeps it", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const tag = unique("");
  const names = ["Alpha", "Bravo", "Charlie"].map((name) => `${name}${tag}`);
  const classRow = await classWithMembers(staff.id, names);

  await page.goto(`/admin/sessions/${classRow.id}`);
  const headers = page.locator("thead th a");
  await expect(headers).toHaveCount(3);
  // Default: by name.
  await expect(headers.first()).toHaveAttribute("title", `Zz ${names[0]}`);

  await page.getByRole("button", { name: "Client order" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: `Move Zz ${names[2]} up` }).click();
  await dialog.getByRole("button", { name: `Move Zz ${names[2]} up` }).click();
  await dialog.getByRole("button", { name: "Save order" }).click();
  await expect(dialog).toBeHidden();

  await expect(headers.first()).toHaveAttribute("title", `Zz ${names[2]}`);
  await expect(headers.nth(1)).toHaveAttribute("title", `Zz ${names[0]}`);

  // Next week's session and the take-home sheets use the same order.
  await page.getByRole("link", { name: /→$/ }).click();
  await expect(headers.first()).toHaveAttribute("title", `Zz ${names[2]}`);
  await page.getByRole("link", { name: "Take-home sheets" }).click();
  await expect(page.getByTestId("take-home-sheet").first()).toContainText(`Zz ${names[2]}`);
});

test("clients are imported from a CSV after a preview, names only", async ({ page }) => {
  await signInFully(page, "ep");
  const tag = unique("");
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: `Zz Import ${tag}`,
      category_code: "GENERAL",
      day_of_week: 2,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id, name")
    .single();

  const csv = [
    "Surname,Given name,Preferred name,DOB,Class",
    `One${tag},Zz,,1950-01-01,zz import ${tag}`,
    `Two${tag},Zz,Twosy,1951-02-02,`,
    `,Zz,,,`,
    `Three${tag},Zz,,,No Such Class`,
  ].join("\n");

  await page.goto("/admin/clients");
  await page.getByRole("link", { name: "Import CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "clients.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.getByTestId("import-summary")).toContainText("2 new clients");
  await expect(page.getByTestId("import-summary")).toContainText("2 rows skipped");
  await expect(page.getByText("Ignored, and not stored: DOB")).toBeVisible();
  await expect(page.getByTestId("import-row").nth(3)).toContainText('No class named "No Such Class"');

  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 2 clients and 1 class place");

  const { data: imported } = await admin
    .from("clients")
    .select("last_name, preferred_name, is_test, class_members(class_id)")
    .like("last_name", `%${tag}`)
    .order("last_name");
  expect(imported).toEqual([
    { last_name: `One${tag}`, preferred_name: null, is_test: true,
      class_members: [{ class_id: classRow!.id }] },
    { last_name: `Two${tag}`, preferred_name: "Twosy", is_test: true, class_members: [] },
  ]);

  // Importing the same file again adds nobody.
  await page.goto("/admin/clients/import");
  await page.getByLabel("CSV file").setInputFiles({
    name: "clients.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("import-summary")).toContainText("0 new clients");
  await expect(page.getByTestId("import-summary")).toContainText("0 existing clients");
});
